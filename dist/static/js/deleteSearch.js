addEventListener('DOMContentLoaded', () => {
    for (const e of document.querySelectorAll('.dt'))
        e.innerText = new Date(e.innerText).toDateString();

    const inp = document.querySelector('main input'),
        menuBox = document.querySelector('.menuBox'),
        closeMenuBox = () =>
            menuBox.animate([{ top: '50px', opacity: '1', offset: .7 }, { top: '20px', opacity: '0', offset: 1 }], { duration: 900, easing: 'ease' })
                .onfinish = () => menuBox.classList.remove('active'),
        submit = () => {
            const val = inp.value, m = val.match('(?<=' + location.host + '/files/).+$');
            if (val) location = `/delete/${m && m[0] ? m[0] : val}`;
        };

    inp.focus();

    document.querySelector('.submit').addEventListener('click', submit);
    inp.addEventListener('keypress', k => k.code == 'Enter' && submit());

    for (const e of document.querySelectorAll('.menu ul li'))
        e.addEventListener('click', el => {
            const a = el.target.querySelector('a');
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
});