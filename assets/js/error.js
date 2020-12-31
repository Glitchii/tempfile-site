window.onload = () => {
    let ua = navigator.userAgent.match(/\sEdg\w\//),
        menuBox = document.querySelector('.menuBox'),
        homeBtn = document.querySelector('.home'),
        authKey = document.querySelector('.useAuth input'),
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
        }, deny = () => document.querySelector('.useAuth').animate([
            { transform: 'translateX(-10px)', offset: .2 },
            { transform: 'translateX(10px)', offset: .4 },
            { transform: 'translateX(-10px)', offset: .6 },
            { transform: 'translateX(10px)', offset: .8 },
            { transform: 'translateX(0px)', offset: 1 },
        ], { easing: 'ease', duration: 500 });

    document.querySelectorAll('.menu ul li').forEach(el => {
        el.addEventListener('click', e => {
            let a = e.target.querySelector('a');
            if (a && a.getAttribute('href')) {
                if (a.getAttribute('target') && a.getAttribute('target') === '_blank') window.open(a.href);
                else window.location.href = a.href;
            };
        });
    });

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active')) return menuBox.classList.add('active');
            closeMenuBox();
        }
        else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox')) closeMenuBox();
    });

    homeBtn.addEventListener('click', () => !homeBtn.classList.contains('usingAuth') ? (window.location.href = '/') : !authKey.value ? deny() : fetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: `{ "key": "${authKey.value}" }`
    })
        .then(res => res.status === 200 ? window.location.reload() : res.status !== 401 ? `Error—${res.statusText} (${res.status})` : deny()));

    authKey && authKey.addEventListener('keyup', () =>
        !homeBtn.classList.contains('usingAuth') && homeBtn.classList.add('usingAuth'));
};