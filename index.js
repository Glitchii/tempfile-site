require('dotenv').config();
const ipRegex = require('ip-regex'),
    bcrypt = require('bcrypt'),
    multer = require('multer'),
    GridFsStorage = require('multer-gridfs-storage'),
    path = require('path'),
    express = require('express'),
    app = express(),
    cookies = require('cookies'),
    mongoURI = process.env.DBURI,
    { MongoClient, ObjectId, GridFSBucket } = require('mongodb'),
    dbClient = new MongoClient(process.env.DBURI, { useUnifiedTopology: true, useNewUrlParser: true });


dbClient.connect().then(async (res, err) => {
    if (err) throw err;
    db = dbClient.db('db'), files = db.collection('data.files'), chunks = db.collection('data.chunks'), gfs = new GridFSBucket(db, { bucketName: "data" });
    if (!await files.indexExists('dateTime_1')) files.createIndex({ dateTime: 1 }, { expireAfterSeconds: 0 });
    if (!await chunks.indexExists('dateTime_1')) chunks.createIndex({ dateTime: 1 }, { expireAfterSeconds: 0 });

    files.watch().on('change', next => {
        if (next.operationType == 'delete') {
            chunks.findOneAndDelete({ files_id: next.documentKey._id }, (err, res) => {
                if (err) throw err;
            })
        }
    });
});

const chooseName = async (filename) => {
    let name = filename ? filename.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_\.]/g, '') : null,
        findName = async (name) => {
            let arr = (await files.find({ filename: { $regex: ('^' + name + '((-\\d+)?\\..+)?$') } }).toArray()).sort((x, y) => {
                let re = new RegExp(/(?<!-\d+)\.\w+$/g), name1 = x.filename.toLowerCase().replace(/\.\w+$/, ''), name2 = y.filename.toLowerCase().replace(/\.\w+$/, '');
                if (re.test(name1) || re.test(name2)) return 0;
                else {
                    if (name1 < name2) return -1;
                    if (name1 > name2) return 1;
                }
                return 0;
            });
            return arr.length !== 0 ? arr[arr.length - 1].filename.split('.')[0] : null;
        };

    if (name && await findName(name)) {
        let found = await findName(name);
        return (found.match(/-\d+$/g) ? `${found.slice(0, -2)}-${parseInt(found.slice(-1)) + 1}` : found + '-1');
    } else if (!name) {
        let min = 1, max = 6, check = async () => {
            let name2 = [...Array(Math.floor(Math.random() * (max - min + min) + 1))].map(i => (~~(Math.random() * 36)).toString(36)).join('').toLowerCase();
            if (await findName(name2)) await check();
            return name2;
        }
        return await check();
    } else return name;
}

app.use(cookies.express());
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/', (req, res) => res.render('index'));

app.post("/upload/:info", async (req, res) => {
    let info = JSON.parse(Buffer.from(req.params.info, 'base64').toString('ascii')), name = await chooseName(info.name), min = new Date(), max = new Date((new Date).setMonth((new Date).getMonth() + 1)), date = new Date(info.dateTime);
    info.dateTime = date; info.userIP = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0];
    if (!!!new Date(info.dateTime).getDate()) return res.status(417).send('Given date is invalid');
    if (info.limit && isNaN(info.limit)) return res.status(417).send('The given limit isn\'t a number');
    if (info.limit && info.limit < 1) return res.status(417).send("Limit invalid. Leave empty for unlimited");
    if ((info.ip && info.ip.length > 4) || (info.ip2 && info.ip2.length > 4)) return res.status(417).send('I can only accept 4 IPs');
    if (info.pass) bcrypt.hash(info.pass, 10, (err, hash) => {
        if (err) return res.status(500).send('There was an error hashing password');
        info.pass = hash;
    });

    let checkIP = (ip, ip2) => {
        if (ip) for (i = 0; i < ip.length; i++) {
            if (!ipRegex({ exact: true }).test(ip[i])) return `This IP "${ip[i]}" is invalid`;
            if (ip2 && ip2.includes(ip[i])) return `This IP "${ip[i]}" shouldn't be in both whitelist and blacklist box`;
        };
    },
        ipCheck = checkIP(info.ip, info.ip2),
        ip2Check = checkIP(info.ip2, info.ip);

    if (ipCheck) return res.status(417).send(ipCheck);
    if (ip2Check) return res.status(417).send(ip2Check);

    multer({
        storage: new GridFsStorage({
            url: mongoURI,
            file: (req, file) => {
                return {
                    filename: (name + path.extname(file.originalname)),
                    bucketName: 'data'
                };
            }
        })
    }).single('file')(req, res, async (err) => {
        if (req.fileValidationError) return res.send(req.fileValidationError);
        else if (!req.file) return res.status(417).send('Looks like you never added a file.');
        else if (err instanceof multer.MulterError) return res.status(200).send(err);
        else if (err) return res.status(200).send(err);

        await files.findOneAndUpdate({ filename: req.file.filename }, { $set: info });
        let chunk = await chunks.findOne({ file_id: req.file._id });
        chunk.dateTime = date;
        await chunks.findOneAndUpdate({ file_id: req.file._id }, { $set: chunk });
        return res.status(200).json({ url: `/file/${req.file.filename}` });
    });
});

