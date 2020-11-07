var ua = navigator.userAgent.match(/\sEdg\w\//), // For some reason Element.animate() doesn't work on Edge for mobile 
    fixed = false, local = d => {
        d = d ? new Date(d) : new Date();
        return `${d.toLocaleDateString().replace(/(\d+)\/(\d+)\/(\d+)/g, '$3-$2-$1')}T${d.toLocaleTimeString().substr(0, 5)}`;
    },
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
    }, dateFromValue = str => {
        let obj = !str ? null : new Date(
            str.endsWith('m') ? ((new Date).setMinutes((new Date).getMinutes() + parseInt(str.replace(/\D+$/, '')))) :
                str.endsWith('h') ? ((new Date).setHours((new Date).getHours() + parseInt(str.replace(/\D+$/, '')))) :
                    str.endsWith('d') ? ((new Date).setDate((new Date).getDate() + parseInt(str.replace(/\D+$/, '')))) :
                        str.endsWith('w') ? ((new Date).setDate((new Date).getDate() + (7 * parseInt(str.replace(/\D+$/, ''))))) :
                            str.endsWith('mo') ? ((new Date).setMonth((new Date).getMonth() + 1)) :
                                !!new Date(str).getDate() ? new Date(new Date(str).setMinutes(new Date(str).getMinutes() + 1)) :
                                    null
        );
        return new Date(local(obj)) > local(new Date((new Date).setMonth((new Date).getMonth() + 1))) || new Date(local(obj)) < local() ? null : obj;
    };

