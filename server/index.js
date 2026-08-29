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

const PORT = Number(process.env.PORT || 3001)
const app = express()

const trustProxy = process.env.TRUST_PROXY
trustProxy && app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)

const distDir = path.resolve(process.cwd(), 'dist')
const dataDir = path.resolve(process.cwd(), 'data')
const filesDir = path.join(dataDir, 'files')
const metaDir = path.join(dataDir, 'meta')
const maxFileSize = 2 * 1024 * 1024 * 1024
const authCookie = 'tempfile_auth'
const authDurationMs = 15 * 60_000
const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')

const bucket = process.env.AWS_BUCKET
const s3 = bucket && new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  forcePathStyle: process.env.AWS_FORCE_PATH_STYLE === 'true',
  ...(process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL } : {}),
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSize } })

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use((_req, res, next) => next(res.setHeader('X-Powered-By', 'coffee and addiction') && null))

const ensureDirs = async () => {
  await fs.mkdir(filesDir, { recursive: true })
  await fs.mkdir(metaDir, { recursive: true })
}

const ok = (res, obj) => res.json({ ok: true, ...(obj ?? {}) })
const err = (res, status = 500, type = 'InternalServerError', message = 'There was an internal server error', usage) =>
  res.status(status).json({ ok: false, error: { type, message, ...(usage ? { usage } : {}) } })

const positiveInt = (value, fallback) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

const limitRequests = (windowMs, limit, message, options = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => err(res, 429, 'TooManyRequests', message),
    ...options,
  })

const uploadLimiter = limitRequests(
  positiveInt(process.env.UPLOAD_RATE_WINDOW_MS, 60_000),
  positiveInt(process.env.UPLOAD_RATE_LIMIT, 30),
  'Too many uploads. Please wait a moment and try again.',
)

const authLimiter = limitRequests(
  positiveInt(process.env.AUTH_RATE_WINDOW_MS, 15 * 60_000),
  positiveInt(process.env.AUTH_RATE_LIMIT, 10),
  'Too many password attempts. Please wait and try again.',
  { skipSuccessfulRequests: true },
)

const normalizeFilename = (value) => {
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

const isMissingS3Object = (error) => {
  return error?.name === 'NotFound' || error?.name === 'NoSuchKey'
}

const existsS3 = async (Key) => {
  if (!s3 || !bucket) return false
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }))
    return true
  } catch (error) {
    if (isMissingS3Object(error)) return false
    throw error
  }
}

const bodyToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray())

  const chunks = []
  for await (const chunk of body) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const getS3Object = async (Key) => {
  if (!s3 || !bucket) return null
  try {
    const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }))
    return bodyToBuffer(data.Body)
  } catch (error) {
    if (isMissingS3Object(error)) return null
    throw error
  }
}

const getS3Json = async (Key) => {
  const body = await getS3Object(Key)
  return body ? JSON.parse(body.toString('utf8')) : null
}

const readUpload = async (filename) => {
  if (s3 && bucket) {
    const meta = await getS3Json(metaKey(filename))
    if (!meta) return null

    const body = await getS3Object(fileKey(filename))
    return body ? { meta, body } : null
  }

  const mp = metaPathFor(filename)
  if (!(await existsLocal(mp))) return null
  return {
    meta: JSON.parse(await fs.readFile(mp, 'utf8')),
    body: await fs.readFile(filePathFor(filename)),
  }
}

const readMeta = async (filename) => {
  if (s3 && bucket) return getS3Json(metaKey(filename))

  const mp = metaPathFor(filename)
  return (await existsLocal(mp)) ? JSON.parse(await fs.readFile(mp, 'utf8')) : null
}

const writeUpload = async (filename, meta, body) => {
  if (s3 && bucket) {
    await Promise.all([
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileKey(filename), Body: body, ContentType: meta.mimetype || 'application/octet-stream' })),
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: metaKey(filename), Body: JSON.stringify(meta), ContentType: 'application/json' })),
    ])
    return
  }

  await ensureDirs()
  await Promise.all([
    fs.writeFile(filePathFor(filename), body),
    fs.writeFile(metaPathFor(filename), JSON.stringify(meta), 'utf8'),
  ])
}

const writeMeta = async (filename, meta) => {
  if (s3 && bucket) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: metaKey(filename), Body: JSON.stringify(meta), ContentType: 'application/json' }))
    return
  }

  await ensureDirs()
  await fs.writeFile(metaPathFor(filename), JSON.stringify(meta), 'utf8')
}

const removeUpload = async (filename) => {
  if (s3 && bucket) {
    await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey(filename) })),
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: metaKey(filename) })),
    ])
    return
  }

  await Promise.allSettled([fs.unlink(filePathFor(filename)), fs.unlink(metaPathFor(filename))])
}

const uploadExists = async (filename) => {
  if (s3 && bucket) return existsS3(metaKey(filename))
  return existsLocal(metaPathFor(filename))
}

