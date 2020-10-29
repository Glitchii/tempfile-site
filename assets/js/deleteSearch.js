window.onload = () => {
    document.querySelectorAll('.dt').forEach(el => el.innerText = new Date(el.innerText).toDateString());
    let inp = document.querySelector('main input'),
        menuBox = document.querySelector('.menuBox'),
        links = document.querySelector('.links'),
        closeMenuBox = () => {
            menuBox.animate([
                { top: '50px', opacity: '1', offset: .7 },
                { top: '20px', opacity: '0', offset: 1 }
            ], {
                duration: 900,
                easing: 'ease'
            })
                .onfinish = () => menuBox.classList.remove('active');
        }, load = (animate) => {
            loader.style.display = 'revert';
            if (animate) {
                loader.animate([
                    { transform: 'translate(-50%, -100px)', opacity: '0' },
                    { transform: 'translate(-50%, 20px)' }
                ], {
                    duration: 500,
                    easing: 'ease'
                })
                    .onfinish = () => loader.style.removeProperty('display');
            };
        }, loaded = (ms) => {
            loader.animate([
                { transform: 'translate(-50%, 50px)', opacity: '1', offset: .7 },
                { transform: 'translate(-50%, -100px)', opacity: '0', offset: 1 }
            ], {
                duration: ms || 700,
                easing: 'ease'
            })
                .onfinish = () => loader.style.removeProperty('display');

        };
    inp.focus();
    document.querySelector('.submit').addEventListener('click', () => {
        let val = inp.value, m = val.match('(?<=' + window.location.host + '/file/).+$');
        if (val) window.location = `/del/${m && m[0] ? m[0] : val}`;
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