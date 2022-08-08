import randomWords from 'random-words';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';

import { Router } from 'express';
import { lookFor, chooseName, dateFromValue, S3 } from '../../assets/components.js';

const router = Router();

router.use((req, res, next) => {
    res.ip = ((req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',').reverse()[0]).trim(),
        res.ok = obj => res.json({ ok: true, ...(obj ? obj : {}) }),
        res.err = (status, type, msg, usage) => res.status(status || 500).json({
            ok: false,
            error: {
                type: type || 'InternalServerError',
                message: msg || "There was an internal server error",
                ...(usage ? { usage } : {})
            }
        });
    next();
});

export const get = (req, res, filename) =>
    // Examples
    //  curl -O https://tempfile.site/api/files/fileame.png
    //  curl -O https://tempfile.site/api/files/fileame.png -H "pass: a password"
    !filename ? res.err(400, 'BadRequest', 'No filename provided', `${req.protocol}://${req.get('host')}${req.baseUrl}/<filename>`) :
        lookFor(filename).then(async (find, err) => {
            if (err || !find)
                return res.err(404, "NotFound", "File not found");

            if (find.ipblacklist)
                for (const ip of find.ipblacklist)
                    if (await bcrypt.compare(res.ip, ip))
                        return res.err(403, 'Forbidden', 'Your IP address is blacklisted from accessing this file.');

            if (find.ipwhitelist) {
                let passed;
                for (let ip of find.ipwhitelist)
                    if (await bcrypt.compare(res.ip, ip)) {
                        passed = true;
                        break;
                    }

                if (!passed)
                    return res.err(403, 'Forbidden', 'You are not allowed to access this file.');
            }

            if (find.pass)
                if (!req.headers.pass) return res.err(403, "NoPass", "File requires password. A header with a key 'pass' with the password as value is required");
                else if (!(await bcrypt.compare(req.headers.pass, find.pass))) return res.err(403, "WrongPass", "Incorrect password recieved");

            res.type(find.mimetype || find.contentType)
            res.end(Buffer.from(find.buffer, 'binary'));

            if (find.limit)
                if (--find.limit <= 0)
                    S3.deleteObject({
                        Bucket: process.env.bucket,
                        Key: find.filename + '.json',
                    }, err => err && console.log(`Error deleting file "${find.filename}" which has reached its download limit: ${err}`));
                else
                    S3.putObject({
                        Bucket: process.env.bucket,
                        Key: find.filename + '.json',
                        Body: JSON.stringify(find)
                    }, err => err && console.log(`Error reducing download limit on file "${find.filename}": ${err}`));
        }).catch(err => {
            res.err();
            console.log('From /api/get/', err);
        })

export const del = async (req, res, filename) => {
    // Examples:
    //  curl -X DELETE https://tempfile.site/api/files/fileame.png
    //  curl -X DELETE https://tempfile.site/api/files/fileame.png -H "authkey: a key"
    try {
        if (!filename)
            return res.err(404, "MissingFilename", "No file provided to delete", `${req.protocol}://${req.get('host')}${req.baseUrl}/<filename>`);

        lookFor(filename).then(async (find, err) => {
            if (err) return res.err();
            if (!find) return res.err(404, "NotFound", `File not found`);
            if (!await bcrypt.compare(res.ip, find.userIP)) {
                if (!find.authkey)
                    return res.err(403, "Unauthorized", "You can't delete the file as it wasn't uploaded from the current IP address and no auth key was provided");

                const key = req.headers.authkey;
                if (!key) return res.err(400, "MissingAuthKey", "An 'authkey' header with the auth key is required");
                if (key !== find.authkey) return res.err(400, "BadAuthKey", "Incorrect auth key recieved");

            }

            S3.deleteObject({
                Bucket: process.env.bucket,
                Key: find.filename + '.json',
            }, (err, _data) => {
                err && res.err();
                res.ok();
            })
        });
    } catch (err) {
        res.err();
        console.log('From /api/delete/', err);
    }
}

export const add = async (req, res) => {
    // Examples:
    //  curl -F datetime=1m -F file=@/path/to/file.png https://tempfile.site/api/files
    //  curl -F datetime=1m -F name=a-name -F ipblacklist=68.80.31.225 -F file=@/path/to/file.png https://tempfile.site/api/files
    //  curl -F datetime=1m -F name=a-name -F ipwhitelist="68.80.31.225, 50.90.30.222" -F authkey="a key" pass="a password" -F file=@/path/to/file.png https://tempfile.site/api/files
    multer({ storage: multer.memoryStorage({ destination: (_req, _file, callback) => callback(null, '') }) })
        .single('file')(req, res, async (err) => {
            try {
                if (err || req.fileValidationError) return res.err(0, 0, "There was an error while processing the file");
                else if (!req.file) return res.err(400, "MissingFile", "No file recieved");
                else if (!req.body.datetime) return res.err(400, "MissingDateTime", "Request must include a 'datetime' key");

                var info = JSON.parse(JSON.stringify(req.body || {})),
                    chosenDate = dateFromValue(info.datetime),
                    ipblacklist = info.ipblacklist && info.ipblacklist.split(/\s*,\s*/g).filter(x => x),
                    ipwhitelist = info.ipwhitelist && info.ipwhitelist.split(/\s*,\s*/g).filter(x => x),
                    ext = path.extname(req.file.originalname),
                    data = {
                        authkey: info.authkey || randomWords({ exactly: 3, maxLength: 3, join: '.' }),
                        filename: `${await chooseName(info.name, ext)}${ext}`,
                        userIP: await bcrypt.hash(res.ip, 10)
                    };

                if (chosenDate === 0)
                    return res.err(400, "TooLow", "Time must be atleast a minute ahead");
                if (chosenDate === 1)
                    return res.err(400, "TooHigh", "Given date or time is over the limit");
                if (!chosenDate)
                    return res.err(400, "InvalidDate", "Given date or time is invalid");
                if (info.pass)
                    data.pass = await bcrypt.hash(info.pass, 10);
                if (info.limit) {
                    if (isNaN(info.limit) || info.limit <= 0)
                        return res.err(400, "InvalidLimit", "Limit must be a number more than 0");
                    data.limit = parseInt(info.limit);
                }
                if (ipblacklist) {
                    if (ipblacklist.length > 5)
                        return res.err(400, "IP Limit Exceeded", "Only up to 5 IPs allowed");
                    ipblacklist.forEach(async (ip, i) => ipblacklist[i] = await bcrypt.hash(ip, 10))
                    data.ipblacklist = ipblacklist;
                }
                if (ipwhitelist) {
                    if (ipwhitelist.length > 5)
                        return res.err(400, "IP Limit Exceeded", "Only up to 5 IPs allowed");
                    ipwhitelist.forEach(async (ip, i) => ipwhitelist[i] = await bcrypt.hash(ip, 10))
                    data.ipwhitelist = ipwhitelist;
                }

                data = { mimetype: req.file.mimetype, size: req.file.size, buffer: req.file.buffer, ...data, datetime: chosenDate };

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
                console.log('From /api/add/', err);
            }
        });
}

router.route("/:name?")
    .post(add)
    .get((req, res) => get(req, res, req.body.name || req.params.name || req.query.name))
    .delete((req, res) => del(req, res, req.body.name || req.params.name || req.query.name));

export { router };