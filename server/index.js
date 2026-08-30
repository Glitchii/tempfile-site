import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { isIP } from 'node:net'
import path from 'node:path'
import dotenv from 'dotenv'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'

dotenv.config({ quiet: true })

const PORT = +(process.env.PORT ?? 3001)
const app = express()

const trustProxy = process.env.TRUST_PROXY
trustProxy && app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)

const distDir = path.resolve(process.cwd(), 'dist')
const dataDir = path.resolve(process.cwd(), 'data')
const filesDir = path.join(dataDir, 'files')
const metaDir = path.join(dataDir, 'meta')
const maxFileSize = 2 * 1024 * 1024 * 1024
const downloadOnlyTypes = /htm|svg|xml/i
const authCookie = 'tempfile_auth'
const authDurationMs = 15 * 60_000
const authSecret = process.env.AUTH_SECRET

const bucket = process.env.AWS_BUCKET
const s3 = bucket && new S3Client({
  region: process.env.AWS_REGION,
  forcePathStyle: process.env.AWS_FORCE_PATH_STYLE === 'true',
  endpoint: process.env.AWS_ENDPOINT_URL,
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSize } })

app.use(express.json())
app.use((_req, res, next) => next(res.setHeader('X-Powered-By', 'coffee and addiction') && null))

const ensureDirs = async () => {
  await fs.mkdir(filesDir, { recursive: true })
  await fs.mkdir(metaDir, { recursive: true })
}

const ok = (res, obj) => res.json({ ok: true, ...obj })
const err = (res, status = 500, type = 'InternalServerError', message = 'There was an internal server error', usage) => {
  res.status(status).json({ ok: false, error: { type, message, ...(usage ? { usage } : {}) } })
}

const limitRequests = (windowMs, limit, message, options = {}) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (req, res) => {
    err(res, 429, 'TooManyRequests', message)
    console.warn(message, {
      ip: getClientIp(req), method: req.method, path: req.originalUrl,
      attempts: req.rateLimit.used + '/' + req.rateLimit.limit, resetAt: req.rateLimit.resetTime,
    })
  },
  ...options,
})

const uploadLimiter = limitRequests(
  +(process.env.UPLOAD_RATE_WINDOW_MS ?? 60_000),
  +(process.env.UPLOAD_RATE_LIMIT ?? 20),
  'Too many uploads. Wait a moment and try again.',
)

const authLimiter = limitRequests(
  +(process.env.AUTH_RATE_WINDOW_MS ?? 10 * 60_000),
  +(process.env.AUTH_RATE_LIMIT ?? 10),
  'Too many authentication attempts. Wait and try again.',
  { skipSuccessfulRequests: true },
)

const normaliseFilename = (value) => {
  const filename = String(value || '').trim().toLowerCase()
  return filename && filename !== '.' && filename !== '..' && Buffer.byteLength(filename) <= 255 && !/[/\\\0]/.test(filename)
    ? filename
    : null
}

const getCookie = (req, name) => {
  const prefix = `${name}=`
  const pair = String(req.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))
  if (!pair) return null
  try {
    return decodeURIComponent(pair.slice(prefix.length))
  } catch {
    return null
  }
}

const signAuthPayload = (payload) => crypto.createHmac('sha256', authSecret).update(payload).digest('base64url')

const hasBrowserAuth = (req, filename) => {
  try {
    const [payload, signature] = (getCookie(req, authCookie) || '').split('.')
    if (!payload || !signature) return false

    const actual = Buffer.from(signature)
    const expected = Buffer.from(signAuthPayload(payload))
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false

    const auth = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return auth.filename === filename && Number(auth.expiresAt) > Date.now()
  } catch {
    return false
  }
}

