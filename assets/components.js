import ipRegex from 'ip-regex';
import AWS from 'aws-sdk';
import path from 'path';

import { config } from 'dotenv';
import { fileURLToPath } from 'url';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '../.env') });

export const S3 = new AWS.S3({
    accessKeyId: process.env.ID,
    secretAccessKey: process.env.secret
});

export const lookFor = (name, hasExt) =>
    S3.getObject({ Bucket: process.env.bucket, Key: `${name.toLowerCase()}${hasExt ? '' : '.json'}` }).promise()
        .then(data => JSON.parse(data.Body.toString('utf-8')))
        .catch(() => null)

export const dateFromValue = str => {
    const digit = +str.replace(/\D+$/, '');
    const date = !str ? null : new Date(
        str.endsWith('m') ? (new Date).setMinutes((new Date).getMinutes() + digit) :
            str.endsWith('h') ? (new Date).setHours((new Date).getHours() + digit) :
                str.endsWith('d') ? (new Date).setDate((new Date).getDate() + digit) :
                    str.endsWith('w') ? (new Date).setDate((new Date).getDate() + 7 * digit) :
                        str.endsWith('mo') ? (new Date).setMonth((new Date).getMonth() + digit) :
                            new Date(str).setMinutes(new Date(str).getMinutes() + 1));
    
    return !date.getDate() ? null : date > new Date((new Date).setMonth((new Date).getMonth() + 1)) ? 1 : date < new Date().setMinutes(new Date().getMinutes() + .5) ? 0 : date;
}

export const findName = async name => S3.listObjectsV2({ Bucket: process.env.bucket, }).promise()
    .then(data => {
        const arr = data.Contents.filter(x => new RegExp(`^${name}(-\\d+)?\\${ext}\\.json$`, 'gi').test(x.Key)).sort((x, y) => {
            let name1 = x.Key.replace(exp, ''), name2 = y.Key.replace(re, '');
            return re.test(name1) || re.test(name2) ? 0 : name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
        });

        return arr.length !== 0 ? arr[arr.length - 1].Key.replace(/\.[^\.]+?\.json$/g, '') : null;
    }).catch(() => null);

export const chooseName = async (filename, ext) => {
    let name = filename ? filename.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_\.]/g, '') : null,
        re = new RegExp(/(?<!-\d+)\.\w+$/g),
        exp = new RegExp(`\\${ext}\\.json$`);

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

export const checkIP = (ips, ips2) => {
    if (ips?.length)
        for (const ip of ips)
            if (!ipRegex({ exact: true }).test(ip)) return `The IP "${ip}" is invalid`;
            else if (ips2 && ips2.includes(ip)) return `The IP "${ip}" shouldn't be in both whitelist and blacklist box`;
}