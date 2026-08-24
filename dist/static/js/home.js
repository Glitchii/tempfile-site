let fixed;

const closeBtn = (el, func, arg) =>
    el.animate({ bottom: '-90px', opacity: '0' }, { duration: 500, easing: 'cubic-bezier(.68, -0.55, .27, 1.55)' })
        .onfinish = () => {
            el.style.display = 'none';
            if (func && arg) setTimeout(func, 200, arg);
        },
    edit = element => {
        element.focus();
        document.execCommand('selectAll', false, null);
        document.getSelection().collapseToEnd();
    }, local = d => {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000; // Offset milliseconds
        return (new Date((d ? new Date(d) : new Date()) - tzoffset)).toISOString().replace(/(?<=T\d+:\d+):.+/g, '');
    }, notify = (text = "Hello world", type = 1, ms = 5000) => {
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
    }, dateFromValue = str => {
        const digit = +str.replace(/\D+$/, '');
        const date = !str ? null : new Date(
            str.endsWith('m') ? (new Date).setMinutes((new Date).getMinutes() + digit) :
                str.endsWith('h') ? (new Date).setHours((new Date).getHours() + digit) :
                    str.endsWith('d') ? (new Date).setDate((new Date).getDate() + digit) :
                        str.endsWith('w') ? (new Date).setDate((new Date).getDate() + 7 * digit) :
                            str.endsWith('mo') ? (new Date).setMonth((new Date).getMonth() + digit) :
                                new Date(str).setMinutes(new Date(str).getMinutes() + 1));

        return !date.getDate() ? null : date > new Date((new Date).setMonth((new Date).getMonth() + 1)) ? 1 : date < new Date().setMinutes(new Date().getMinutes() + .5) ? 0 : date;
    };