const listMetaNames = async () => {
  if (s3 && bucket) {
    const names = []
    let ContinuationToken
    do {
      const data = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'meta/', ContinuationToken }))
      for (const item of data.Contents || []) {
        const key = item.Key || ''
        if (key.endsWith('.json')) names.push(key.slice(5, -5))
      }
      ContinuationToken = data.NextContinuationToken
    } while (ContinuationToken)
    return names
  }

  await ensureDirs()
  return (await fs.readdir(metaDir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
}

const parseDatetime = (value) => {
  if (!value || typeof value !== 'string') return null

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
  const ext = path.extname(String(name || '')).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 20)
  return ext && ext !== '.' ? ext : fallback
}

const sanitizeBaseName = (name, ext = '') => {
  if (!name) return null
  const clean = String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_.]/g, '')
    .slice(0, 180)
  if (!clean || clean === '.' || clean === '..') return null

  const safeExt = ext.toLowerCase()
  return safeExt && clean.endsWith(safeExt) ? clean.slice(0, -safeExt.length) : clean
}

const chooseName = async (preferredBase, ext) => {
  const safeExt = (ext || '').toLowerCase()
  const base = sanitizeBaseName(preferredBase, safeExt)
  const randomBase = () => crypto.randomBytes(10).toString('base64url').toLowerCase()
  const pickBase = base || randomBase()

  let candidate = `${pickBase}${safeExt}`
  if (!(await uploadExists(candidate))) return candidate

  let i = 1
  while (true) {
    candidate = `${pickBase}-${i}${safeExt}`
    if (!(await uploadExists(candidate))) return candidate
    i += 1
  }
}

const splitCsv = (value) =>
  [value]
    .flat()
    .filter(Boolean)
    .flatMap((item) => String(item).split(/\s*,\s*/g))
    .map((item) => item.trim())
    .filter(Boolean)

const validateIps = (blacklist = [], whitelist = []) => {
  for (const ip of [...blacklist, ...whitelist]) if (!isIP(ip)) return `The IP "${ip}" is invalid`
  for (const ip of blacklist) if (whitelist.includes(ip)) return `The IP "${ip}" should not be in both whitelist and blacklist`
  return null
}

const normalizeIp = (value) => {
  const ip = String(value || '')
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1]
  return mapped && isIP(mapped) === 4 ? mapped : ip
}

const getClientIp = (req) => normalizeIp(req.ip)

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
  requesterRequiresDeleteKey: normalizeIp(meta.userIP) !== normalizeIp(clientIp),
})

app.post('/api/files', uploadLimiter, (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    try {
      const uploadInfo = process.env.UPLOAD_INFO
      if (uploadInfo) return err(res, 400, 'UploadDisabled', uploadInfo)
      if (uploadError?.code === 'LIMIT_FILE_SIZE') return err(res, 400, 'FileTooLarge', 'File is too large.')
      if (uploadError) return err(res, 400, 'UploadError', 'There was an error while processing the file')

      const text = typeof req.body?.text === 'string' ? req.body.text : ''
      if (!req.file && !text.trim()) return err(res, 400, 'MissingFile', 'No file or text received')
      if (!req.body?.datetime) return err(res, 400, 'MissingDateTime', "Request must include a 'datetime' key", `${publicOrigin(req)}/api/files`)

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
      const ext = req.file ? extensionFor(originalname) : extensionFor(req.body.name, '.txt')
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
        ...(typeof limit === 'number' ? { limit: Math.trunc(limit) } : {}),
        ...(ipblacklist.length ? { ipblacklist } : {}),
        ...(ipwhitelist.length ? { ipwhitelist } : {}),
      }

      await writeUpload(filename, meta, body)

      ok(res, {
        link,
        authkey,
        deletion: `To delete, make a DELETE request to ${publicOrigin(req)}/api/files/${filename} with an authkey header. ${publicOrigin(req)}/api#delete`,
      })
    } catch (error) {
      console.error('POST /api/files', error)
      return err(res)
    }
  })
})

const canAccessByIp = (clientIp, meta) => {
  const ip = normalizeIp(clientIp)

  if (Array.isArray(meta.ipblacklist) && meta.ipblacklist.some((item) => normalizeIp(item) === ip))
    return false

  if (Array.isArray(meta.ipwhitelist) && !meta.ipwhitelist.some((item) => normalizeIp(item) === ip))
    return false

  return true
}

const decrementLimit = async (filename, meta) => {
  if (Number.isFinite(meta.limit))
    (meta.limit -= 1) <= 0 ? removeUpload(filename) : writeMeta(filename, meta)
}