app.get("/file/:name", async (req, res) => {
    try {
        let find = async (name) => { return (await files.findOne({ filename: name })) }, hds = req.headers, ip = (hds['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0], cookie = req.cookies.get('_tmpfle');
        find = (await find(req.params.name)) || (await find({ $regex: `${req.params.name}(?=\.)` })) || null;
        if (!find) return res.status(404).render('error', { type: 404 });
        if (find.ip && find.ip.includes(ip) || find.ip2 && !find.ip2.includes(ip)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
        if (find.pass) {
            if (!cookie) return res.render('auth');
            if (!await bcrypt.compare(find.pass, cookie)) return req.method == "GET" ? res.status(403).render('error', { code: 1, type: 403 }) : res.status(403).send('You have no access to view this file');
            req.cookies.set('_tmpfle', '', { maxAge: 0, sameSite: 'Lax' });
        }

        let stream = gfs.openDownloadStreamByName(find.filename).pipe(res);
        stream.on('close', async () => {
            if (find.limit && ((hds['sec-fetch-site'] === 'same-origin' && hds['sec-fetch-mode'] !== 'no-cors') || hds['sec-fetch-site'] !== 'same-origin')) {
                find.limit--;
                if (find.limit == 0) gfs.delete(ObjectId(find._id));
                else await files.findOneAndUpdate({ filename: req.params.name }, { $set: find });
            }
        });
    } catch (e) {
        console.log(e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }
});

app.post("/auth/", async (req, res) => {
    try {
        let fn = req.headers.referer.split('/')[req.headers.referer.split('/').length - 1], find = (await gfs.find({ filename: fn }).toArray())[0] || (await gfs.find({ filename: { $regex: `${fn}(?=\.)` } }).toArray())[0];
        if (!find) return res.status(404);

        bcrypt.compare(req.body.data, find.pass, async (err, rs) => {
            if (!rs) return res.status(401).send('Incorect password');
            req.cookies.set('_tmpfle', (await bcrypt.hash(find.pass, 10)), { maxAge: 15000, sameSite: 'Lax' });
            res.status(200).send('Done');
        });
    } catch (e) {
        console.log(e);
        req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500 }) : res.status(500).send('There was an internal server error');
    }
});

let del = async (req, res) => {
    let filename = req.params.name;
    if (!req.params.name && req.method == 'POST') filename = req.headers.referer.split('/')[req.headers.referer.split('/').length - 1];
    else if (!req.params.name) return res.render('deleteSearch');

    let find = (await gfs.find({ filename: filename }).toArray())[0] || (await gfs.find({ filename: { $regex: `${filename}(?=\.)` } }).toArray())[0], ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0];
    if (!find) return res.status(404).render('error', { type: 404 });
    if (find.userIP !== ip) return req.method == "GET" ? res.status(403).render('error', { code: 2, type: 403 }) : res.status(403).send('You have no access to delete this file');
    if (req.method == "GET") return res.render('delete', find);

    gfs.delete(ObjectId(find._id), (err, rs) => {
        if (err) req.method == "GET" ? res.status(500).render('error', { code: 1, type: 500, text: 'There was an error deleting file' }) : res.status(500).send('There was an error deleting file');
        return req.method == "GET" ? res.status(200).redirect('/') : res.status(200).send('File has been deleted');
    });
};

app.route("/del/:name?")
    .post((req, res) => del(req, res))
    .get((req, res) => del(req, res));

app.get("/forbidden/:code?", (req, res) => res.render('error', { code: req.params.code, type: 403 }));
app.get('/contact', (req, res) => res.status(302).redirect('https://github.com/Glitchii/'));
app.use((req, res, next) => res.status(404).render('error', { type: 404 }));

const PORT = process.env.PORT || 2020,
    server = app.listen(PORT, () => console.log(`Listening on port ${PORT}`)),
    io = require('socket.io')(server);