const setBrowserAuth = (req, res, filename) => {
  const expiresAt = Date.now() + authDurationMs
  const payload = Buffer.from(JSON.stringify({ filename, expiresAt })).toString('base64url')
  const secure = req.secure || process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${authCookie}=${payload}.${signAuthPayload(payload)}; Max-Age=${authDurationMs / 1000}; Path=/files/${encodeURIComponent(filename)}; HttpOnly; SameSite=Lax${secure}`)
}

const browserError = (res, status) => {
  res.redirect(302, `/error/${status}`)
}

const metaKey = (filename) => `meta/${filename}.json`
const fileKey = (filename) => `files/${filename}`
const metaPathFor = (filename) => path.join(metaDir, `${filename}.json`)
const filePathFor = (filename) => path.join(filesDir, filename)

const existsLocal = async (p) => {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

const isMissingS3Object = (error) => error?.name === 'NotFound' || error?.name === 'NoSuchKey'

const existsS3 = async (Key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }))
    return true
  } catch (error) {
    if (isMissingS3Object(error)) return false
    throw error
  }
}

const getS3Object = async (Key) => {
  try {
    const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }))
    return Buffer.from(await data.Body.transformToByteArray())
  } catch (error) {
    if (isMissingS3Object(error)) return null
    throw error
  }
}

const getS3Json = async (Key) => {
  const body = await getS3Object(Key)
  return body ? JSON.parse(body.toString('utf8')) : null
}

const readMeta = async (filename) => {
  if (s3) return getS3Json(metaKey(filename))

  const mp = metaPathFor(filename)
  return (await existsLocal(mp)) ? JSON.parse(await fs.readFile(mp, 'utf8')) : null
}

const isExpired = (meta) => {
  const expiry = Date.parse(meta.datetime)
  return !Number.isFinite(expiry) || Date.now() >= expiry
}

const readActiveMeta = async (filename) => {
  const meta = await readMeta(filename)
  if (!meta || !isExpired(meta)) return meta
  await removeUpload(filename)
  return null
}

const readUpload = async (filename) => {
  const meta = await readActiveMeta(filename)
  if (!meta) return null

  const body = s3
    ? await getS3Object(fileKey(filename))
    : await fs.readFile(filePathFor(filename))
  return body ? { meta, body } : null
}

const writeUpload = async (filename, meta, body) => {
  if (s3) {
    const writes = await Promise.allSettled([  
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileKey(filename), Body: body, ContentType: meta.mimetype || 'application/octet-stream' })),  
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: metaKey(filename), Body: JSON.stringify(meta), ContentType: 'application/json' })),  
    ])

    const failed = writes.find(({ status }) => status === 'rejected')  
    if (failed) {  
      await Promise.allSettled([  
        ...(writes[0].status === 'fulfilled' ? [s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey(filename) }))] : []),  
        ...(writes[1].status === 'fulfilled' ? [s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: metaKey(filename) }))] : []),  
      ])
      throw failed.reason  
    }

    return
  }

  await ensureDirs()
  await Promise.all([
    fs.writeFile(filePathFor(filename), body),
    fs.writeFile(metaPathFor(filename), JSON.stringify(meta), 'utf8'),
  ])
}

const writeMeta = async (filename, meta) => {
  if (s3)
    return await s3.send(new PutObjectCommand({ Bucket: bucket, Key: metaKey(filename), Body: JSON.stringify(meta), ContentType: 'application/json' }))

  await ensureDirs()
  await fs.writeFile(metaPathFor(filename), JSON.stringify(meta), 'utf8')
}

const removeUpload = async (filename) => {
  if (s3)
    return await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey(filename) })),
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: metaKey(filename) })),
    ])

  await Promise.allSettled([fs.unlink(filePathFor(filename)), fs.unlink(metaPathFor(filename))])
}

const uploadExists = async (filename) => {
  if (s3) return existsS3(metaKey(filename))
  return existsLocal(metaPathFor(filename))
}

const listMetaNames = async () => {
  if (s3) {
    let ContinuationToken, names = []
    do {
      // S3 returns at most 1,000 objects per ListObjectsV2 request, hence the pagination token https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/ListObjectsV2Command
      const data = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'meta/', ContinuationToken }))
      for (const item of data.Contents || []) {
        const key = item.Key || ''
        key.endsWith('.json') && names.push(key.slice(5, -5))
      }
      ContinuationToken = data.NextContinuationToken
    } while (ContinuationToken)
    return names
  }

  await ensureDirs()
  return (await fs.readdir(metaDir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
}

const parseDatetime = (value) => {
  if (!value || typeof value !== 'string')
    return null

  const trimmed = value.trim()
  const digit = Number(trimmed.replace(/\D+$/, ''))
  const now = new Date()
  const date =
    trimmed.endsWith('mo') ? new Date(new Date(now).setMonth(now.getMonth() + digit)) :
      trimmed.endsWith('w') ? new Date(now.getTime() + digit * 7 * 24 * 60 * 60_000) :
        trimmed.endsWith('d') ? new Date(now.getTime() + digit * 24 * 60 * 60_000) :
          trimmed.endsWith('h') ? new Date(now.getTime() + digit * 60 * 60_000) :
            trimmed.endsWith('m') ? new Date(now.getTime() + digit * 60_000) :
              new Date(trimmed)

  if (Number.isNaN(date.getTime())) return null
  if (date.getTime() - now.getTime() < 60_000) return 0
  if (date.getTime() - now.getTime() > 31 * 24 * 60 * 60_000) return 1
  return date
}

const extensionFor = (name, fallback = '') => {
  const ext = path.extname(String(name)).toLowerCase()
  return /^\.[a-z0-9]{1,19}$/.test(ext) ? ext : fallback
}

const sanitiseBaseName = (name, ext = '') => {
  if (!name) return null

  const clean = String(name).trim().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^a-z0-9-_.]/g, '')
    .slice(0, 180)

  if (!clean || clean === '.' || clean === '..')
    return null

  const safeExt = ext.toLowerCase()
  return safeExt && clean.endsWith(safeExt) ? clean.slice(0, -safeExt.length) : clean
}

const chooseName = async (preferredBase, ext = '') => {
  const safeExt = ext.toLowerCase()
  const base = sanitiseBaseName(preferredBase, safeExt)
    || crypto.randomBytes(10).toString('base64url').toLowerCase()

  for (let i = 0; ; i++) {
    const name = `${base}${i ? `-${i}` : ''}${safeExt}`
    if (!(await uploadExists(name))) return name
  }
}

const splitCsv = (value = '') => {
  return String(value).split(',').map(ip => ip.trim()).filter(Boolean)
}

const validateIps = (blacklist = [], whitelist = []) => {
  for (const ip of [...blacklist, ...whitelist]) if (!isIP(ip)) return `The IP "${ip}" is invalid`
  for (const ip of blacklist) if (whitelist.includes(ip)) return `The IP "${ip}" should not be in both whitelist and blacklist`
  return null
}

const normaliseIp = (value) => {
  const ip = String(value || '').replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '')
  return ip === '::1' || ip.startsWith('127.') ? 'loopback' : ip
}

const getClientIp = (req) => normaliseIp(req.ip)

const requesterNeedsDeleteKey = (meta, clientIp) => normaliseIp(meta.userIP) !== normaliseIp(clientIp)

const publicOrigin = (req) => String(process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '')

const publicMeta = (meta, clientIp) => ({
  filename: meta.filename,
  originalname: meta.originalname,
  mimetype: meta.mimetype,
  size: meta.size,
  createdAt: meta.createdAt,
  datetime: meta.datetime,
  limit: meta.limit,
  hasPassword: Boolean(meta.pass),
  ipRestricted: Boolean(meta.ipblacklist?.length || meta.ipwhitelist?.length),
  requesterRequiresDeleteKey: requesterNeedsDeleteKey(meta, clientIp),
})

const loadFileMeta = async (req, res, next) => {
  const filename = normaliseFilename(req.params.name)
  if (!filename) return err(res, 400, 'InvalidFilename', 'File name is invalid')

  const meta = await readActiveMeta(filename)
  if (!meta) return err(res, 404, 'NotFound', 'File not found')

  res.locals.file = { filename, meta }
  next()
}

app.post('/files', uploadLimiter, (req, res, next) => {
  upload.single('file')(req, res, async (uploadError) => {
    try {
      if (process.env.UPLOAD_MESSAGE) return err(res, 400, 'UploadDisabled', process.env.UPLOAD_MESSAGE)
      if (uploadError?.code === 'LIMIT_FILE_SIZE') return err(res, 400, 'FileTooLarge', 'File is too large.')
      if (uploadError) return err(res, 400, 'UploadError', 'There was an error while processing the file')

      const text = req.body?.text?.toString()
      if (!req.file && !text?.trim()) return err(res, 400, 'MissingFile', 'No file or text received')
      if (!req.body?.datetime) return err(res, 400, 'MissingDateTime', "Request must include a 'datetime' key", `${publicOrigin(req)}/files`)

      const chosenDate = parseDatetime(req.body.datetime)
      if (chosenDate === 0) return err(res, 400, 'TooLow', 'Time must be at least a minute ahead')
      if (chosenDate === 1) return err(res, 400, 'TooHigh', 'Given date or time is over the limit')
      if (!chosenDate) return err(res, 400, 'InvalidDate', 'Given date or time is invalid')

      const ipblacklist = splitCsv(req.body.ipblacklist)
      const ipwhitelist = splitCsv(req.body.ipwhitelist)
      if (ipblacklist.length > 5 || ipwhitelist.length > 5) return err(res, 400, 'IPLimitExceeded', 'Only up to 5 IPs allowed')

      const ipError = validateIps(ipblacklist, ipwhitelist)
      if (ipError) return err(res, 400, 'InvalidIP', ipError)

      const limitRaw = req.body.limit
      const limit = limitRaw ? Number(limitRaw) : undefined
      if (limitRaw && (!Number.isSafeInteger(limit) || limit <= 0)) return err(res, 400, 'InvalidLimit', 'Limit must be a positive whole number')

      const body = req.file?.buffer || Buffer.from(text)
      const originalname = req.file?.originalname || 'text.txt'
      const ext = req.file ? extensionFor(originalname, req.file?.mimetype?.split('/')?.[1] || '') : extensionFor(req.body.name, '.txt')
      const filename = await chooseName(req.body.name, ext)
      const password = typeof req.body.pass === 'string' ? req.body.pass : ''
      if (Buffer.byteLength(password) > 72) return err(res, 400, 'PasswordTooLong', 'Password must be at most 72 bytes')
      const passHash = password ? await bcrypt.hash(password, 10) : undefined
      const suppliedAuthKey = typeof req.body.authkey === 'string' ? req.body.authkey.trim() : ''
      if (Buffer.byteLength(suppliedAuthKey) > 128) return err(res, 400, 'AuthKeyTooLong', 'Authentication key must be at most 128 bytes')
      const authkey = suppliedAuthKey || crypto.randomBytes(9).toString('base64url')
      const link = `${publicOrigin(req)}/files/${filename}`

      const meta = {
        filename,
        originalname,
        mimetype: req.file?.mimetype || 'text/plain; charset=utf-8',
        size: body.length,
        createdAt: new Date().toISOString(),
        datetime: chosenDate.toISOString(),
        userIP: getClientIp(req),
        authkey,
        ...(passHash ? { pass: passHash } : {}),
        ...(typeof limit === 'number' ? { limit } : {}),
        ...(ipblacklist.length ? { ipblacklist } : {}),
        ...(ipwhitelist.length ? { ipwhitelist } : {}),
      }

      await writeUpload(filename, meta, body)

      ok(res, {
        link,
        authkey,
        deletion: `To delete, make a DELETE request to ${publicOrigin(req)}/files/${filename} with an authkey header. ${publicOrigin(req)}/api#delete`,
      })
    } catch (error) {
      next(error)
    }
  })
})

