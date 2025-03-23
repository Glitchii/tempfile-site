import express from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import cookies from 'cookies';
import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';
import { generate } from 'random-words';
import path from 'path';

import { lookFor, chooseName, checkIP, s3Client, __dirname as assets } from './assets/components.js';
import { DeleteObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { router as apiRouter } from './routes/api/index.js';

const app = express();
const PORT = process.env.PORT || 65535;
const rateMsg = "Too many requests, chill out.";
const limiter = rateLimit({ rateMsg, windowMs: 1 * 60 * 1000, max: 30, headers: true });
const manualDiscards = process.env.discard?.split(',')?.map(x => x.toLowerCase()).filter(x => x.trim());

app.set('view engine', 'ejs');

app.use(cookies.express());
app.use(requestIp.mw());
app.use((req, res, next) => {
    const ua = req.headers['user-agent']?.toLowerCase();
    return manualDiscards?.some(term => ua?.includes(term)) ? res.send() : next();
});

app.use(express.json());

// Debug middleware for static files
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Serve static files from the assets/static directory
app.use('/', express.static(path.join(assets, 'static')));

app.use((req, res, next) => {
    res.ip = req.headers['cf-ipcountry'] || req.ip || req.clientIp || (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',').pop().trim();
    next();
});

app.use("/upload/", limiter);
app.use('/api/', apiRouter);

// app.get('/favicon.ico', (req, res) => res.sendFile(path.join(assets, 'static', 'media', 'favicon.ico')));
app.get('/', (_req, res) => {
    try {
        console.log('Attempting to render index page');
        const authKey = generate({ exactly: 3, maxLength: 3}).join('.');
        console.log('Generated authKey:', authKey);
        res.render('index', { authKey }, (err, html) => {
            if (err) {
                console.error('Error rendering index:', err);
                return res.status(500).send('Error rendering page');
            }
            console.log('Successfully rendered index');
            res.send(html);
        });
    } catch (error) {
        console.error('Error in root route:', error);
        res.status(500).send('Internal server error');
    }
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024,
    }
})

app.post("/upload/", async (req, res) => {
    upload.single('file')(req, res, async err => {
        if (process.env.uploadInfo)
            return res.status(400).send({ err: process.env.uploadInfo });
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE')
                return res.status(400).send({ err: 'File is too large.' });
            return res.status(400).send({ err: 'Error fetching file' });
        }

        try {
            const info = JSON.parse(req.body.data);
            const date = !isNaN(info?.diff) && new Date(new Date().setMinutes(new Date().getMinutes() + info.diff));

            if (!info.text && !req.file) return res.json({ err: 'No file received' });
            if (!date || !date.getDate()) return res.json({ err: 'Recieved invalid date' });
            info.datetime = date, info.userIP = res.ip, info.hex = crypto.createHash('md5').update(req.file?.buffer || info.text).digest('hex'), info.userAgent = req.headers['user-agent'];
            // const found = await lookFor({ hex: info.hex });
            if ((date - new Date()) / (24 * 60 * 60 * 1000) > 7) return res.json({ err: 'At the moment, please choose a duration less than 7 days.' });
            // if ((date - new Date()) / (24 * 60 * 60 * 1000) > 7) return res.json({ err: 'Duration cannot be more than a month' });
            if (date < new Date()) return res.json({ err: 'Duration is behind' });
            if (info.limit && isNaN(info.limit)) return res.json({ err: 'The given limit isn\'t a number' });
            if (info.limit && info.limit < 1) return res.json({ err: "Limit invalid. Leave empty for unlimited" });
            if ((info.ipblacklist && info.ipblacklist.length > 5) || (info.ipwhitelist && info.ipwhitelist.length > 5)) return res.json({ err: 'I can only accept 5 IPs' });
            if (info.pass) info.pass = await bcrypt.hash(info.pass, 10);

            const ipCheck = checkIP(info.ipblacklist, info.ipwhitelist);
            const ip2Check = checkIP(info.ipwhitelist, info.ipblacklist);

            if (ipCheck) return res.json({ err: ipCheck });
            if (ip2Check) return res.json({ err: ip2Check });

            const nameExt = req.file?.originalname.split('.'),
                ext = nameExt?.length > 1 ? '.' + (nameExt.pop() || 'txt') : '',
                name = await chooseName(info.name, ext) + ext,
                data = { filename: name.toLowerCase(), ...info };

            if (req.file)
                data.buffer = req.file.buffer,
                    data.size = req.file?.size;

            if (req.file?.mimetype) data.mimetype = req.file.mimetype;
            if (req.file?.contentType) data.contentType = req.file.contentType;

            try {
                await s3Client.send(new PutObjectCommand({
                    Bucket: process.env.AWS_BUCKET,
                    Key: name.toLowerCase() + '.json',
                    Body: JSON.stringify({ ...data, ...info }),
                    StorageClass: 'GLACIER_IR',
                }));
                res.status(200).json({ link: name });
            } catch (err) {
                res.json({ err: 'Error uploading, file may not be uploaded.' });
            }
        } catch (err) {
            console.error(err)
            res.status(500).send('Failed uploading file information.');
        }

    });
});