window.onload = () => {
    let menuBox = document.querySelector('.menuBox'),
        links = document.querySelector('.links'),
        fileImg = document.querySelector('.partInner .img.otherImg'),
        loader = document.querySelector(".loader"),
        uploadInput = document.querySelector('input#upload'),
        drag = document.querySelector('.drag'),
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
        }, closeLinksBox = () => {
            document.querySelector('.ov').style.opacity = 0;
            if (ua) {
                document.body.classList.remove('showLinks');
                return document.querySelector('.ov').style.removeProperty('opacity');
            }
            links.animate({
                top: '-600px',
                opacity: 0
            }, {
                duration: 500,
                easing: 'ease'
            })
                .onfinish = () => {
                    document.body.classList.remove('showLinks');
                    document.querySelector('.ov').style.removeProperty('opacity');
                }
        }, load = (animate) => {
            loader.style.display = 'revert';
            if (animate) {
                if (ua) return loader.style.removeProperty('display');
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
            if (ua) return loader.style.removeProperty('display');
            loader.animate([
                { transform: 'translate(-50%, 50px)', opacity: '1', offset: .7 },
                { transform: 'translate(-50%, -100px)', opacity: '0', offset: 1 }
            ], {
                duration: ms || 700,
                easing: 'ease'
            })
                .onfinish = () => loader.style.removeProperty('display');

        }, reset = () => {
            drag.classList.remove(...['hasFile', 'notImg']);
            document.querySelectorAll('.btns .btn .input').forEach(i => i.value = '');
            uploadInput.value = '';
        };

    ['.closeBtn', '.ov'].forEach(el => document.querySelector(el).addEventListener('click', () => closeLinksBox()));

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

    let timeGui = document.querySelector('.timeGui'), sel = document.querySelector('.dateTime select'), allOpts = sel.querySelectorAll('option');
    timeGui.min = local(), timeGui.max = local(new Date((new Date).setMonth((new Date).getMonth() + 1)));
    timeGui.value = local(dateFromValue(sel.querySelector('option[selected]').value));
    let createCust = () => {
        let el = document.createElement('option');
        el.setAttribute('class', 'cust');
        el.setAttribute('value', local(timeGui.value));
        el.setAttribute('selected', '');
        el.setAttribute('disabled', '');
        el.innerText = new Date(local(timeGui.value)).toString().replace(/(\w+)\s(\w+)\s(\w+)\s(.+):\d+\s.+$/, '$1, $3 $2 $4');
        sel.insertBefore(el, allOpts[allOpts.length - 1]);
    }
    timeGui.onchange = () => {
        document.querySelectorAll('option[selected]').forEach(s => { s.removeAttribute('selected') });
        document.querySelectorAll('option.cust').forEach(c => { c.remove() });
        createCust();
        window.fixed = true;
    };
    sel.onchange = e => {
        timeGui.value = local(dateFromValue(e.target.options[e.target.selectedIndex].value));
        document.querySelectorAll('option[selected]').forEach(s => { s.removeAttribute('selected') });
        document.querySelectorAll('option.cust').forEach(c => { c.remove() });
        e.target.options[e.target.selectedIndex].setAttribute('selected', '');
        window.fixed = false;
    };
    let dTChanger = () => {
        window.setTimeout(dTChanger, (60 - new Date().getSeconds()) * 1000);
        if (!window.fixed) {
            timeGui.value = local(dateFromValue(sel.querySelector('option[selected]').value));
            let cust = document.querySelectorAll('option.cust');
            if (cust.length >= 1) {
                cust.forEach(c => { c.remove(); });
                createCust();
            };
        };
    };
    dTChanger();

    document.querySelectorAll('.addMore').forEach(e => {
        e.addEventListener('click', el => {
            let btn = el.target.closest('.btn'), c = btn.cloneNode(true), cls = ('.btn.' + btn.classList[1]), all = document.querySelectorAll(cls), placeholder = all[all.length - 1].querySelector('input').placeholder;
            if (all.length >= 4) return notify('You can only add up to 4');
            c.querySelector('.addMore').remove();
            let done = btn.parentNode.insertBefore((btn.parentNode.appendChild(c)), all[all.length - 1].nextSibling);
            done.querySelector('input').placeholder = all.length === 1 ? (placeholder + ' 2') : placeholder.slice(0, -1) + (parseInt(placeholder.slice(-1)) + 1);
            done.outerHTML = document.querySelector('.sep').outerHTML + done.outerHTML;
            // if (document.querySelectorAll(cls).length >= 4) el.target.remove();
        });
    });

    let btnsInner = document.querySelector('.btns .inner'),
        submitInput = document.querySelector('.submitInput'),
        submitBtn = btnsInner.querySelector('.submit'),
        inp = document.querySelector('.urls input');

    document.querySelector('.linkBtn:first-child').addEventListener('click', () => {
        inp.select();
        inp.setSelectionRange(0, 99999);
        document.execCommand("copy");
    });

    document.querySelector('.linkBtn:last-child').addEventListener('click', el =>
        window.location.href = el.target.closest('.urls').querySelector('.btn input').value.replace('/file/', '/del/')
    );

    document.querySelectorAll('.notif .notifCloseBtn').forEach(e =>
        e.addEventListener('click', el => closeBtn(el.target.parentNode))
    );

    $("form").submit(function (e) {
        e.preventDefault();
        if (uploadInput.files.length === 0) return notify('You must add a file first');
        let name = btnsInner.querySelector('.btn.name input').value, data = { dateTime: new Date(local(timeGui.value)) },
            ip = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipBlackList input')).filter(el => el.value).map(el => el.value.trim()),
            ip2 = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipWhiteList input')).filter(el => el.value).map(el => el.value.trim()),
            limit = btnsInner.querySelector('.btn.limit input').value, pass = btnsInner.querySelector('.btn.pass input').value;

        if (limit) data.limit = limit;
        if (pass) data.pass = pass;
        if (name) data.name = name;
        if (ip.length > 0) data.ip = ip;
        if (ip2.length > 0) data.ip2 = ip2;
        if ((data.dateTime - new Date()) / (24 * 60 * 60 * 1000) > 31) return notify('Given date is over the allowed');
        if (data.dateTime < local()) return notify('Given date or time is behind');
        if (data.dateTime < new Date()) return notify('Looks like that time is alittle behind');

        load();
        $.ajax({
            type: "POST",
            url: `/upload/${btoa(JSON.stringify(data))}`,
            data: new FormData(this),
            processData: false,
            contentType: false,
            success: function (r) {
                inp.value = `${window.location.protocol}//${window.location.host}${r.url}`;
                document.body.classList.add('showLinks');
                loaded(); reset(); inp.select();
            },
            error: function (e) {
                if (e.status === 417) notify(e.responseText || e.statusText);
                else if (e.status === 0) notify("Upload failed. [Report issue](https://github.com/Glitchii/tempfile.site/issues)?");
                loaded();
            }
        });
    });

    submitBtn.addEventListener('click', () => submitInput.click());

    let previewFile = (files) => {
        if (files.length === 0) return reset();
        if (!files[0].type) {
            notify('Unknown type, did you upload a folder?');
            return reset();
        }
        uploadInput.files = files;
        let reader = new FileReader();
        if (window.matchMedia('(max-width: 1125px)').matches) setTimeout(() => window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        }), 1000);

        if (files[0].type.startsWith('image/')) {
            reader.onload = (e) => {
                fileImg.setAttribute('src', e.target.result);
                drag.classList.add('hasFile');
            };
        } else {
            let ext = files[0].name.split('.').pop();
            document.querySelector('.partInner div .fileIcon p').innerText = ext.length <= 5 ? ext : files[0].name.substr(0, 2) + '...';
            drag.classList.add(...['hasFile', 'notImg']);
        }
        loaded();

        reader.readAsDataURL(files[0]);
    };

    uploadInput.onchange = (e) => {
        if (e.target.files) previewFile(e.target.files);
    }

    let dP = drag.closest('.dragParent');
    dP.ondragover = () => false;
    dP.ondrop = (e) => {
        e.preventDefault();
        let files = e.dataTransfer.files;
        if (files) previewFile(files);
    };

    document.onpaste = (e) => {
        var items = e.clipboardData || e.originalEvent.clipboardData;
        if (items.files && items.files.length > 0) previewFile(items.files);
    };
};