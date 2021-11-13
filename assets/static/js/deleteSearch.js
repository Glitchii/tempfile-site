var ua = navigator.userAgent.match(/\sEdg\w\//)

window.onload = () => {
    document.querySelectorAll('.dt').forEach(el => el.innerText = new Date(el.innerText).toDateString());
    let inp = document.querySelector('main input'),
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
        }, submit = () => {
            let val = inp.value, m = val.match('(?<=' + window.location.host + '/files/).+$');
            if (val) window.location = `/del/${m && m[0] ? m[0] : val}`;
        };
    inp.focus();

    document.querySelector('.submit').addEventListener('click', submit);
    inp.addEventListener('keypress', (k) => {
        if (k.code == 'Enter') submit();
    });

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
};