app.get("/files/:name", async (req, res) => {
    try {
        const find = await lookFor({ Key: req.params.name }), hds = req.headers, cookie = req.cookies.get('_tmpfle');
        if (!find) return res.status(404).render('error', { type: 404 });
        if (find.ipblacklist)
            for (const ip of find.ipblacklist)
                if (res.ip === ip)
                    return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403, noKey: true }) : res.status(403).send('You are forbidden from viewing this file.');

        if (find.ipwhitelist) {
            let passed;
            for (let ip of find.ipwhitelist)
                if (res.ip === ip) {
                    passed = true;
                    break;
                }

            if (!passed && (!cookie || !await bcrypt.compare(find.pass || find.authkey, cookie)))
                return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
        }

        if (find.pass)
            if (!cookie) return res.render('auth');
            else if (!await bcrypt.compare(find.pass, cookie)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');

        cookie && req.cookies.set('_tmpfle', '', { maxAge: 0, sameSite: 'Lax' });

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (find.text)
            res.setHeader('Content-Type', 'text/plain').send(find.text);
        else
            res.type(find.mimetype || find.contentType).end(Buffer.from(find.buffer, 'binary'));

        // Access limit reached?
        if (find.limit && ((hds['sec-fetch-site'] === 'same-origin' && hds['sec-fetch-mode'] !== 'no-cors') || hds['sec-fetch-site'] !== 'same-origin'))
            if (--find.limit <= 0)
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: process.env.AWS_BUCKET,
                    Key: find.filename + '.json',
                }));
            else
                await s3Client.send(new PutObjectCommand({
                    Bucket: process.env.AWS_BUCKET,
                    Key: find.filename + '.json',
                    Body: JSON.stringify(find),
                    StorageClass: 'GLACIER_IR',
                }));
    } catch (e) {
        console.log('From /files/', e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }
});

app.post("/auth/", (req, res) => {
    lookFor({ Key: req.body.name }).then(async (find, err) => {
        if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
        if (!find) return res.status(404).render('error', { type: 404 });
        if (req.body.key !== find.authkey) return res.status(401).send('Incorect auth key');
        else if (!await bcrypt.compare(req.body.data, find.pass)) return res.status(401).send('Incorect password');

        req.cookies.set('_tmpfle', (await bcrypt.hash(find.pass || find.authkey, 10)), { maxAge: 15000, sameSite: 'Lax' });
        res.status(200).send('Done');
    }).catch(e => {
        console.log('From /auth/', e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    })
});

const remove = (req, res, filename) =>
    lookFor({ Key: filename }).then(async (find, err) => {
        if (req.method !== "POST") {
            const cookie = req.cookies.get('_tmpfle');

            if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
            if (!find?.filename) return res.status(404).render('error', { type: 404 });
            if (res.ip !== find.userIP && !cookie) return res.status(403).render('error', { code: 2, type: 403 });
            if (cookie && !await bcrypt.compare(find.pass || find.authkey, cookie)) return res.status(403).render('error', { code: 2, type: 403 });

            return res.render('delete', find);
        }

        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET,
                Key: find.filename.toLowerCase() + '.json',
            }));
            return req.method == "GET" ? res.status(200).redirect('/') : res.status(200).send('File has been deleted');
        } catch (err) {
            if (err) res.status(500).render('error', { code: 1, type: 500, text: 'There was an error deleting file' });
        }
    }).catch(err => {
        console.log('From /files/delete/', err);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }), checkExpired = async () => {
        try {
            const data = await s3Client.send(new ListObjectsV2Command({ Bucket: process.env.AWS_BUCKET }));
            // Check if Contents exists and is an array before iterating
            if (data?.Contents && Array.isArray(data.Contents)) {
                for (const item of data.Contents) {
                    const find = await lookFor({ Key: item.Key }, true);
                    const stamp = new Date(find?.datetime || undefined);

                    if (!stamp || !stamp.getDate() || new Date() > stamp)
                        try {
                            await s3Client.send(new DeleteObjectCommand({ 
                                Bucket: process.env.AWS_BUCKET, 
                                Key: item.Key 
                            }));
                        } catch (err) {
                            console.error(`Error deleting file (${item.Key}):`, err);
                        }
                }
            } else {
                console.log('No files found in bucket or bucket is empty');
            }
        } catch (err) {
            console.error('Error in main interval:', err);
        }
    };

checkExpired()
setInterval(checkExpired, 60_000);

app.get("/del/:name?", (req, res) => res.redirect(`/delete/${req.params.name || ''}`));
app.route("/delete/:name?")
    .get((req, res) => req.params.name ? remove(req, res, req.params.name) : res.render('deleteSearch'))
    .post((req, res) => remove(req, res, req.params.name || req.headers.referer.split('/').pop()))

app.get("/forbidden/:code?", (req, res) => res.render('error', { code: req.params.code, type: 403 }));

app.get('/contact', (_req, res) => res.status(302).redirect('https://github.com/Glitchii/'));

app.use((_req, res) => res.status(404).render('error', { type: 404 }));

app.disable('x-powered-by');
app.listen(PORT, () => console.log(`Listening at http://0.0.0.0:${PORT}`));