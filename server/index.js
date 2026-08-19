import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { isIP } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'

dotenv.config()

const PORT = Number(process.env.PORT || 3001)
const app = express()
app.set('trust proxy', true)
app.disable('x-powered-by')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(process.cwd(), 'data')
const filesDir = path.join(dataDir, 'files')
const metaDir = path.join(dataDir, 'meta')
const distDir = path.resolve(process.cwd(), 'dist')
const maxFileSize = 2 * 1024 * 1024 * 1024

const bucket = process.env.AWS_BUCKET
const s3 = bucket
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      forcePathStyle: process.env.AWS_FORCE_PATH_STYLE !== 'false',
      ...(process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL } : {}),
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    })
  : null

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSize } })

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const ensureDirs = async () => {
  await fs.mkdir(filesDir, { recursive: true })
  await fs.mkdir(metaDir, { recursive: true })
}

const ok = (res, obj) => res.json({ ok: true, ...(obj ?? {}) })
const err = (res, status = 500, type = 'InternalServerError', message = 'There was an internal server error', usage) =>
  res.status(status).json({ ok: false, error: { type, message, ...(usage ? { usage } : {}) } })

const metaKey = (filename) => `meta/${filename}.json`
const fileKey = (filename) => `files/${filename}`
const legacyKey = (filename) => `${filename}.json`
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

const existsS3 = async (Key) => {
  if (!s3 || !bucket) return false
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }))
    return true
  } catch {
    return false
  }
}

const bodyToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray())

  const chunks = []
  for await (const chunk of body) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const getS3Json = async (Key) => {
  if (!s3 || !bucket) return null
  try {
    const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }))
    return JSON.parse((await bodyToBuffer(data.Body)).toString('utf8'))
  } catch {
    return null
  }
}

const legacyBody = (meta) => {
  if (meta?.body) return Buffer.from(meta.body, meta.encoding === 'base64' ? 'base64' : 'utf8')
  if (typeof meta?.text === 'string') return Buffer.from(meta.text)
  if (meta?.buffer?.type === 'Buffer' && Array.isArray(meta.buffer.data)) return Buffer.from(meta.buffer.data)
  if (Array.isArray(meta?.buffer)) return Buffer.from(meta.buffer)
  return Buffer.alloc(0)
}

const readUpload = async (filename) => {
  if (s3 && bucket) {
    const meta = await getS3Json(metaKey(filename))
    if (meta) {
      const file = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: fileKey(filename) }))
      return { meta, body: await bodyToBuffer(file.Body), legacy: false }
    }

    const legacy = await getS3Json(legacyKey(filename))
    return legacy ? { meta: legacy, body: legacyBody(legacy), legacy: true } : null
  }

  const mp = metaPathFor(filename)
  if (!(await existsLocal(mp))) return null
  return {
    meta: JSON.parse(await fs.readFile(mp, 'utf8')),
    body: await fs.readFile(filePathFor(filename)),
    legacy: false,
  }
}

const readMeta = async (filename) => {
  if (s3 && bucket) return (await getS3Json(metaKey(filename))) || (await getS3Json(legacyKey(filename)))
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

const writeMeta = async (filename, meta, legacy = false) => {
  if (s3 && bucket) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: legacy ? legacyKey(filename) : metaKey(filename), Body: JSON.stringify(meta), ContentType: 'application/json' }))
    return
  }

  await ensureDirs()
  await fs.writeFile(metaPathFor(filename), JSON.stringify(meta), 'utf8')
}

const removeUpload = async (filename) => {
  if (s3 && bucket) {
    await Promise.allSettled([
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey(filename) })),
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: metaKey(filename) })),
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: legacyKey(filename) })),
    ])
    return
  }

  await Promise.allSettled([fs.unlink(filePathFor(filename)), fs.unlink(metaPathFor(filename))])
}

const uploadExists = async (filename) => {
  if (s3 && bucket) return (await existsS3(metaKey(filename))) || (await existsS3(legacyKey(filename)))
  return existsLocal(metaPathFor(filename))
}

const listMetaNames = async () => {
  if (s3 && bucket) {
    const names = []
    let ContinuationToken
    do {
      const data = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }))
      for (const item of data.Contents || []) {
        const key = item.Key || ''
        if (key.startsWith('meta/') && key.endsWith('.json')) names.push(key.slice(5, -5))
        else if (!key.includes('/') && key.endsWith('.json')) names.push(key.slice(0, -5))
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

const sanitizeBaseName = (name, ext = '') => {
  if (!name) return null
  const clean = String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_.]/g, '')
  if (!clean) return null

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

const getClientIp = (req) => {
  const cf = req.headers['cf-connecting-ip']
  const real = req.headers['x-real-ip']
  const forwarded = req.headers['x-forwarded-for']
  if (typeof cf === 'string' && cf) return cf
  if (typeof real === 'string' && real) return real
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req.ip
}

