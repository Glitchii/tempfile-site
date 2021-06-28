var ua = navigator.userAgent.match(/\sEdg\w\//),
    closeBtn = (el, func, arg) => {
        let _do = () => {
            el.style.display = 'none';
            if (func && arg) setTimeout(() => func(arg), 200);
        }
        if (ua) return _do();
        el.animate({ bottom: '-90px', opacity: '0' }, { duration: 500, easing: 'cubic-bezier(.68, -0.55, .27, 1.55)' }).onfinish = _do;
    }, notify = (text, type, ms) => {
        text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;') || "Hello world", type = type || 1, ms = ms || 5000;
        let notif = document.querySelector(".notif"), normal = notif.querySelector(".normal"), success = notif.querySelector(".success"), nor = notif.querySelector('.normal[style*="display: flex;"]'), succ = notif.querySelector('.success[style*="display: flex;"]'), re = /\[(.+)\]\((.+)\)/ig.exec(text);
        let doNext = (elm) => {
            if (re && re.length === 3) text = text.replace(re[0], `<a class="lnk" target="_blank" href="${re[2]}">${re[1]}</a>`);
            elm.style.display = 'flex', elm.querySelector('.content p').innerHTML = text;
            setTimeout(() => closeBtn(elm), ms);
        };
        if (nor || succ) closeBtn((nor || succ), doNext, type === 2 ? success : normal);
        else doNext(type === 2 ? success : normal);
    };

window.onload = () => {
    let menuBox = document.querySelector('.menuBox'),
        closeMenuBox = () => {
            if (ua) return menuBox.classList.remove('active');
            menuBox.animate([
                { top: '50px', opacity: '1', offset: .7 },
                { top: '20px', opacity: '0', offset: 1 }
            ], {
                duration: 900,
                easing: 'ease'
            })
                .onfinish = () => menuBox.classList.remove('active');
        };

    document.querySelector('.del').addEventListener('click', (el) =>
        fetch(`/del/${location.pathname.split('/').pop()}`, { method: "POST" })
            .then(res => {
                if (res.status !== 200) return notify(`Error—${res.statusText} (${res.status})`);
                document.querySelector('main').classList.add('deleted');
                document.querySelector('.topPart h2').innerText = 'File has been deleted';
                el.target.classList.replace('del', 'home');
            })
    );

    document.querySelector('.home').addEventListener('click', () =>
        window.location.href = '/');

    document.querySelectorAll('.notif .notifCloseBtn').forEach(e =>
        e.addEventListener('click', el => closeBtn(el.target.parentNode))
    );

    document.querySelectorAll('.menu ul li').forEach(el => el.addEventListener('click', e => {
        let a = e.target.querySelector('a');
        if (a && a.getAttribute('href')) {
            if (a.getAttribute('target') && a.getAttribute('target') === '_blank') window.open(a.href);
            else window.location.href = a.href;
        };
    }));

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active')) return menuBox.classList.add('active');
            closeMenuBox();
        }
        else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox')) closeMenuBox();
    });
};