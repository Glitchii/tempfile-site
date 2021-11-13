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
    document.querySelector('.home').addEventListener('click', () => window.location.href = '/');

    let input = document.querySelector('.inp input'),
        menuBox = document.querySelector('.menuBox'),
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

    input.focus();
    document.querySelectorAll('.menu ul li').forEach(el => {
        el.addEventListener('click', e => {
            let a = e.target.querySelector('a');
            if (a && a.getAttribute('href')) {
                if (a.getAttribute('target') && a.getAttribute('target') === '_blank') window.open(a.href);
                else window.location.href = a.href;
            };
        });
    });

    document.querySelectorAll('.notif .notifCloseBtn').forEach(e =>
        e.addEventListener('click', el => closeBtn(el.target.parentNode))
    );

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active')) return menuBox.classList.add('active');
            closeMenuBox();
        }
        else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox')) closeMenuBox();
    });

    let submit = () => {
        if (!input.value) {
            if (ua) return notify('Enter Password first')
            return input.parentElement.animate([
                { transform: 'translateX(15px)', offset: 0 },
                { transform: 'translateX(-15px)', offset: .25 },
                { transform: 'translateX(15px)', offset: .5 },
                { transform: 'translateX(-15px)', offset: .75 },
                { transform: 'translateX(0)', offset: 1 },
            ], {
                duration: 500,
                easing: 'ease'
            });
        }

        fetch("/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: `{ "data": "${input.value}", "name": "${location.pathname.split('/').pop()}" }`
        })
            .then(res => res.status === 200 ? window.location.reload() : notify(res.status === 401 ? 'Incorect password' : `Error—${res.statusText} (${res.status})`));
    };

    document.querySelector('.login').addEventListener('click', submit)
    input.addEventListener('keypress', (k) => {
        if (k.code == 'Enter') submit();
    });
};