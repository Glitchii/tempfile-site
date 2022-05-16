const closeBtn = (el, func, arg) =>
    el.animate({ bottom: '-90px', opacity: '0' }, { duration: 500, easing: 'cubic-bezier(.68, -0.55, .27, 1.55)' })
        .onfinish = () => {
            el.style.display = 'none';
            if (func && arg) setTimeout(func, 200, arg);
        },
    notify = (text = "Hello world", type = 1, ms = 5000) => {
        text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const notif = document.querySelector(".notif"), normal = notif.querySelector(".normal"),
            success = notif.querySelector(".success"),
            nor = notif.querySelector('.normal[style*="display: flex;"]'),
            succ = notif.querySelector('.success[style*="display: flex;"]'),
            re = /\[(.+)\]\((.+)\)/ig.exec(text),
            doNext = elm => {
                if (re?.length === 3) text = text.replace(re[0], `<a class="lnk" target="_blank" href="${re[2]}">${re[1]}</a>`);
                elm.style.display = 'flex', elm.querySelector('.content p').innerHTML = text;
                setTimeout(closeBtn, ms, elm);
            };

        if (nor || succ) closeBtn((nor || succ), doNext, type === 2 ? success : normal);
        else doNext(type === 2 ? success : normal);
    };

addEventListener('DOMContentLoaded', () => {
    document.querySelector('.home').addEventListener('click', () => window.location.href = '/');

    const input = document.querySelector('.inp input'),
        menuBox = document.querySelector('.menuBox'),
        closeMenuBox = () =>
            menuBox.animate([{ top: '50px', opacity: '1', offset: .7 }, { top: '20px', opacity: '0', offset: 1 }], { duration: 900, easing: 'ease' })
                .onfinish = () => menuBox.classList.remove('active');

    input.focus();
    for (const e of document.querySelectorAll('.menu ul li'))
        e.addEventListener('click', el => {
            const a = el.target.querySelector('a');
            if (a?.getAttribute('href'))
                if (a.getAttribute('target') === '_blank') open(a.href);
                else location.href = a.href;
        });

    for (const e of document.querySelectorAll('.notif .notifCloseBtn'))
        e.addEventListener('click', el => closeBtn(el.target.parentNode))

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active'))
                return menuBox.classList.add('active');
            closeMenuBox();
        } else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox'))
            closeMenuBox();
    });

    const submit = () => {
        if (!input.value)
            return input.parentElement.animate([
                { transform: 'translateX(15px)', offset: 0 },
                { transform: 'translateX(-15px)', offset: .25 },
                { transform: 'translateX(15px)', offset: .5 },
                { transform: 'translateX(-15px)', offset: .75 },
                { transform: 'translateX(0)', offset: 1 },
            ], { duration: 500, easing: 'ease' });

        fetch("/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: `{ "data": "${input.value}", "name": "${location.pathname.split('/').pop()}" }`
        })
            .then(res => res.status === 200 ? window.location.reload() : notify(res.status === 401 ? 'Incorect password' : `Error—${res.statusText} (${res.status})`));
    };

    document.querySelector('.login').addEventListener('click', submit)
    input.addEventListener('keypress', k => k.code == 'Enter' && submit());
});