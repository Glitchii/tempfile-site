import express from 'express'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const PORT = Number(process.env.PORT || 3001)

const app = express()
app.set('trust proxy', true)

const dataDir = path.resolve(process.cwd(), 'data')
const filesDir = path.join(dataDir, 'files')
const metaDir = path.join(dataDir, 'meta')

const ensureDirs = async () => {
  await fs.mkdir(filesDir, { recursive: true })
  await fs.mkdir(metaDir, { recursive: true })
}

const ok = (res, obj) => res.json({ ok: true, ...(obj ?? {}) })
const err = (res, status, type, message, usage) =>
  res.status(status || 500).json({
    ok: false,
    error: {
      type: type || 'InternalServerError',
      message: message || 'There was an internal server error',
      ...(usage ? { usage } : {}),
    },
  })

const parseDatetime = (value) => {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()
  const digit = Number(trimmed.replace(/\D+$/, ''))
  const now = new Date()

  const date =
    trimmed.endsWith('m')
      ? new Date(now.getTime() + digit * 60_000)
      : trimmed.endsWith('h')
        ? new Date(now.getTime() + digit * 60 * 60_000)
        : trimmed.endsWith('d')
          ? new Date(now.getTime() + digit * 24 * 60 * 60_000)
          : trimmed.endsWith('w')
            ? new Date(now.getTime() + digit * 7 * 24 * 60 * 60_000)
            : trimmed.endsWith('mo')
              ? new Date(new Date(now).setMonth(now.getMonth() + digit))
              : new Date(trimmed)

  if (!date || Number.isNaN(date.getTime())) return null

  const minDate = new Date(now.getTime() + 60_000)
  const maxDate = new Date(new Date(now).setMonth(now.getMonth() + 1))

  if (date < minDate) return 0
  if (date > maxDate) return 1

  return date
}

const sanitizeBaseName = (name) => {
  if (!name) return null
  const s = String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_\.]/g, '')
  return s || null
}

const splitCsv = (value) =>
  String(value)
    .split(/\s*,\s*/g)
    .map((x) => x.trim())
    .filter(Boolean)

const metaPathFor = (filename) => path.join(metaDir, `${filename}.json`)
const filePathFor = (filename) => path.join(filesDir, filename)