const sendUpload = async (req, res, filename) => {
  try {
    if (!filename)
      return browserError(res, 404)

    const found = await readUpload(filename)
    if (!found)
      return browserError(res, 404)

    const { meta, body } = found
    const exp = new Date(meta.datetime)
    if (Number.isNaN(exp.getTime()) || Date.now() > exp.getTime()) {
      await removeUpload(filename)
      return browserError(res, 404)
    }

    if (!canAccessByIp(getClientIp(req), meta)) return browserError(res, 403)

    if (meta.pass && !hasBrowserAuth(req, filename)) {
      const supplied = req.headers.pass
      if (typeof supplied !== 'string' || !(await bcrypt.compare(supplied, meta.pass)))
        return res.redirect(302, `/auth/${encodeURIComponent(filename)}`)
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', meta.mimetype || 'application/octet-stream')
    res.setHeader('Content-Length', body.length)
    res.send(body)
    void decrementLimit(filename, meta).catch((error) => console.error('decrement limit', error))
  } catch (error) {
    console.error('GET file', error)
    return browserError(res, 500)
  }
}

app.get('/api/files/:name/info', async (req, res) => {
  try {
    let filename, meta, exp;

    if (!(filename = normalizeFilename(req.params.name)))
      return err(res, 400, 'InvalidFilename', 'File name is invalid')

    if (!(meta = await readMeta(filename)))
      return err(res, 404, 'NotFound', 'File not found')

    if (!Number.isFinite(exp = new Date(meta.datetime).getTime()) || Date.now() > exp) {
      await removeUpload(filename)
      return err(res, 404, 'NotFound', 'File not found')
    }

    ok(res, { file: publicMeta(meta, getClientIp(req)) })
  } catch (error) {
    console.error('GET /api/files/:name/info', error)
    return err(res)
  }
})

app.post('/api/files/:name/auth', authLimiter, async (req, res) => {
  try {
    let filename, meta, exp, password;

    if (!(filename = normalizeFilename(req.params.name)))
      return err(res, 400, 'InvalidFilename', 'File name is invalid')

    if (!(meta = await readMeta(filename)))
      return err(res, 404, 'NotFound', 'File not found')

    if (!Number.isFinite(exp = new Date(meta.datetime).getTime()) || Date.now() > exp) {
      await removeUpload(filename)
      return err(res, 404, 'NotFound', 'File not found')
    }

    if (!canAccessByIp(getClientIp(req), meta))
      return err(res, 403, 'Forbidden', 'You are not allowed to access this file.')

    if (!meta.pass)
      return err(res, 409, 'PasswordNotRequired', 'This file is not password protected')

    if (!(password = typeof req.body?.password === 'string' ? req.body.password : ''))
      return err(res, 400, 'MissingPassword', 'Enter the file password')

    if (Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, meta.pass)))
      return err(res, 401, 'WrongPass', 'Incorrect password')

    setBrowserAuth(req, res, filename)
    res.setHeader('Cache-Control', 'no-store')
    ok(res, { link: `/files/${encodeURIComponent(filename)}` })
  } catch (error) {
    console.error('POST /api/files/:name/auth', error)
    return err(res)
  }
})

app.delete('/api/files/:name', async (req, res) => {
  try {
    let filename, meta, key = req.headers.authkey;

    if (!(filename = normalizeFilename(req.params.name)))
      return err(res, 400, 'InvalidFilename', 'File name is invalid')

    if (!(meta = await readMeta(filename)))
      return err(res, 404, 'NotFound', 'File not found')

    if (getClientIp(req) !== normalizeIp(meta.userIP)) {
      if (!key || typeof key !== 'string')
        return err(res, 400, 'MissingAuthKey', "An 'authkey' header with the auth key is required")

      if (key !== meta.authkey)
        return err(res, 400, 'BadAuthKey', 'Incorrect auth key received')
    }

    await removeUpload(filename)
    ok(res)
  } catch (error) {
    console.error('DELETE /api/files', error)
    return err(res)
  }
})

app.get('/api/health', (_req, res) => ok(res))

app.all(/^\/api\/.+/, (_req, res) => err(res, 404, 'NotFound', 'API route not found'))

app.get('/files/:name', (req, res) => sendUpload(req, res, normalizeFilename(req.params.name)))

app.get('/contact', (_req, res) => res.redirect(302, 'https://github.com/Glitchii/'))

app.get('/debug', (req, res) => res.json({
  xff: req.headers['x-forwarded-for'],
  cfip: req.headers['cf-connecting-ip'],
  socket: req.socket.remoteAddress,
  reqIp: req.ip,
}))

const cleanupExpired = async () => {
  try {
    const now = Date.now()
    for (const filename of await listMetaNames()) {
      const meta = await readMeta(filename)
      const exp = new Date(meta?.datetime).getTime()
      if (!Number.isFinite(exp) || exp <= now) await removeUpload(filename)
    }
  } catch (error) {
    console.error('cleanupExpired', error)
  }
}

app.use(express.static(distDir))
app.get(/.*/, (_req, res) => {
  return res.sendFile(path.join(distDir, 'index.html'))
})

cleanupExpired()
setInterval(cleanupExpired, 60_000).unref()

if (process.env.NODE_ENV === 'production') {
  process.env.AUTH_SECRET || console.warn('AUTH_SECRET is not set; browser auth cookies will reset after each restart')
  bucket || console.warn('AWS_BUCKET is not set; uploads are using local storage')
  process.env.PUBLIC_ORIGIN || console.warn('PUBLIC_ORIGIN is not set; generated links depend on proxy headers')
}

app.listen(PORT, () => {
  console.log(`API listening at http://0.0.0.0:${PORT} (${s3 ? `S3 bucket ${bucket}` : `local storage at ${path.relative(process.cwd(), dataDir)}`})`)
})
