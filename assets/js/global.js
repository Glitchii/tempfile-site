var getI = () => {
    return fetch("https://www.cloudflare.com/cdn-cgi/trace")
        .then(res => res.text())
        .then(r => {
            let re = r.match(/(?<=(ip=))(.+|\n)/);
            return re.length === 0 ? false : re[0];
        }).catch(() => { return false });
};