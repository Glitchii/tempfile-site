require('dotenv').config();
const { lookFor, chooseName, checkIP, logger } = require('./assets/components'),
    randomWords = require("random-words"),
    PORT = process.env.PORT || 2020,
    cookies = require('cookies'),
    express = require('express'),
    bcrypt = require('bcrypt'),
    multer = require('multer'),
    path = require('path'),
    app = express(),
    AWS = require('aws-sdk'),
    S3 = new AWS.S3({
        accessKeyId: process.env.ID,
        secretAccessKey: process.env.secret
    });

app.use(cookies.express());
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use('/api/', require('./routes/api/index'));
app.get('/', (_req, res) => res.render('index', { authKey: randomWords({ exactly: 3, maxLength: 3, join: '.' }) }));
app.use((req, res, next) => (res.ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0]) && next());

app.post("/upload/", async (req, res) => {
    multer({
        storage: multer.memoryStorage({
            destination: (req, file, callback) => callback(null, '')
        })
    }).single('file')(req, res, async (err) => {
        if (err || req.fileValidationError) return res.json({ err: 'There was an internal error' });
        if (!req.file) return res.json({ err: 'No file received' });
        try {
            let info = JSON.parse(req.body.data);
            info.datetime = new Date(info.datetime), info.userIP = res.ip;
            if (!info.datetime.getDate()) return res.json({ err: 'Timestamp is invalid' });
            if ((info.datetime - new Date()) / (24 * 60 * 60 * 1000) > 31) return res.json({ err: 'Duration cannot be more than a month' });
            if (info.datetime < new Date()) return res.json({ err: 'Duration is behind' });
            if (info.limit && isNaN(info.limit)) return res.json({ err: 'The given limit isn\'t a number' });
            if (info.limit && info.limit < 1) return res.json({ err: "Limit invalid. Leave empty for unlimited" });
            if ((info.ipblacklist && info.ipblacklist.length > 5) || (info.ipwhitelist && info.ipwhitelist.length > 5)) return res.json({ err: 'I can only accept 5 IPs' });
            if (info.pass) info.pass = await bcrypt.hash(info.pass, 10);

            let ipCheck = checkIP(info.ipblacklist, info.ipwhitelist),
                ip2Check = checkIP(info.ipwhitelist, info.ipblacklist);
            if (ipCheck) return res.json({ err: ipCheck });
            if (ip2Check) return res.json({ err: ip2Check });

            let ext = '.' + req.file.originalname.split('.').pop(),
                name = await chooseName(info.name, ext) + ext, data = {
                    filename: name.toLowerCase(),
                    buffer: req.file.buffer,
                    size: req.file.size,
                    ...info
                };
            if (req.file.mimetype) data.mimetype = req.file.mimetype;
            if (req.file.contentType) data.contentType = req.file.contentType;

            S3.putObject({
                Bucket: process.env.bucket,
                Key: name.toLowerCase() + '.json',
                Body: JSON.stringify({ ...data, ...info }),
            }, err => err ? res.json({ err: 'Error uploading, file may not be uploaded.' }) : res.status(200).json({ link: name }));
        } catch (err) {
            console.error(err)
            res.status(500).send('Failed adding info to database');
        }
    });
});

app.get("/files/:name", async (req, res) => {
    try {
        let find = await lookFor(req.params.name), hds = req.headers, cookie = req.cookies.get('_tmpfle');
        if (!find) return res.status(404).render('error', { type: 404 });
        if (find.ipblacklist && find.ipblacklist.includes(res.ip) || find.ipwhitelist && !find.ipwhitelist.includes(res.ip)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
        if (find.pass) {
            if (!cookie) return res.render('auth');
            if (!await bcrypt.compare(find.pass, cookie)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
            req.cookies.set('_tmpfle', '', { maxAge: 0, sameSite: 'Lax' });
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.type(find.mimetype || find.contentType)
        res.end(Buffer.from(find.buffer, 'binary'));
        if (find.limit && ((hds['sec-fetch-site'] === 'same-origin' && hds['sec-fetch-mode'] !== 'no-cors') || hds['sec-fetch-site'] !== 'same-origin')) {
            find.limit--;
            if (find.limit == 0) await S3.deleteObject({
                Bucket: process.env.bucket,
                Key: find.filename + '.json',
            }).promise();
            else await S3.putObject({
                Bucket: process.env.bucket,
                Key: find.filename + '.json',
                Body: JSON.stringify(find)
            }).promise();
        };
    } catch (e) {
        logger.error('From /files/', e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }
});

app.post("/auth/", (req, res) =>
    lookFor(req.headers.referer.split('/').pop()).then(async (find, err) => {
        if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
        if (!find) return res.status(404).render('error', { type: 404 });
        if (req.body.key) {
            if (req.body.key !== find.authkey) return res.status(401).send('Incorect auth key');
        } else if (!await bcrypt.compare(req.body.data, find.pass)) return res.status(401).send('Incorect password');

        req.cookies.set('_tmpfle', (await bcrypt.hash(find.pass || find.authkey, 10)), { maxAge: 15000, sameSite: 'Lax' });
        res.status(200).send('Done');
    }).catch(e => {
        logger.error('From /auth/', e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    })
);

const remove = (req, res, filename) =>
    lookFor(filename).then(async (find, err) => {
        if (req.method !== "POST") {
            let cookie = req.cookies.get('_tmpfle');
            if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
            if (!find) return res.status(404).render('error', { type: 404 });
            if (find.userIP !== res.ip && !cookie) return res.status(403).render('error', { code: 2, type: 403 });
            if (cookie) {
                if (!await bcrypt.compare(find.pass || find.authkey, cookie)) return res.status(403).render('error', { code: 2, type: 403 });
                req.cookies.set('_tmpfle', '', { maxAge: 0, sameSite: 'Lax' });
            }
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
        logger.error('From /files/del/', err);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }), checkExpired = async () => {
        try {
            S3.listObjectsV2({ Bucket: process.env.bucket, }).promise()
                .then(data => {
                    data.Contents.map(item => item.Key).forEach(async name => {
                        let stamp = new Date((await lookFor(name, true)).datetime || undefined);
                        if (!stamp.getDate() || new Date() > stamp) {
                            S3.deleteObject({
                                Bucket: process.env.bucket,
                                Key: name,
                            }, err => err && logger.fatal(`Error deleting file (${name}): ${err}`));
                        }
                    })
                }).catch(err => logger.fatal(`Error in main interval (catch): ${err}`))
        } catch (err) {
            logger.fatal(`Error in main interval: ${err}`)
        }
    };

checkExpired() && setInterval(checkExpired, 60_000);
app.route("/del/:name?")
    .get((req, res) => req.params.name ? remove(req, res, req.params.name) : res.render('deleteSearch'))
    .post((req, res) => remove(req, res, req.params.name || req.headers.referer.split('/')[req.headers.referer.split('/').length - 1]))
app.get("/forbidden/:code?", (req, res) => res.render('error', { code: req.params.code, type: 403 }));
app.get('/contact', (_req, res) => res.status(302).redirect('https://github.com/Glitchii/'));
app.use((_req, res) => res.status(404).render('error', { type: 404 }));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));