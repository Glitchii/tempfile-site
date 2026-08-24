addEventListener('DOMContentLoaded', () => {
    const menuBox = document.querySelector('.menuBox'),
        closeMenuBox = () =>
            menuBox.animate([{ top: '50px', opacity: '1', offset: .7 }, { top: '20px', opacity: '0', offset: 1 }], { duration: 900, easing: 'ease' })
                .onfinish = () => menuBox.classList.remove('active');

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

    for (const e of document.querySelectorAll(':is(h1, h2)[id]'))
        e.addEventListener('click', el =>
            location.href = location.origin + location.pathname + '#' + el.target.id);
});