const publicOrigin = (req) => process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`

const publicMeta = (meta) => ({
  filename: meta.filename,
  originalname: meta.originalname,
  mimetype: meta.mimetype,
  size: meta.size,
  createdAt: meta.createdAt,
  datetime: meta.datetime,
  limit: meta.limit,
  hasPassword: Boolean(meta.pass),
  ipRestricted: Boolean(meta.ipblacklist?.length || meta.ipwhitelist?.length),
})

app.post('/api/files', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    try {
      const uploadInfo = process.env.UPLOAD_INFO || process.env.uploadInfo
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
      if (limitRaw && (!Number.isFinite(limit) || limit <= 0)) return err(res, 400, 'InvalidLimit', 'Limit must be a number more than 0')

      const body = req.file?.buffer || Buffer.from(text)
      const originalname = req.file?.originalname || 'text.txt'
      const ext = req.file ? path.extname(originalname).toLowerCase() : path.extname(req.body.name || '') || '.txt'
      const filename = await chooseName(req.body.name, ext)
      const passHash = req.body.pass ? await bcrypt.hash(String(req.body.pass), 10) : undefined
      const authkey = (req.body.authkey && String(req.body.authkey).trim()) || crypto.randomBytes(9).toString('base64url')

      const meta = {
        filename,
        originalname,
        mimetype: req.file?.mimetype || 'text/plain; charset=utf-8',
        size: body.length,
        createdAt: new Date().toISOString(),
        datetime: chosenDate.toISOString(),
        userIP: getClientIp(req),
        authkey,
        hex: crypto.createHash('md5').update(body).digest('hex'),
        userAgent: req.headers['user-agent'],
        ...(text && !req.file ? { text: true } : {}),
        ...(passHash ? { pass: passHash } : {}),
        ...(typeof limit === 'number' ? { limit: Math.trunc(limit) } : {}),
        ...(ipblacklist.length ? { ipblacklist } : {}),
        ...(ipwhitelist.length ? { ipwhitelist } : {}),
      }

      await writeUpload(filename, meta, body)
      ok(res, { link: `${publicOrigin(req)}/files/${filename}`, authkey })
    } catch (error) {
      console.error('POST /api/files', error)
      return err(res)
    }
  })
})

const canAccessByIp = (clientIp, meta) => {
  if (Array.isArray(meta.ipblacklist) && meta.ipblacklist.includes(clientIp)) return false
  if (Array.isArray(meta.ipwhitelist) && !meta.ipwhitelist.includes(clientIp)) return false
  return true
}

const decrementLimit = async (filename, meta, legacy) => {
  if (!meta.limit || !Number.isFinite(meta.limit)) return
  meta.limit -= 1
  if (meta.limit <= 0) await removeUpload(filename)
  else await writeMeta(filename, meta, legacy)
}

const sendUpload = async (req, res, filename, isApi) => {
  try {
    const found = await readUpload(filename)
    if (!found) return isApi ? err(res, 404, 'NotFound', 'File not found') : res.status(404).send('File not found')

    const { meta, body, legacy } = found
    const exp = new Date(meta.datetime)
    if (Number.isNaN(exp.getTime()) || Date.now() > exp.getTime()) {
      await removeUpload(filename)
      return isApi ? err(res, 404, 'NotFound', 'File not found') : res.status(404).send('File not found')
    }

    if (!canAccessByIp(getClientIp(req), meta)) {
      return isApi ? err(res, 403, 'Forbidden', 'You are not allowed to access this file.') : res.status(403).send('You are not allowed to access this file.')
    }

    if (meta.pass) {
      const supplied = req.headers.pass
      if (!supplied || typeof supplied !== 'string') {
        return isApi
          ? err(res, 403, 'NoPass', "File requires password. A header with a key 'pass' with the password as value is required")
          : res.status(403).send("This file requires a password. Use the API with a 'pass' header.")
      }
      if (!(await bcrypt.compare(supplied, meta.pass))) {
        return isApi ? err(res, 403, 'WrongPass', 'Incorrect password received') : res.status(403).send('Incorrect password')
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', meta.mimetype || 'application/octet-stream')
    res.setHeader('Content-Length', body.length)
    res.send(body)
    void decrementLimit(filename, meta, legacy).catch((error) => console.error('decrement limit', error))
  } catch (error) {
    console.error('GET file', error)
    return isApi ? err(res) : res.status(500).send('Internal server error')
  }
}

app.get('/api/files/:name', (req, res) => sendUpload(req, res, req.params.name.toLowerCase(), true))

app.get('/api/files/:name/info', async (req, res) => {
  try {
    const filename = req.params.name.toLowerCase()
    const meta = await readMeta(filename)
    if (!meta) return err(res, 404, 'NotFound', 'File not found')

    const exp = new Date(meta.datetime).getTime()
    if (!Number.isFinite(exp) || Date.now() > exp) {
      await removeUpload(filename)
      return err(res, 404, 'NotFound', 'File not found')
    }

    ok(res, { file: publicMeta(meta) })
  } catch (error) {
    console.error('GET /api/files/:name/info', error)
    return err(res)
  }
})

app.delete('/api/files/:name', async (req, res) => {
  try {
    const filename = req.params.name.toLowerCase()
    const meta = await readMeta(filename)
    if (!meta) return err(res, 404, 'NotFound', 'File not found')

    if (getClientIp(req) !== meta.userIP) {
      const key = req.headers.authkey
      if (!key || typeof key !== 'string') return err(res, 400, 'MissingAuthKey', "An 'authkey' header with the auth key is required")
      if (key !== meta.authkey) return err(res, 400, 'BadAuthKey', 'Incorrect auth key received')
    }

    await removeUpload(filename)
    ok(res)
  } catch (error) {
    console.error('DELETE /api/files', error)
    return err(res)
  }
})

app.get('/files/:name', (req, res) => sendUpload(req, res, req.params.name.toLowerCase(), false))
app.get('/contact', (_req, res) => res.redirect(302, 'https://github.com/Glitchii/'))

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

try {
  await fs.access(path.join(distDir, 'index.html'))
  app.use(express.static(distDir))
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
} catch {
  app.get('/', (_req, res) => res.status(404).send('Run the Vite dev server for the React app, or build the frontend first.'))
}

cleanupExpired()
setInterval(cleanupExpired, 60_000)

app.listen(PORT, () => {
  console.log(`API listening at http://0.0.0.0:${PORT} (${s3 ? `S3 bucket ${bucket}` : `local storage at ${path.relative(process.cwd(), dataDir)}`})`)
})
