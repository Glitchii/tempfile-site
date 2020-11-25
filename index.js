require('dotenv').config();
const { lookFor, chooseName, checkIP } = require('./assets/components'),
    { MongoClient, ObjectId, GridFSBucket } = require('mongodb'),
    GridFsStorage = require('multer-gridfs-storage'),
    dbClient = new MongoClient(process.env.DBURI, {
        useUnifiedTopology: 1, useNewUrlParser: 1
    }),
    randomWords = require("random-words"),
    PORT = process.env.PORT || 2020,
    mongoURI = process.env.DBURI,
    cookies = require('cookies'),
    express = require('express'),
    bcrypt = require('bcrypt'),
    multer = require('multer'),
    path = require('path'),
    app = express();


dbClient.connect().then(async (_res, err) => {
    if (err) throw err;
    db = dbClient.db('db'), files = db.collection('data.files'), chunks = db.collection('data.chunks'), gfs = new GridFSBucket(db, { bucketName: "data" });
    if (!await files.indexExists('datetime_1')) files.createIndex({ datetime: 1 }, { expireAfterSeconds: 0 });

    files.watch().on('change', next => {
        if (next.operationType == 'delete') {
            chunks.findOneAndDelete({ files_id: next.documentKey._id }, (err, _res) => {
                if (err) throw err;
            })
        }
    });
});

app.use(cookies.express());
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use('/api/', require('./routes/api/index'));
app.get('/', (_req, res) => res.render('index', { authKey: randomWords({ exactly: 3, maxLength: 3, join: '.' }) }));

app.post("/upload/:name?", async (req, res) => {
    let name = await chooseName(req.params.name ? Buffer.from(req.params.name, 'base64').toString('utf-8') : null);
    multer({
        storage: new GridFsStorage({
            url: mongoURI,
            file: (_req, file) => {
                return {
                    filename: (name + path.extname(file.originalname)),
                    bucketName: 'data'
                };
            }
        })
    }).single('file')(req, res, async (err) => {
        if (err) return res.status(500).send(err);
        if (!req.file) return res.status(505).send('Looks like you never added a file.');
        if (req.fileValidationError) return res.send(req.fileValidationError);

        try {
            var info = JSON.parse(req.body.data), date = new Date(info.datetime);
            info.datetime = date; info.userIP = req.ip;
            if (!!!new Date(info.datetime).getDate()) return res.status(417).send('Given date is invalid');
            if (info.limit && isNaN(info.limit)) return res.status(417).send('The given limit isn\'t a number');
            if (info.limit && info.limit < 1) return res.status(417).send("Limit invalid. Leave empty for unlimited");
            if ((info.ipblacklist && info.ipblacklist.length > 5) || (info.ipwhitelist && info.ipwhitelist.length > 5)) return res.status(417).send('I can only accept 5 IPs');
            if (info.pass) info.pass = await bcrypt.hash(info.pass, 10);

            let ipCheck = checkIP(info.ipblacklist, info.ipwhitelist),
                ip2Check = checkIP(info.ipwhitelist, info.ipblacklist);

            if (ipCheck) return res.status(417).send(ipCheck);
            if (ip2Check) return res.status(417).send(ip2Check);
            await files.findOneAndUpdate({ filename: req.file.filename }, { $set: info });
            return res.status(200).json({ link: req.file.filename });
        } catch (err) {
            res.status(500).send('Failed adding info to database');
            gfs.delete(ObjectId(req.file.id || req.file._id)).catch(err => console.log(err));
        }
    });
});

app.get("/files/:name", async (req, res) => {
    try {
        let find = await lookFor(req.params.name), hds = req.headers, cookie = req.cookies.get('_tmpfle');
        if (!find) return res.status(404).render('error', { type: 404 });
        if (find.ipblacklist && find.ipblacklist.includes(req.ip) || find.ipwhitelist && !find.ipwhitelist.includes(req.ip)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
        if (find.pass) {
            if (!cookie) return res.render('auth');
            if (!await bcrypt.compare(find.pass, cookie)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
            req.cookies.set('_tmpfle', '', { maxAge: 0, sameSite: 'Lax' });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        let stream = gfs.openDownloadStreamByName(find.filename).pipe(res);
        stream.on('close', async () => {
            if (find.limit && ((hds['sec-fetch-site'] === 'same-origin' && hds['sec-fetch-mode'] !== 'no-cors') || hds['sec-fetch-site'] !== 'same-origin')) {
                find.limit--;
                if (find.limit == 0) gfs.delete(ObjectId(find._id)).catch(err => console.log(err));
                else await files.findOneAndUpdate({ filename: req.params.name }, { $set: find });
            }
        });
    } catch (e) {
        console.log(e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }
});

app.post("/auth/", (req, res) =>
    lookFor(req.headers.referer.split('/').pop()).then((find, err) => {
        if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
        if (!find) return res.status(404).render('error', { type: 404 });

        bcrypt.compare(req.body.data, find.pass, async (err, rs) => {
            if (err) return res.status(500).render();
            if (!rs) return res.status(401).send('Incorect password');
            req.cookies.set('_tmpfle', (await bcrypt.hash(find.pass, 10)), { maxAge: 15000, sameSite: 'Lax' });
            res.status(200).send('Done');
        });
    }).catch(e => {
        console.log(e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    })
);

var remove = (req, res, filename) =>
    lookFor(filename).then((find, err) => {
        if (err) return res.status(500).render('error', { code: 1, type: 500, text: 'There was an error fetching file' });
        if (!find) return res.status(404).render('error', { type: 404 });
        if (find.userIP !== req.ip) return res.status(403).render('error', { code: 2, type: 403 });
        if (req.method == "GET") return res.render('delete', find);

        gfs.delete(ObjectId(find._id), (err) => {
            if (err) res.status(500).render('error', { code: 1, type: 500, text: 'There was an error deleting file' });
            return req.method == "GET" ? res.status(200).redirect('/') : res.status(200).send('File has been deleted');
        });
    }).catch(err => {
        console.log(err);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    });

app.route("/del/:name?")
    .get((req, res) => req.params.name ? remove(req, res, req.params.name) : res.render('deleteSearch'))
    .post((req, res) => remove(req, res, req.params.name || req.headers.referer.split('/')[req.headers.referer.split('/').length - 1]))

app.get("/forbidden/:code?", (req, res) => res.render('error', { code: req.params.code, type: 403 }));
app.get('/contact', (_req, res) => res.status(302).redirect('https://github.com/Glitchii/'));
app.use((_req, res, _next) => res.status(404).render('error', { type: 404 }));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));