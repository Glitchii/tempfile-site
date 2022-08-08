import express from 'express';
import path from 'path';
import multer from 'multer';
import bcrypt from 'bcrypt';
import cookies from 'cookies';
import randomWords from 'random-words';
import rateLimit from 'express-rate-limit';

import { lookFor, chooseName, checkIP, S3, __dirname as assets } from './assets/components.js';
import { router as apiRouter } from './routes/api/index.js';

const app = express();
const PORT = process.env.PORT || 65535;
const rateMsg = "Too many requests, chill out.";
const limiter = rateLimit({ rateMsg, windowMs: 1 * 60 * 1000, max: 30, headers: true });

app.set('view engine', 'ejs');
app.use("/upload/", limiter);
app.use(cookies.express());
app.use(express.static(path.join(assets, 'static')));
app.use(express.json());
app.use('/api/', apiRouter);
app.use((req, res, next) => ((res.ip = (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',').reverse()[0]).trim()) && next());

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(assets, 'static', 'media', 'favicon.ico')));

app.get('/', (_req, res) =>
    res.render('index', {
        authKey: randomWords({ exactly: 3, maxLength: 3, join: '.' })
    }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024,
    }
})

app.post("/upload/", async (req, res) => {
    upload.single('file')(req, res, async err => {
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
            info.datetime = date, info.userIP = await bcrypt.hash(res.ip, 10);

            if ((date - new Date()) / (24 * 60 * 60 * 1000) > 31) return res.json({ err: 'Duration cannot be more than a month' });
            if (date < new Date()) return res.json({ err: 'Duration is behind' });
            if (info.limit && isNaN(info.limit)) return res.json({ err: 'The given limit isn\'t a number' });
            if (info.limit && info.limit < 1) return res.json({ err: "Limit invalid. Leave empty for unlimited" });
            if ((info.ipblacklist && info.ipblacklist.length > 5) || (info.ipwhitelist && info.ipwhitelist.length > 5)) return res.json({ err: 'I can only accept 5 IPs' });
            if (info.pass) info.pass = await bcrypt.hash(info.pass, 10);

            const ipCheck = checkIP(info.ipblacklist, info.ipwhitelist);
            const ip2Check = checkIP(info.ipwhitelist, info.ipblacklist);

            if (ipCheck) return res.json({ err: ipCheck });
            if (ip2Check) return res.json({ err: ip2Check });

            info.ipblacklist && info.ipblacklist.forEach(async (ip, i) => info.ipblacklist[i] = await bcrypt.hash(ip, 10));
            info.ipwhitelist && info.ipwhitelist.forEach(async (ip, i) => info.ipwhitelist[i] = await bcrypt.hash(ip, 10));

            const nameExt = req.file?.originalname.split('.'),
                ext = nameExt?.length > 1 ? '.' + (nameExt.pop() || 'txt') : '',
                name = await chooseName(info.name, ext) + ext,
                data = { filename: name.toLowerCase(), ...info };

            if (req.file) {
                data.buffer = req.file.buffer,
                    data.size = req.file?.size;
            };

            if (req.file?.mimetype) data.mimetype = req.file.mimetype;
            if (req.file?.contentType) data.contentType = req.file.contentType;

            S3.putObject({
                Bucket: process.env.bucket,
                Key: name.toLowerCase() + '.json',
                Body: JSON.stringify({ ...data, ...info }),
            }, err => err ? res.json({ err: 'Error uploading, file may not be uploaded.' }) : res.status(200).json({ link: name }));
        } catch (err) {
            console.error(err)
            res.status(500).send('Failed uploading file information.');
        }

    });
});

app.get("/files/:name", async (req, res) => {
    try {
        const find = await lookFor(req.params.name), hds = req.headers, cookie = req.cookies.get('_tmpfle');
        if (!find) return res.status(404).render('error', { type: 404 });
        if (find.ipblacklist)
            for (const ip of find.ipblacklist)
                if (await bcrypt.compare(res.ip, ip))
                    return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403, noKey: true }) : res.status(403).send('You are forbidden from viewing this file.');

        if (find.ipwhitelist) {
            let passed;
            for (let ip of find.ipwhitelist)
                if (await bcrypt.compare(res.ip, ip)) {
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

        if (find.limit && ((hds['sec-fetch-site'] === 'same-origin' && hds['sec-fetch-mode'] !== 'no-cors') || hds['sec-fetch-site'] !== 'same-origin'))
            if (--find.limit == 0)
                await S3.deleteObject({
                    Bucket: process.env.bucket,
                    Key: find.filename + '.json',
                }).promise();
            else
                await S3.putObject({
                    Bucket: process.env.bucket,
                    Key: find.filename + '.json',
                    Body: JSON.stringify(find)
                }).promise();
    } catch (e) {
        console.log('From /files/', e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }
});

app.post("/auth/", (req, res) => {
    lookFor(req.body.name).then(async (find, err) => {
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
    lookFor(filename).then(async (find, err) => {
        if (req.method !== "POST") {
            let cookie = req.cookies.get('_tmpfle');
            if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
            if (!find?.filename) return res.status(404).render('error', { type: 404 });
            if (!await bcrypt.compare(res.ip, find.userIP) && !cookie) return res.status(403).render('error', { code: 2, type: 403 });
            if (cookie && !await bcrypt.compare(find.pass || find.authkey, cookie)) return res.status(403).render('error', { code: 2, type: 403 });
            return res.render('delete', find);
        }
        S3.deleteObject({
            Bucket: process.env.bucket,
            Key: find.filename.toLowerCase() + '.json',
        }, err => {
            if (err) res.status(500).render('error', { code: 1, type: 500, text: 'There was an error deleting file' });
            return req.method == "GET" ? res.status(200).redirect('/') : res.status(200).send('File has been deleted');
        });
    }).catch(err => {
        console.log('From /files/delete/', err);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }), checkExpired = async () => {
        try {
            console.log('Checking for expired files');
            S3.listObjectsV2({ Bucket: process.env.bucket, }).promise()
                .then(async data => {
                    for (const item of data.Contents) {
                        const find = await lookFor(item.Key, true);
                        const stamp = new Date(find?.datetime || undefined);
                        console.log(item.LastModified, stamp, find.datetime);
                        if (!stamp || !stamp.getDate() || new Date() > stamp)
                            S3.deleteObject({
                                Bucket: process.env.bucket,
                                Key: item.Key,
                            }, err => err && console.log(`Error deleting file (${item.Key}): ${err}`));
                    }
                })
                .catch(err => console.log(`Error in main interval (promise): ${err}`))
        } catch (err) {
            console.log(`Error in main interval: ${err}`)
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