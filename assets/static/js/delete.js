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
    const menuBox = document.querySelector('.menuBox'),
        closeMenuBox = () =>
            menuBox.animate([{ top: '50px', opacity: '1', offset: .7 }, { top: '20px', opacity: '0', offset: 1 }], { duration: 900, easing: 'ease' })
                .onfinish = () => menuBox.classList.remove('active');

    document.querySelector('.del').addEventListener('click', (el) =>
        fetch(`/delete/${location.pathname.split('/').pop()}`, { method: "POST" })
            .then(res => {
                if (res.status !== 200) return notify(`Error—${res.statusText} (${res.status})`);
                document.querySelector('main').classList.add('deleted');
                document.querySelector('.topPart h2').innerText = 'File has been deleted';
                el.target.classList.replace('del', 'home');
            })
    );

    for (const e of document.querySelector('.home'))
        e.addEventListener('click', () => location.href = '/');

    for (const e of document.querySelectorAll('.notif .notifCloseBtn'))
        e.addEventListener('click', el => closeBtn(el.target.parentNode))

    for (const e of document.querySelectorAll('.menu ul li'))
        e.addEventListener('click', e => {
            const a = e.target.querySelector('a');
            if (a?.getAttribute('href'))
                if (a.getAttribute('target') === '_blank') open(a.href);
                else location.href = a.href;
        });

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active')) return menuBox.classList.add('active');
            closeMenuBox();
        } else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox'))
            closeMenuBox();
    });
});