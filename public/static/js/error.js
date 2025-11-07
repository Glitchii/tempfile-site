addEventListener('DOMContentLoaded', () => {
    const menuBox = document.querySelector('.menuBox'),
        homeBtn = document.querySelector('.home'),
        authKey = document.querySelector('.useAuth input'),
        closeMenuBox = () =>
            menuBox.animate([{ top: '50px', opacity: '1', offset: .7 }, { top: '20px', opacity: '0', offset: 1 }], { duration: 900, easing: 'ease' })
                .onfinish = () => menuBox.classList.remove('active'),
        deny = () =>
            document.querySelector('.useAuth')
                .animate([
                    { transform: 'translateX(-10px)', offset: .2 },
                    { transform: 'translateX(10px)', offset: .4 },
                    { transform: 'translateX(-10px)', offset: .6 },
                    { transform: 'translateX(10px)', offset: .8 },
                    { transform: 'translateX(0px)', offset: 1 },
                ], { easing: 'ease', duration: 500 });

    for (const e of document.querySelectorAll('.menu ul li'))
        e.addEventListener('click', e => {
            const a = e.target.querySelector('a');
            if (a?.getAttribute('href'))
                if (a.getAttribute('target') === '_blank') open(a.href);
                else location.href = a.href;
        });

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active'))
                return menuBox.classList.add('active');
            closeMenuBox();
        } else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox'))
            closeMenuBox();
    });

    homeBtn.addEventListener('click', () =>
        !homeBtn.classList.contains('usingAuth') ? location.href = '/' :
            !authKey.value ? deny() :
                fetch("/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: `{ "key": "${authKey.value}", "name": "${location.pathname.split('/').pop()}" }`
                })
                    .then(res => res.status === 200 ? location.reload() : res.status !== 401 ? `Error—${res.statusText} (${res.status})` : deny()));

    authKey?.addEventListener('keyup', () => !homeBtn.classList.contains('usingAuth') && homeBtn.classList.add('usingAuth'));
});