const canAccessByIp = (clientIp, meta) => {
  const ip = normaliseIp(clientIp)

  if (meta.ipblacklist?.some((item) => normaliseIp(item) === ip))
    return false

  if (meta.ipwhitelist?.length && !meta.ipwhitelist.some((item) => normaliseIp(item) === ip))
    return false

  return true
}

const decrementLimit = async (filename, meta) => {
  if (!meta.limit) return
  meta.limit -= 1
  await (meta.limit ? writeMeta(filename, meta) : removeUpload(filename))
}

const sendUpload = async (req, res, filename) => {
  if (!filename) return browserError(res, 404)

  const found = await readUpload(filename)
  if (!found) return browserError(res, 404)

  const { meta, body } = found
  if (!canAccessByIp(getClientIp(req), meta)) return browserError(res, 403)

  if (meta.pass && !hasBrowserAuth(req, filename)) {
    const supplied = req.headers.pass
    if (typeof supplied !== 'string')
      return res.redirect(302, `/auth/${encodeURIComponent(filename)}`)
    if (!(await bcrypt.compare(supplied, meta.pass)))
      return err(res, 401, 'WrongPass', 'Incorrect password')
  }

  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'none'")
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', meta.mimetype)
  res.setHeader('Content-Length', body.length)
  if (downloadOnlyTypes.test(meta.mimetype + meta.originalname))
    res.attachment(meta.originalname || filename)

  res.send(body)
  decrementLimit(filename, meta).catch((error) => console.error('decrement limit', error))
}

