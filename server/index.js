import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { isIP } from 'node:net'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'

process.loadEnvFile()

const PORT = +(process.env.PORT ?? 3001)
const HOST = process.env.HOST || '0.0.0.0'
const app = express()

const trustProxy = process.env.TRUST_PROXY || 'loopback'
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)

const distDir = path.resolve(process.cwd(), 'dist')
const dataDir = path.resolve(process.cwd(), 'data')
const filesDir = path.join(dataDir, 'files')
const metaDir = path.join(dataDir, 'meta')
const tempDir = path.join(dataDir, 'tmp')
const maxFileSize = 95 * 1024 * 1024
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

const upload = multer({
  dest: tempDir,
  limits: { fileSize: maxFileSize, files: 1, fields: 8, parts: 9, headerPairs: 100 },
})

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

const secureCookie = (req) => process.env.NODE_ENV === 'production' ? '; Secure' : ''
const signAuthPayload = (payload) => crypto.createHmac('sha256', authSecret).update(payload).digest('base64url')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('base64url')
const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string')
    return false

  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const hasBrowserAuth = (req, filename) => {
  try {
    const [payload, signature] = (getCookie(req, authCookie) || '').split('.')
    if (!payload || !signature)
      return false

    if (!safeEqual(signature, signAuthPayload(payload)))
      return false

    const auth = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return auth.filename === filename && Number(auth.expiresAt) > Date.now()
  } catch {
    return false
  }
}

const setBrowserAuth = (req, res, filename) => {
  const expiresAt = Date.now() + authDurationMs
  const payload = Buffer.from(JSON.stringify({ filename, expiresAt })).toString('base64url')
  res.setHeader('Set-Cookie', `${authCookie}=${payload}.${signAuthPayload(payload)}; Max-Age=${authDurationMs / 1000}; Path=/files/${encodeURIComponent(filename)}; HttpOnly; SameSite=Lax${secureCookie(req)}`)
}

const ownerCookieFor = (filename) => `tempfile_owner_${sha256(filename).slice(0, 16)}`

const hasUploadOwnership = (req, filename, meta) => {
  const token = getCookie(req, ownerCookieFor(filename))
  return Boolean(token && meta.ownerHash && safeEqual(sha256(token), meta.ownerHash))
}

const setUploadOwnership = (req, res, filename, token, expiresAt) => {
  const maxAge = Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
  res.append('Set-Cookie', `${ownerCookieFor(filename)}=${token}; Max-Age=${maxAge}; Path=/files/${encodeURIComponent(filename)}; HttpOnly; SameSite=Strict${secureCookie(req)}`)
}

const clearUploadOwnership = (req, res, filename) => {
  res.append('Set-Cookie', `${ownerCookieFor(filename)}=; Max-Age=0; Path=/files/${encodeURIComponent(filename)}; HttpOnly; SameSite=Strict${secureCookie(req)}`)
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
    if (isMissingS3Object(error))
      return false
    throw error
  }
}

const getS3Buffer = async (Key) => {
  try {
    const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }))
    return Buffer.from(await data.Body.transformToByteArray())
  } catch (error) {
    if (isMissingS3Object(error)) return null
    throw error
  }
}

const getS3Json = async (Key) => {
  const body = await getS3Buffer(Key)
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

const openUploadBody = async (filename, range) => {
  if (s3) {
    try {
      const data = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: fileKey(filename),
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      }))
      return data.Body
    } catch (error) {
      if (isMissingS3Object(error)) return null
      throw error
    }
  }

  const filePath = filePathFor(filename)
  return (await existsLocal(filePath)) ? createReadStream(filePath, range || undefined) : null
}