addEventListener('DOMContentLoaded', () => {
    const menuBox = document.querySelector('.menuBox'),
        links = document.querySelector('.links'),
        loader = document.querySelector(".loader"),
        uploadInput = document.querySelector('input#upload'),
        drag = document.querySelector('.drag');
    closeMenuBox = () =>
        menuBox.animate([{ top: '50px', opacity: '1', offset: .7 }, { top: '20px', opacity: '0', offset: 1 }], { duration: 900, easing: 'ease' })
            .onfinish = () => menuBox.classList.remove('active');
    closeLinksBox = () => {
        document.querySelector('.ov').style.opacity = 0;
        links.animate({ top: '-600px', opacity: 0 }, { duration: 500, easing: 'ease' })
            .onfinish = () => {
                document.body.classList.remove('showLinks');
                document.querySelector('.ov').style.removeProperty('opacity');
            }
    }, load = animate => {
        loader.style.display = 'revert';
        if (animate)
            loader.animate([{ transform: 'translate(-50%, -100px)', opacity: '0' }, { transform: 'translate(-50%, 20px)' }], { duration: 500, easing: 'ease' })
                .onfinish = () => loader.style.removeProperty('display');
    }

    loaded = ms =>
        loader.animate([{ transform: 'translate(-50%, 50px)', opacity: '1', offset: .7 }, { transform: 'translate(-50%, -100px)', opacity: '0', offset: 1 }], { duration: ms || 700, easing: 'ease' })
            .onfinish = () => loader.style.removeProperty('display'), reset = () => {
                drag.classList.remove('hasFile', 'notImg');
                uploadInput.value = '';
                for (const e of document.querySelectorAll('.btns .btn:not(.other) .input'))
                    e.value = '';
            };

    for (const e of document.querySelectorAll('.closeBtn, .ov'))
        e.addEventListener('click', closeLinksBox);

    for (const e of document.querySelectorAll('.menu ul li'))
        e.addEventListener('click', el => {
            const anchor = el.target.querySelector('a');
            if (anchor && anchor.getAttribute('href')) {
                if (anchor.getAttribute('target') && anchor.getAttribute('target') === '_blank') open(anchor.href);
                else location.href = anchor.href;
            };
        });

    document.body.addEventListener('click', el => {
        if (el.target.classList.contains('lines')) {
            if (!menuBox.classList.contains('active'))
                return menuBox.classList.add('active');
            closeMenuBox();
        } else if (menuBox && menuBox.classList.contains('active') && el.target !== menuBox && !el.target.closest('.menuBox'))
            closeMenuBox();
    });

    const timeGui = document.querySelector('.timeGui'), sel = document.querySelector('.datetime select'), allOpts = sel.querySelectorAll('option');
    timeGui.min = local(), timeGui.max = local(new Date((new Date).setMonth((new Date).getMonth() + 1)));
    timeGui.value = local(dateFromValue(sel.querySelector('option[selected]').value));

    const createCust = () => {
        const el = document.createElement('option');
        el.setAttribute('class', 'cust');
        el.setAttribute('value', local(timeGui.value));
        el.setAttribute('selected', '');
        el.setAttribute('disabled', '');
        el.innerText = new Date(local(timeGui.value)).toString().replace(/(\w+)\s(\w+)\s(\w+)\s(.+):\d+\s.+$/, '$1, $3 $2 $4');
        sel.insertBefore(el, allOpts[allOpts.length - 1]);
    };

    timeGui.onchange = () => {
        for (const s of document.querySelectorAll('option[selected]'))
            s.removeAttribute('selected');
        for (const c of document.querySelectorAll('option.cust'))
            c.remove();

        createCust();
        fixed = true;
    };

    sel.onchange = e => {
        timeGui.value = local(dateFromValue(e.target.options[e.target.selectedIndex].value));
        for (const s of document.querySelectorAll('option[selected]'))
            s.removeAttribute('selected');
        for (const c of document.querySelectorAll('option.cust'))
            c.remove();

        e.target.options[e.target.selectedIndex].setAttribute('selected', '');
        fixed = false;
    };

    const dTChanger = () => {
        setTimeout(dTChanger, (60 - new Date().getSeconds()) * 1000);
        if (!fixed) {
            timeGui.value = local(dateFromValue(sel.querySelector('option[selected]').value));
            let cust = document.querySelectorAll('option.cust');
            if (cust.length >= 1) {
                for (const c of cust)
                    c.remove();
                createCust();
            };
        };
    };

    dTChanger();

    for (const e of document.querySelectorAll('.addMore'))
        e.addEventListener('click', el => {
            const btn = el.target.closest('.btn'),
                newBtn = btn.cloneNode(true),
                cls = ('.btn.' + btn.classList[1]),
                all = document.querySelectorAll(cls),
                placeholder = all[all.length - 1].querySelector('input').placeholder;

            if (all.length >= 5)
                return notify('You can only add up to 5');
            newBtn.querySelector('.addMore')?.remove();

            const done = btn.parentNode.insertBefore(btn.parentNode.appendChild(newBtn), all[all.length - 1].nextSibling);
            done.querySelector('input').placeholder = all.length === 1 ? (placeholder + ' (2)') : `${placeholder.slice(0, -3)} (${(parseInt(placeholder.slice(-2, -1)) + 1)})`;
            done.outerHTML = document.querySelector('.sep').outerHTML + done.outerHTML;
            // if (document.querySelectorAll(cls).length >= 5) el.target.closest('.addMore')?.remove();
        });

    const btnsInner = document.querySelector('.btns .inner'),
        submitInput = document.querySelector('.submitInput'),
        submitBtn = btnsInner.querySelector('.submit'),
        inp = document.querySelector('.urls input');

    document.querySelector('.urls .linkBtns .linkBtn.copy').addEventListener('click', () => {
        inp.select(); document.execCommand("copy");
    });

    for (const btn of document.querySelectorAll('.notif .notifCloseBtn'))
        btn.addEventListener('click', e => closeBtn(el.target.parentNode));

    for (const e of document.querySelectorAll('.qMark'))
        e.addEventListener('click', el => {
            const btn = el.target.closest('.btn');

            if (!btn.classList.contains('qMarkClicked'))
                return btn.classList.add('qMarkClicked');

            btn.querySelector('.qMarkDesc').animate({ transform: 'translateY(-35px)', opacity: 0 }, { duration: 300, easing: 'ease' })
                .onfinish = () => btn.classList.remove('qMarkClicked')
        });

    document.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const name = btnsInner.querySelector('.btn.name input').value, data = {},
            ip = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipBlackList input')).filter(el => el.value).map(el => el.value.trim()),
            ip2 = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipWhiteList input')).filter(el => el.value).map(el => el.value.trim()),
            authKey = document.querySelector('.btnsInner .inner > .other  .inputOptions input').value,
            limit = btnsInner.querySelector('.btn.limit input').value,
            pass = btnsInner.querySelector('.btn.pass input').value,
            date = new Date(local(timeGui.value));

        if (limit) data.limit = limit;
        if (name) data.name = name;
        if (pass) data.pass = pass;
        if (ip.length > 0) data.ipblacklist = ip;
        if (ip2.length > 0) data.ipwhitelist = ip2;
        if ((date - new Date()) / (24 * 60 * 60 * 1000) > 31) return notify('Chosen duration is over the limit');
        if (date < new Date(local())) return notify('Chosen duration is behind');
        if (authKey) data.authkey = authKey;
        if (document.body.classList.contains('text')) {
            const textarea = document.querySelector('textarea');
            data.text = textarea.value;
            if (!data.text) {
                notify('Please enter some text');
                return textarea.focus();
            }
        }

        load();

        const formData = new FormData(e.target);
        formData.append('data', JSON.stringify({ ...data, diff: Math.ceil((date - new Date()) / (60 * 1000)) }));

        fetch('/upload/', { method: "POST", body: formData })
            .then(res => {
                loaded();
                res.json().then(res => {
                    if (res.err) return notify(res.err);
                    inp.value = `${location.protocol}//${location.host}/files/${res.link}`;
                    inp.closest('.urls').querySelector('.linkBtns .linkBtn.del').href = inp.value.replace('/files/', '/delete/');
                    inp.closest('.urls').querySelector('.linkBtns .linkBtn.goToLink').href = inp.value;
                    document.body.classList.add('showLinks');
                    reset(); inp.select();
                }).catch(() => notify(`Upload failed (${res.status}). [Report issue](https://github.com/Glitchii/tempfile.site/issues)?`));
            });
    });

    submitBtn.addEventListener('click', () => {
        submitInput.click();
        if (matchMedia('(max-width: 1125px)').matches)
            scrollTo({ top: 0, behavior: 'smooth' });
    });

    const previewFile = files => {
        document.body.classList.remove('text');
        let fs = Array.from(files);
        if (!fs.length) return reset();
        if (fs[0].size > 2000000000) return notify(`File too large, the limit is 2GB`);
        if (!fs[0].size && !/.+?\.[^\.]+$/.exec(fs[0].name)) {
            notify('File has no extension or size.');
            uploadInput.value = '';
            return reset();
        }

        const reader = new FileReader();
        if (matchMedia('(max-width: 1125px)').matches)
            setTimeout(() =>
                scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: 'smooth'
                }), 500);

        if (fs[0].type.startsWith('image/'))
            reader.onload = e => {
                document.querySelector('.partInner .img.otherImg').setAttribute('src', e.target.result);
                drag.classList.remove('notImg');
                drag.classList.add('hasFile');
            };
        else {
            const ext = fs[0].name.split('.').pop();
            document.querySelector('.partInner .fileIcon p').innerText = ext.length <= 5 ? ext : fs[0].name.substr(0, 2) + '...';
            drag.classList.add(...['hasFile', 'notImg']);
        }

        loaded();
        reader.readAsDataURL(fs[0]);
    };

    uploadInput.addEventListener('change', e => e.target.files && previewFile(e.target.files));

    const dragParent = drag.closest('.dragParent');
    dragParent.addEventListener('dragover', () => false);
    dragParent.addEventListener('drop', e => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files) {
            uploadInput.files = files;
            previewFile(files);
        }
    });

    document.addEventListener('paste', e => {
        const data = e.clipboardData;
        if (data.files && Array.from(data.files).length > 0) {
            uploadInput.files = data.files;
            previewFile(data.files);
        }
    });

    const backControl = document.querySelector('.btnsInner .inner > .controls  .backControl');
    const backControl2 = document.querySelector('.btnsInner .inner > .other  .backControl');
    backControl.addEventListener('click', () => {
        backControl.animate([
            { offset: 0 },
            { transform: 'translate(70px)', opacity: 0, offset: 1 },
        ], { duration: 300, easing: 'ease' }).onfinish = () => {
            backControl.closest('.inner').classList.add('others')
            backControl2.animate([
                { transform: 'translateX(-100px)', opacity: 0, offset: 0 },
                { offset: 1 },
            ], { duration: 300, easing: 'ease' });

            const inp = backControl2.closest('.inputOptions').firstElementChild, tmp = inp.value;
            inp.focus();
            // Place cursor at the end of the input value
            inp.value = '', inp.value = tmp;
        };
    });

    backControl2.addEventListener('click', () =>
        backControl2.animate([{ offset: 0 }, { transform: 'translateX(-100px)', opacity: 0, offset: 1 }], { duration: 300, easing: 'ease' })
            .onfinish = () => {
                backControl2.closest('.inner.others').classList.remove('others')
                backControl.animate([{ transform: 'translate(70px)', opacity: 0, offset: 0 }, { offset: 1 },], { duration: 300, easing: 'ease' })
            });

    document.querySelector('.textBtn').addEventListener('click', () => {
        if (document.body.classList.contains('text'))
            return document.body.classList.remove('text');

        document.body.classList.add('text');
        const textarea = document.querySelector('textarea');
        textarea.value = '';
        edit(textarea);
    });
});