app.get('/files/:name/info', loadFileMeta, (req, res) => {
  ok(res, { file: publicMeta(res.locals.file.meta, getClientIp(req)) })
})

app.post('/files/:name/auth', authLimiter, loadFileMeta, async (req, res) => {
  const { filename, meta } = res.locals.file
  if (!canAccessByIp(getClientIp(req), meta))
    return err(res, 403, 'Forbidden', 'You are not allowed to access this file.')

  if (!meta.pass)
    return err(res, 409, 'PasswordNotRequired', 'This file is not password protected')

  const password = req.body?.password
  if (typeof password !== 'string' || !password)
    return err(res, 400, 'MissingPassword', 'Enter the file password')

  if (Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, meta.pass)))
    return err(res, 401, 'WrongPass', 'Incorrect password')

  setBrowserAuth(req, res, filename)
  res.setHeader('Cache-Control', 'no-store')
  ok(res, { link: `/files/${encodeURIComponent(filename)}` })
})

app.delete('/files/:name', authLimiter, loadFileMeta, async (req, res) => {
  const { filename, meta } = res.locals.file
  if (requesterNeedsDeleteKey(meta, getClientIp(req))) {
    const key = req.headers.authkey
    if (typeof key !== 'string')
      return err(res, 400, 'MissingAuthKey', "An 'authkey' header with the auth key is required")

    if (key !== meta.authkey)
      return err(res, 400, 'BadAuthKey', 'Incorrect auth key received')
  }

  await removeUpload(filename)
  ok(res)
})

app.get('/files/:name', (req, res) => {
  res.locals.redirectErrors = true
  return sendUpload(req, res, normaliseFilename(req.params.name))
})

app.get('/debug', (req, res) => res.json({
  xff: req.headers['x-forwarded-for'],
  cfip: req.headers['cf-connecting-ip'],
  socket: req.socket.remoteAddress,
  reqIp: req.ip,
}))

const cleanupExpired = async () => {
  try {
    for (const filename of await listMetaNames())
      await readActiveMeta(filename)
  } catch (error) {
    console.error('cleanupExpired', error)
  }
}

app.use((error, req, res, _next) => {
  console.error(`${req.method} ${req.path}`, error)
  return res.locals.redirectErrors ? browserError(res, 500) : err(res)
})

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
  res.setHeader('X-Frame-Options', 'DENY')
  next()
})

app.use(express.static(distDir))
app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))

cleanupExpired()
setInterval(cleanupExpired, 60_000)

app.listen(PORT, () => {
  console.log(`API listening at http://0.0.0.0:${PORT} (${s3 ? `S3 bucket ${bucket}` : `local storage at ${path.relative(process.cwd(), dataDir)}`})`)
})