const exists = async (p) => {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

const chooseName = async (preferredBase, ext) => {
  const base = sanitizeBaseName(preferredBase)
  const safeExt = (ext || '').toLowerCase()

  const randomBase = () => crypto.randomBytes(10).toString('base64url').toLowerCase()

  const pickBase = base || randomBase()
  let candidate = `${pickBase}${safeExt}`

  if (!(await exists(metaPathFor(candidate)))) return candidate

  let i = 1
  while (true) {
    const next = `${pickBase}-${i}${safeExt}`
    if (!(await exists(metaPathFor(next)))) return next
    i += 1
  }
}

const getClientIp = (req) => {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim()
  return req.ip
}

const readMeta = async (filename) => {
  const mp = metaPathFor(filename)
  if (!(await exists(mp))) return null
  const raw = await fs.readFile(mp, 'utf8')
  return JSON.parse(raw)
}

const writeMeta = async (filename, meta) => {
  await fs.writeFile(metaPathFor(filename), JSON.stringify(meta), 'utf8')
}

const removeFile = async (filename) => {
  await Promise.allSettled([fs.unlink(filePathFor(filename)), fs.unlink(metaPathFor(filename))])
}

const upload = multer({ storage: multer.memoryStorage() })

app.post('/api/files', upload.single('file'), async (req, res) => {
  try {
    await ensureDirs()

    if (!req.file) return err(res, 400, 'MissingFile', 'No file recieved')

    if (!req.body?.datetime)
      return err(res, 400, 'MissingDateTime', "Request must include a 'datetime' key", `${req.protocol}://${req.get('host')}/api/files`)

    const chosenDate = parseDatetime(req.body.datetime)

    if (chosenDate === 0) return err(res, 400, 'TooLow', 'Time must be atleast a minute ahead')
    if (chosenDate === 1) return err(res, 400, 'TooHigh', 'Given date or time is over the limit')
    if (!chosenDate) return err(res, 400, 'InvalidDate', 'Given date or time is invalid')

    const ipblacklist = req.body.ipblacklist ? splitCsv(req.body.ipblacklist) : undefined
    const ipwhitelist = req.body.ipwhitelist ? splitCsv(req.body.ipwhitelist) : undefined

    if (ipblacklist && ipblacklist.length > 5) return err(res, 400, 'IPLimitExceeded', 'Only up to 5 IPs allowed')
    if (ipwhitelist && ipwhitelist.length > 5) return err(res, 400, 'IPLimitExceeded', 'Only up to 5 IPs allowed')

    const limitRaw = req.body.limit
    const limit = limitRaw ? Number(limitRaw) : undefined
    if (limitRaw && (!Number.isFinite(limit) || limit <= 0)) return err(res, 400, 'InvalidLimit', 'Limit must be a number more than 0')

    const ext = path.extname(req.file.originalname || '').toLowerCase() || ''
    const filename = await chooseName(req.body.name, ext)

    const authkey = (req.body.authkey && String(req.body.authkey).trim()) || crypto.randomBytes(9).toString('base64url')

    const pass = req.body.pass ? String(req.body.pass) : undefined
    const passHash = pass ? await bcrypt.hash(pass, 10) : undefined

    const meta = {
      filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      createdAt: new Date().toISOString(),
      datetime: chosenDate.toISOString(),
      userIP: getClientIp(req),
      authkey,
      ...(passHash ? { pass: passHash } : {}),
      ...(typeof limit === 'number' ? { limit: Math.trunc(limit) } : {}),
      ...(ipblacklist ? { ipblacklist } : {}),
      ...(ipwhitelist ? { ipwhitelist } : {}),
      hex: crypto.createHash('md5').update(req.file.buffer).digest('hex'),
      userAgent: req.headers['user-agent'],
    }

    await fs.writeFile(filePathFor(filename), req.file.buffer)
    await writeMeta(filename, meta)

    ok(res, { link: `${req.protocol}://${req.get('host')}/files/${filename}`, authkey })
  } catch (e) {
    return err(res)
  }
})

const canAccessByIp = (clientIp, meta) => {
  if (meta.ipblacklist && Array.isArray(meta.ipblacklist)) {
    for (const ip of meta.ipblacklist) if (clientIp === ip) return false
  }

  if (meta.ipwhitelist && Array.isArray(meta.ipwhitelist)) {
    for (const ip of meta.ipwhitelist) if (clientIp === ip) return true
    return false
  }

  return true
}

const sendFileByName = async (req, res, filename, isApi) => {
  try {
    const meta = await readMeta(filename)
    if (!meta) return isApi ? err(res, 404, 'NotFound', 'File not found') : res.status(404).send('File not found')

    const now = new Date()
    const exp = new Date(meta.datetime)
    if (Number.isNaN(exp.getTime()) || now > exp) {
      await removeFile(filename)
      return isApi ? err(res, 404, 'NotFound', 'File not found') : res.status(404).send('File not found')
    }

    const clientIp = getClientIp(req)
    if (!canAccessByIp(clientIp, meta)) {
      return isApi
        ? err(res, 403, 'Forbidden', 'You are not allowed to access this file.')
        : res.status(403).send('You are not allowed to access this file.')
    }

    if (meta.pass) {
      const supplied = req.headers.pass
      if (!supplied || typeof supplied !== 'string') {
        return isApi
          ? err(res, 403, 'NoPass', "File requires password. A header with a key 'pass' with the password as value is required")
          : res.status(403).send("This file requires a password. Use the API with a 'pass' header.")
      }

      const matches = await bcrypt.compare(supplied, meta.pass)
      if (!matches) {
        return isApi ? err(res, 403, 'WrongPass', 'Incorrect password recieved') : res.status(403).send('Incorrect password')
      }
    }

    res.setHeader('Content-Type', meta.mimetype || 'application/octet-stream')
    res.sendFile(filePathFor(filename))

    if (meta.limit && Number.isFinite(meta.limit)) {
      meta.limit -= 1
      if (meta.limit <= 0) await removeFile(filename)
      else await writeMeta(filename, meta)
    }
  } catch {
    return isApi ? err(res) : res.status(500).send('Internal server error')
  }
}

app.get('/api/files/:name', (req, res) => sendFileByName(req, res, req.params.name, true))
app.delete('/api/files/:name', async (req, res) => {
  try {
    const filename = req.params.name
    const meta = await readMeta(filename)
    if (!meta) return err(res, 404, 'NotFound', 'File not found')

    const clientIp = getClientIp(req)

    if (clientIp !== meta.userIP) {
      const key = req.headers.authkey
      if (!key || typeof key !== 'string') return err(res, 400, 'MissingAuthKey', "An 'authkey' header with the auth key is required")
      if (key !== meta.authkey) return err(res, 400, 'BadAuthKey', 'Incorrect auth key recieved')
    }

    await removeFile(filename)
    ok(res)
  } catch {
    return err(res)
  }
})

app.get('/files/:name', (req, res) => sendFileByName(req, res, req.params.name, false))

const cleanupExpired = async () => {
  try {
    await ensureDirs()
    const entries = await fs.readdir(metaDir)
    const now = Date.now()

    await Promise.all(
      entries
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const filename = f.slice(0, -'.json'.length)
          const meta = await readMeta(filename)
          if (!meta?.datetime) return
          const exp = new Date(meta.datetime).getTime()
          if (!Number.isFinite(exp) || exp <= now) await removeFile(filename)
        }),
    )
  } catch {
    return
  }
}

cleanupExpired()
setInterval(cleanupExpired, 60_000)

app.listen(PORT, () => {
  console.log(`API listening at http://0.0.0.0:${PORT}`)
})
