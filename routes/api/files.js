const { lookFor, chooseName, dateFromValue, logger } = require('../../assets/components'),
    randomWords = require("random-words"),
    express = require('express'),
    bcrypt = require('bcrypt'),
    router = express.Router(),
    multer = require('multer'),
    path = require('path'),
    AWS = require('aws-sdk'),
    S3 = new AWS.S3({
        accessKeyId: process.env.ID,
        secretAccessKey: process.env.secret
    });

router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0],
        res.ok = (obj) => res.json(obj && { ok: true, ...obj } || { ok: true }),
        res.err = (status, type, msg) => res.status(status || 500).json({
            ok: false,
            error: {
                type: type || 'InternalServerError',
                message: msg || "There was an internal server error"
            }
        });
    next();
});

let get = (req, res, filename) =>
    // Examples
    //  curl -O http://tempfile.site/api/files/fileame.png
    //  curl -O http://tempfile.site/api/files/fileame.png -H "pass: a password"
    lookFor(filename).then(async (find, err) => {
        if (err || !find) return res.err(404, "NotFound", "File not found");
        if (find.ipblacklist && find.ipblacklist.includes(req.ip) || find.ipwhitelist && !find.ipwhitelist.includes(req.ip)) return res.err(403, 'Forbidden', 'Your IP address is either blacklisted or not included in the list of whitelisted IPs');
        if (find.pass) {
            if (!req.headers.pass) return res.err(403, "NoPass", "File requires password. A header with a key 'pass' with the password as value is required");
            if (!(await bcrypt.compare(req.headers.pass, find.pass))) return res.err(403, "WrongPass", "Incorrect password recieved");
        }

        res.type(find.mimetype || find.contentType)
        res.end(Buffer.from(find.buffer, 'binary'));
        if (find.limit) {
            find.limit--;
            if (find.limit == 0) S3.deleteObject({
                Bucket: process.env.bucket,
                Key: find.filename + '.json',
            }, err => err && logger.fatal(`Error deleting file (${find.filename}) with 0 limits: ${err}`));
            else S3.putObject({
                Bucket: process.env.bucket,
                Key: find.filename + '.json',
                Body: JSON.stringify(find)
            }, err => err && logger.fatal(`Error reducing file (${find.filename}) limit: ${err}`));
        };
    }).catch(err => {
        res.err();
        logger.error('From api/get/', err);
    }),
    del = async (req, res, filename) => {
        // Examples:
        //  curl -X DELETE http://tempfile.site/api/files/fileame.png"
        //  curl -X DELETE http://tempfile.site/api/files/fileame.png -H "authkey: a key"
        try {
            if (!filename) return res.err(404, "MissingFilename", "Filename not recieved");
            lookFor(filename).then(async (find, err) => {
                if (err) return res.err();
                if (!find) return res.err(404, "NotFound", `File not found`);
                if (find.userIP !== req.ip) {
                    if (find.authkey) {
                        let key = req.headers.authkey;
                        if (!key) return res.err(400, "MissingAuthKey", "An 'authkey' header with the auth key is required");
                        if (key !== find.authkey) return res.err(400, "BadAuthKey", "Incorrect auth key recieved");
                    } else return res.err(403, "Unauthorized", "You can't delete the file as it wasn't uploaded from the current IP address and no auth key was provided");
                }

                S3.deleteObject({
                    Bucket: process.env.bucket,
                    Key: find.filename + '.json',
                }, (err, _data) => {
                    if (err) res.err();
                    res.ok();
                })
            });
        } catch (err) {
            res.err();
            logger.error('From api/del/', err);
        }
    }, add = async (req, res) => {
        // Examples:
        //  curl -F datetime=1m -F file=@/path/to/file.png http://tempfile.site/api/files
        //  curl -F datetime=1m -F name=a-name -F ipblacklist=68.80.31.225 -F file=@/path/to/file.png http://tempfile.site/api/files
        //  curl -F datetime=1m -F name=a-name -F ipwhitelist="68.80.31.225, 50.90.30.222" -F authkey="a key" pass="a password" -F file=@/path/to/file.png http://tempfile.site/api/files
        multer({
            storage: multer.memoryStorage({
                destination: (req, file, callback) => callback(null, '')
            })
        }).single('file')(req, res, async (err) => {
            try {
                if (err || req.fileValidationError) return res.err(0, 0, "There was an error while processing the file");
                else if (!req.file) return res.err(400, "MissingFile", "No file recieved");
                if (!req.body.datetime) return res.err(400, "MissingDateTime", "Request must include a 'datetime' key");
                var info = JSON.parse(JSON.stringify(req.body || {})), chosenDate = dateFromValue(info.datetime),
                    data = { authkey: info.authkey || randomWords({ exactly: 3, maxLength: 3, join: '.' }), filename: `${await chooseName(info.name)}${path.extname(req.file.originalname)}`, userIP: req.ip },
                    ipblacklist = info.ipblacklist && info.ipblacklist.split(/\s*,\s*/g).filter(x => x),
                    ipwhitelist = info.ipwhitelist && info.ipwhitelist.split(/\s*,\s*/g).filter(x => x);
                if (ipblacklist) {
                    if (ipblacklist.length > 5) return res.err(400, "IP Limit Exceeded", "Only up to 5 IPs allowed");
                    data.ipblacklist = ipblacklist;
                }
                if (ipwhitelist) {
                    if (ipwhitelist.length > 5) return res.err(400, "IP Limit Exceeded", "Only up to 5 IPs allowed");
                    data.ipwhitelist = ipwhitelist;
                }
                if (!chosenDate) return res.err(400, "InvalidDate", "Given date or time is invalid");
                if (chosenDate === 0) return res.err(400, "TooLow", "Time must be atleast a minute ahead");
                if (chosenDate === 1) return res.err(400, "TooHigh", "Given date or time is over the limit");
                if (info.pass) data.pass = await bcrypt.hash(info.pass, 10);
                if (info.limit) {
                    if (isNaN(info.limit) || info.limit <= 0) return res.err(400, "InvalidLimit", "Limit must be a number more than 0");
                    data.limit = parseInt(info.limit);
                }
                data = { mimetype: req.file.mimetype, size: req.file.size, buffer: req.file.buffer, ...data, datetime: chosenDate }
                S3.putObject({
                    Bucket: process.env.bucket,
                    Key: data.filename + '.json',
                    Body: JSON.stringify(data)
                }, (err, _data) => {
                    if (err) return res.err(0, 0, 'Error uploading, file may not be uploaded.');
                    res.ok({ link: `https://tempfile.site/files/${data.filename}`, authkey: data.authkey });
                })
            } catch (err) {
                if (info.ipblacklist && Array.isArray(info.ipblacklist)) res.err(0, 'DuplicateKey', `'ipblacklist' is repeated more than once. You must use one string separeted with a comma, eg. '-F ipblacklist="12.3.45, 678.9.0"'`);
                else if (info.ipwhitelist && Array.isArray(info.ipwhitelist)) res.err(0, 'DuplicateKey', `'ipwhitelist' is repeated more than once. You must use one string separeted with a comma, eg. '-F ipwhitelist="12.3.45, 678.9.0"'`);
                else res.err(0, 0, "Failed adding file due to an internal server error");
                logger.error('From api/add/', err);
            }
        });
    }

router.route("/:name?")
    .get((req, res) => get(req, res, req.body.name || req.params.name || req.query.name))
    .post((req, res) => add(req, res))
    .delete((req, res) => del(req, res, req.body.name || req.params.name || req.query.name));

module.exports = router;