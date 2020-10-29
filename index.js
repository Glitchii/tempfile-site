require('dotenv').config();
const ipRegex = require('ip-regex'),
    PORT = process.env.PORT || 2020,
    bodyParser = require('body-parser'),
    multer = require('multer'),
    GridFsStorage = require('multer-gridfs-storage'),
    Grid = require('gridfs-stream'),
    methodOverrride = require('method-override'),
    path = require('path'),
    express = require('express'),
    app = express(),
    mongoURI = process.env.DBURI,
    mongoose = require('mongoose'),
    conn = mongoose.createConnection(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

app.use(bodyParser.json());
app.use(methodOverrride('_method'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname)));
app.use(express.json());

let gfs;
conn.once("open", () => gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: "data" }));

let min = 1, max = 6,
    chooseName = async (filename) => {
        let name = filename ? filename.trim().toLowerCase().replace(' ', '-').replace(/[^a-z0-9-]/g, '') : null,
            findName = async (name) => {
                return gfs.find({ filename: { $regex: `${name}(?=\.)` } }).toArray().then(find => {
                    find = find.sort((x, y) => {
                        let re = new RegExp(/(?<!-\d+)\.\w+$/g), name1 = x.filename.toLowerCase().replace(/\.\w+$/, ''), name2 = y.filename.toLowerCase().replace(/\.\w+$/, '');
                        if (re.test(name1) || re.test(name2)) return 0;
                        else {
                            if (name1 < name2) return -1;
                            if (name1 > name2) return 1;
                        }
                        return 0;
                    });
                    return find.length !== 0 ? find[find.length - 1].filename.split('.')[0] : null;
                });
            };

        if (name && await findName(name)) {
            let found = await findName(name);
            return (found.match(/-\d+$/g) ? `${found.slice(0, -2)}-${parseInt(found.slice(-1)) + 1}` : found + '-1');
        } else if (!name) {
            let check = async () => {
                let name2 = [...Array(Math.floor(Math.random() * (max - min + min) + 1))].map(i => (~~(Math.random() * 36)).toString(36)).join('').toLowerCase();
                if (await findName(name2)) await check(); // Kepp looping function till a unique name is found
                return name2;
            }
            return await check();
        } else return name;
    }

const server = app.listen(PORT, () => { console.log(`Listening on port ${PORT}`); }), io = require('socket.io')(server);

app.get('/', (req, res) => res.render('index'));

app.post("/upload/:info", async (req, res) => {
    // Checking is done in server because client side can be altered by the usuer.
    let info = JSON.parse(Buffer.from(req.params.info, 'base64').toString('ascii')), name = await chooseName(info.name), resp = res, min = new Date(), max = new Date((new Date).setMonth((new Date).getMonth() + 1));
    if (!!!new Date(info.dateTime).getDate()) return res.status(417).send('Given date is invalid');
    info.dateTime = new Date(info.dateTime); info.userIP = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0];
    console.log(info.userIP)
    if (info.limit && isNaN(info.limit)) return res.status(417).send('The given limit isn\'t a number');
    if (info.limit && info.limit < 0) return res.status(417).send("Limit shouldn't be less than 0");
    if (info.dateTime > max || info.dateTime < min) return res.status(417).send('The given duration is not accepted');
    if ((info.ip && info.ip.length > 4) || (info.ip2 && info.ip2.length > 4)) return res.status(417).send('I can only accept 4 IPs');

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
    }).single('file')(req, res, (err) => {
        if (req.fileValidationError) return res.send(req.fileValidationError);
        else if (!req.file) return res.status(417).send('Looks like you never added a file.');
        else if (err instanceof multer.MulterError) return res.status(200).send(err);
        else if (err) return res.status(200).send(err);

        let gfs2 = Grid(conn.db, mongoose.mongo);
        gfs2.collection('data');
        gfs2.files.findOneAndUpdate({ filename: req.file.filename }, { $set: info }, (err, file) => {
            if (err) {
                // Delete the file right away if there's an error adding this info since info has to be there.
                gfs.delete(new mongoose.Types.ObjectId(req.file.id), (err, res) => {
                    if (err) console.log(err);
                    return resp.status(500).send('Failed adding some given data to database');
                });
            }
            res.status(200).json({ url: `/file/${req.file.filename}` });
        });
    });
});

app.get("/file/:name", async (req, res) => {
    try {
        let find = async (name) => { return (await gfs.find({ filename: name }).toArray())[0]; }, ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0];
        find = (await find(req.params.name)) || (await find({ $regex: `${req.params.name}(?=\.)` }));
        if (!find) return res.status(404).render('404');
        if (find.ip && find.ip.includes(ip) || find.ip2 && !find.ip2.includes(ip)) return req.method == "GET" ? res.status(403).render('403', { code: 1 }) : res.status(403).send('You have no access to view this file');

        return gfs.openDownloadStreamByName(find.filename).pipe(res);
    } catch (e) {
        console.log(e);
        res.status(500).send('There was an internal server error');
    }

});

let del = async (req, res) => {
    if (!req.params.name) return res.render('deleteSearch');
    let find = async (name) => { return (await gfs.find({ filename: name }).toArray())[0]; }, resp = res, ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0];
    find = (await find(req.params.name)) || (await find({ $regex: `${req.params.name}(?=\.)` }));
    if (!find) return res.status(404).render('404');
    if (find.userIP !== ip) return req.method == "GET" ? res.status(403).render('403', { code: 2 }) : res.status(403).send('You have no access to delete this file');
    if (req.method == "GET") return res.render('delete', find);

    gfs.delete(new mongoose.Types.ObjectId(find._id), (err, res) => {
        if (err) resp.status(500).send('There was an error deleting file');
        return resp.status(200).redirect('/');
    });
};

app.route("/del/:name?")
    .post((req, res) => del(req, res))
    .get((req, res) => del(req, res));

app.get("/forbidden/:code?", (req, res) => res.render('403', { code: req.params.code }));
app.get('/contact', (req, res) => res.redirect('mailto:darlionthesis@gmail.com')); // My email if you want to get in touch :)
app.use((req, res, next) => res.status(404).render("404"));