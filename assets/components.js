const ipRegex = require('ip-regex');

module.exports = {
    lookFor: filename => files.findOne({ filename: filename }),
    dateFromValue: str => {
        let digit = parseFloat(str.replace(/\D+$/, '')), date = !str ? null : new Date(
            str.endsWith('m') ? ((new Date).setMinutes((new Date).getMinutes() + digit)) :
                str.endsWith('h') ? ((new Date).setHours((new Date).getHours() + digit)) :
                    str.endsWith('d') ? ((new Date).setDate((new Date).getDate() + digit)) :
                        str.endsWith('w') ? ((new Date).setDate((new Date).getDate() + (7 * digit))) :
                            str.endsWith('mo') ? ((new Date).setMonth((new Date).getMonth() + digit)) :
                                new Date(new Date(str).setMinutes(new Date(str).getMinutes() + 1))
        );
        return !date.getDate() ? null : date > new Date((new Date).setMonth((new Date).getMonth() + 1)) ? 1 : date < new Date().setMinutes(new Date().getMinutes()+.5) ? 0 : date;
    },
    chooseName: async (filename) => {
        let name = filename && filename.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_\.]/g, ''),
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
    }, checkIP: (ip, ip2) => {
        if (ip) for (i = 0; i < ip.length; i++) {
            if (!ipRegex({ exact: true }).test(ip[i])) return `This IP "${ip[i]}" is invalid`;
            if (ip2 && ip2.includes(ip[i])) return `This IP "${ip[i]}" shouldn't be in both whitelist and blacklist box`;
        };
    }
};