const writeUpload = async (filename, meta, source) => {
  if (s3) {
    const writes = await Promise.allSettled([
      s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey(filename),
        Body: typeof source === 'string' ? createReadStream(source) : source,
        ContentLength: meta.size,
        ContentType: meta.mimetype || 'application/octet-stream',
      })),
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
    typeof source === 'string' ? fs.rename(source, filePathFor(filename)) : fs.writeFile(filePathFor(filename), source),
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

const publicOrigin = (req) => `${req.protocol}://${req.get('host')}`

const publicMeta = (meta, requesterRequiresDeleteKey) => ({
  filename: meta.filename,
  originalname: meta.originalname,
  mimetype: meta.mimetype,
  size: meta.size,
  createdAt: meta.createdAt,
  datetime: meta.datetime,
  limit: meta.limit,
  hasPassword: Boolean(meta.pass),
  ipRestricted: Boolean(meta.ipblacklist?.length || meta.ipwhitelist?.length),
  requesterRequiresDeleteKey,
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
      if (uploadError?.code === 'LIMIT_FILE_SIZE') return err(res, 400, 'FileTooLarge', `File is too large. The limit is ${ maxFileSize / 1024 * 1024}`)
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

      const source = req.file?.path || Buffer.from(text)
      const originalname = req.file?.originalname || 'text.txt'
      const ext = req.file ? extensionFor(originalname, req.file?.mimetype?.split('/')?.[1] || '') : extensionFor(req.body.name, '.txt')
      const filename = await chooseName(req.body.name, ext)
      const password = typeof req.body.pass === 'string' ? req.body.pass : ''
      if (Buffer.byteLength(password) > 72) return err(res, 400, 'PasswordTooLong', 'Password must be at most 72 bytes')
      const passHash = password ? await bcrypt.hash(password, 10) : undefined
      const suppliedAuthKey = typeof req.body.authkey === 'string' ? req.body.authkey.trim() : ''
      if (Buffer.byteLength(suppliedAuthKey) > 128) return err(res, 400, 'AuthKeyTooLong', 'Authentication key must be at most 128 bytes')
      const authkey = suppliedAuthKey || crypto.randomBytes(9).toString('base64url')
      const ownerToken = crypto.randomBytes(24).toString('base64url')
      const link = `${publicOrigin(req)}/files/${filename}`

      const meta = {
        filename,
        originalname,
        mimetype: req.file?.mimetype || 'text/plain; charset=utf-8',
        size: req.file?.size ?? source.length,
        createdAt: new Date().toISOString(),
        datetime: chosenDate.toISOString(),
        authkey,
        ownerHash: sha256(ownerToken),
        ...(passHash ? { pass: passHash } : {}),
        ...(typeof limit === 'number' ? { limit } : {}),
        ...(ipblacklist.length ? { ipblacklist } : {}),
        ...(ipwhitelist.length ? { ipwhitelist } : {}),
      }

      await writeUpload(filename, meta, source)
      setUploadOwnership(req, res, filename, ownerToken, chosenDate)
      res.setHeader('Cache-Control', 'no-store')

      ok(res, {
        link,
        authkey,
        deletion: `To delete, make a DELETE request to ${publicOrigin(req)}/files/${filename} with an authkey header. ${publicOrigin(req)}/api#delete`,
      })
    } catch (error) {
      next(error)
    } finally {
      if (req.file?.path)
        await fs.rm(req.file.path, { force: true }).catch((error) => console.error('remove temporary upload', error))
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

const parseRange = (value, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size < 1) return null

  const first = match[1] ? Number(match[1]) : null
  const last = match[2] ? Number(match[2]) : null
  if (![first, last].every((part) => part === null || Number.isSafeInteger(part))) return null

  const start = first ?? Math.max(size - last, 0)
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1)
  return start >= 0 && start < size && end >= start ? { start, end } : null
}

const decrementLimit = async (filename, meta) => {
  if (!meta.limit) return
  meta.limit -= 1
  await (meta.limit ? writeMeta(filename, meta) : removeUpload(filename))
}

const sendUpload = async (req, res, filename) => {
  if (!filename) return browserError(res, 404)

  const meta = await readActiveMeta(filename)
  if (!meta) return browserError(res, 404)
  if (!canAccessByIp(getClientIp(req), meta)) return browserError(res, 403)

  if (meta.pass && !hasBrowserAuth(req, filename)) {
    const supplied = req.headers.pass
    if (typeof supplied !== 'string')
      return res.redirect(302, `/auth/${encodeURIComponent(filename)}`)
    if (!(await bcrypt.compare(supplied, meta.pass)))
      return err(res, 401, 'WrongPass', 'Incorrect password')
  }

  const rangeHeader = meta.limit ? undefined : req.headers.range
  const range = rangeHeader ? parseRange(rangeHeader, meta.size) : undefined
  if (rangeHeader && !range) {
    res.setHeader('Content-Range', `bytes */${meta.size}`)
    return res.sendStatus(416)
  }

  const body = req.method === 'HEAD' ? null : await openUploadBody(filename, range)
  if (req.method !== 'HEAD' && !body) return browserError(res, 404)

  if (downloadOnlyTypes.test(meta.mimetype + meta.originalname))
    res.attachment(meta.originalname || filename)

  if (range) {
    res.status(206)
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${meta.size}`)
  }

  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'none'")
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range')
  res.setHeader('Accept-Ranges', meta.limit ? 'none' : 'bytes')
  res.setHeader('Content-Type', meta.mimetype || 'application/octet-stream')
  res.setHeader('Content-Length', range ? range.end - range.start + 1 : meta.size)

  if (req.method === 'HEAD') return res.end()

  try {
    await pipeline(body, res)
    decrementLimit(filename, meta).catch((error) => console.error('decrement limit', error))
  } catch (error) {
    if (error?.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('stream file', error)
  }
}

app.get('/files/:name/info', loadFileMeta, (req, res) => {
  const { filename, meta } = res.locals.file
  res.setHeader('Cache-Control', 'private, no-store')
  ok(res, { file: publicMeta(meta, !hasUploadOwnership(req, filename, meta)) })
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
  if (!hasUploadOwnership(req, filename, meta)) {
    const key = req.headers.authkey
    if (typeof key !== 'string')
      return err(res, 400, 'MissingAuthKey', "An 'authkey' header with the auth key is required")

    if (!safeEqual(key, meta.authkey))
      return err(res, 400, 'BadAuthKey', 'Incorrect auth key received')
  }

  await removeUpload(filename)
  clearUploadOwnership(req, res, filename)
  ok(res)
})

app.get('/files/:name', (req, res) => {
  res.locals.redirectErrors = true
  return sendUpload(req, res, normaliseFilename(req.params.name))
})

app.get('/debug', (req, res) => res.json({
  'X-Forwarded-For': req.get('X-Forwarded-For') ?? null,
  'CF-Connecting-IP': req.get('CF-Connecting-IP') ?? null,
  'X-Real-IP': req.get('X-Real-IP') ?? null,
  'req.socket.remoteAddress': req.socket.remoteAddress,
  'req.ip': req.ip,
  'req.ips': req.ips,
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
setInterval(cleanupExpired, 60 * 60_000)

app.listen(PORT, HOST, () => {
  console.log(`API listening at http://${HOST}:${PORT} (${s3 ? `S3 bucket ${bucket}` : `local storage at ${path.relative(process.cwd(), dataDir)}`})`)
})
