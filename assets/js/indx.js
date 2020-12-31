var ua = navigator.userAgent.match(/\sEdg\w\//), // For some reason Element.animate() doesn't work on Edge for mobile 
    fixed = false, local = d => {
        let tzoffset = (new Date()).getTimezoneOffset() * 60000; // Offset milliseconds
        return (new Date((d ? new Date(d) : new Date()) - tzoffset)).toISOString().replace(/(?<=T\d+:\d+):.+/g, '');
    },
    closeBtn = (el, func, arg) => {
        let _do = () => {
            el.style.display = 'none';
            if (func && arg) setTimeout(() => func(arg), 200);
        }
        if (ua) return _do();
        el.animate({ bottom: '-90px', opacity: '0' }, { duration: 500, easing: 'cubic-bezier(.68, -0.55, .27, 1.55)' }).onfinish = _do;
    }, notify = (text, type, ms) => {
        text = text ? text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : "Hello world", type = type || 1, ms = ms || 5000;
        let notif = document.querySelector(".notif"), normal = notif.querySelector(".normal"), success = notif.querySelector(".success"), nor = notif.querySelector('.normal[style*="display: flex;"]'), succ = notif.querySelector('.success[style*="display: flex;"]'), re = /\[(.+)\]\((.+)\)/ig.exec(text);
        let doNext = (elm) => {
            if (re && re.length === 3) text = text.replace(re[0], `<a class="lnk" target="_blank" href="${re[2]}">${re[1]}</a>`);
            elm.style.display = 'flex', elm.querySelector('.content p').innerHTML = text;
            setTimeout(() => closeBtn(elm), ms);
        };
        if (nor || succ) closeBtn((nor || succ), doNext, type === 2 ? success : normal);
        else doNext(type === 2 ? success : normal);
    }, dateFromValue = str => {
        let obj = !str ? null :
            str.endsWith('m') ? ((new Date).setMinutes((new Date).getMinutes() + parseInt(str.replace(/\D+$/, '')))) :
                str.endsWith('h') ? ((new Date).setHours((new Date).getHours() + parseInt(str.replace(/\D+$/, '')))) :
                    str.endsWith('d') ? ((new Date).setDate((new Date).getDate() + parseInt(str.replace(/\D+$/, '')))) :
                        str.endsWith('w') ? ((new Date).setDate((new Date).getDate() + (7 * parseInt(str.replace(/\D+$/, ''))))) :
                            str.endsWith('mo') ? ((new Date).setMonth((new Date).getMonth() + 1)) :
                                !!new Date(str).getDate() ? new Date(new Date(str).setMinutes(new Date(str).getMinutes() + 1)) :
                                    null

        return obj && new Date(local(obj)) > local(new Date((new Date).setMonth((new Date).getMonth() + 1))) || new Date(local(obj)) < local() ? null : new Date(obj);
    },
    dateFromValue = str => {
        let digit = parseFloat(str.replace(/\D+$/, '')), obj = !str ? null : new Date(
            str.endsWith('m') ? ((new Date).setMinutes((new Date).getMinutes() + digit)) :
                str.endsWith('h') ? ((new Date).setHours((new Date).getHours() + digit)) :
                    str.endsWith('d') ? ((new Date).setDate((new Date).getDate() + digit)) :
                        str.endsWith('w') ? ((new Date).setDate((new Date).getDate() + (7 * digit))) :
                            str.endsWith('mo') ? ((new Date).setMonth((new Date).getMonth() + digit)) :
                                new Date(new Date(str).setMinutes(new Date(str).getMinutes() + 1))
        );
        return !obj.getDate() ? null : new Date(obj) > new Date((new Date).setMonth((new Date).getMonth() + 1)) ? 1 : new Date(obj) < new Date().setMinutes(new Date().getMinutes() + .5) ? 0 : new Date(obj);
    };

window.onload = () => {
    let menuBox = document.querySelector('.menuBox'),
        links = document.querySelector('.links'),
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
            document.querySelectorAll('.btns .btn:not(.other) .input').forEach(i => i.value = '');
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

    let timeGui = document.querySelector('.timeGui'), sel = document.querySelector('.datetime select'), allOpts = sel.querySelectorAll('option');
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
            if (all.length >= 5) return notify('You can only add up to 5');
            c.querySelector('.addMore').remove();
            let done = btn.parentNode.insertBefore((btn.parentNode.appendChild(c)), all[all.length - 1].nextSibling);
            done.querySelector('input').placeholder = all.length === 1 ? (placeholder + ' 2') : placeholder.slice(0, -1) + (parseInt(placeholder.slice(-1)) + 1);
            done.outerHTML = document.querySelector('.sep').outerHTML + done.outerHTML;
            // if (document.querySelectorAll(cls).length >= 5) el.target.remove();
        });
    });

    let btnsInner = document.querySelector('.btns .inner'),
        submitInput = document.querySelector('.submitInput'),
        submitBtn = btnsInner.querySelector('.submit'),
        inp = document.querySelector('.urls input');

    document.querySelector('.urls .linkBtns .linkBtn.copy').addEventListener('click', () => {
        inp.select(); document.execCommand("copy");
    });

    document.querySelectorAll('.notif .notifCloseBtn').forEach(e =>
        e.addEventListener('click', el => closeBtn(el.target.parentNode))
    );

    document.querySelectorAll('.qMark').forEach(e =>
        e.addEventListener('click', el => {
            let btn = el.target.closest('.btn');
            if (btn.classList.contains('qMarkClicked')) btn.querySelector('.qMarkDesc').animate
                ({ transform: 'translateY(-35px)', opacity: 0 },
                    { duration: 300, easing: 'ease' })
                .onfinish = () => btn.classList.remove('qMarkClicked')
            else btn.classList.add('qMarkClicked');
        }));

    document.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        console.log(e)
        let data = { datetime: new Date(local(timeGui.value)) },
            name = btnsInner.querySelector('.btn.name input').value,
            ip = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipBlackList input')).filter(el => el.value).map(el => el.value.trim()),
            ip2 = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipWhiteList input')).filter(el => el.value).map(el => el.value.trim()),
            authKey = document.querySelector('.btnsInner .inner > .other  .inputOptions input').value,
            limit = btnsInner.querySelector('.btn.limit input').value, pass = btnsInner.querySelector('.btn.pass input').value;

        if (limit) data.limit = limit;
        if (pass) data.pass = pass;
        if (ip.length > 0) data.ipblacklist = ip;
        if (ip2.length > 0) data.ipwhitelist = ip2;
        if ((data.datetime - new Date()) / (24 * 60 * 60 * 1000) > 31) return notify('Chosen duration is over the limit');
        if (data.datetime < new Date(local())) return notify('Chosen duration is behind');
        if (authKey) data.authkey = authKey;
        load();

        let formData = new FormData(e.target);
        formData.append('data', JSON.stringify(data));

        fetch('/upload/' + btoa(name), {
            method: "POST",
            body: formData
        })
            .then(res => {
                loaded();
                res.json().then(res => {
                    if (res.err) return notify(res.err);
                    inp.value = `${window.location.protocol}//${window.location.host}/files/${res.link}`;
                    inp.closest('.urls').querySelector('.linkBtns .linkBtn.del').href = inp.value.replace('/files/', '/del/');
                    inp.closest('.urls').querySelector('.linkBtns .linkBtn.goToLink').href = inp.value;
                    document.body.classList.add('showLinks');
                    reset(); inp.select();
                }).catch(() => notify(`Upload failed (${res.status}). [Report issue](https://github.com/Glitchii/tempfile.site/issues)?`));
            });
    });

    submitBtn.addEventListener('click', () => {
        submitInput.click();
        if (window.matchMedia('(max-width: 1125px)').matches) window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    let previewFile = (files) => {
        fs = Array.from(files)
        if (fs.length === 0) return reset();
        if (!fs[0].size && !/.+?\.[^\.]+$/.exec(fs[0].name)) {
            notify('File has no extension or size, is it a folder?');
            uploadInput.value = '';
            return reset();
        }

        let reader = new FileReader();
        if (window.matchMedia('(max-width: 1125px)').matches) setTimeout(() => window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        }), 500);

        if (fs[0].type.startsWith('image/')) {
            reader.onload = (e) => {
                document.querySelector('.partInner .img.otherImg').setAttribute('src', e.target.result);
                drag.classList.remove('notImg');
                drag.classList.add('hasFile');
            };
        } else {
            let ext = fs[0].name.split('.').pop();
            document.querySelector('.partInner .fileIcon p').innerText = ext.length <= 5 ? ext : fs[0].name.substr(0, 2) + '...';
            drag.classList.add(...['hasFile', 'notImg']);
        }
        loaded();

        reader.readAsDataURL(fs[0]);
    };

    uploadInput.onchange = (e) => {
        if (e.target.files) previewFile(e.target.files);
    }

    let dP = drag.closest('.dragParent');
    dP.ondragover = () => false;
    dP.ondrop = (e) => {
        e.preventDefault();
        let files = e.dataTransfer.files;
        if (files) {
            uploadInput.files = files;
            previewFile(files);
        }
    };

    document.onpaste = (e) => {
        let data = e.clipboardData;
        if (data.files && Array.from(data.files).length > 0) {
            uploadInput.files = data.files;
            previewFile(data.files);
        }
    };

    let backControl = document.querySelector('.btnsInner .inner > .controls  .backControl'),
        backControl2 = document.querySelector('.btnsInner .inner > .other  .backControl');
    backControl.addEventListener('click', () => {
        backControl.animate([
            { offset: 0 },
            { transform: 'translate(70px)', opacity: 0, offset: 1 },
        ], {
            duration: 300,
            easing: 'ease'
        }).onfinish = () => {
            backControl.closest('.inner').classList.add('others')
            backControl2.animate([
                { transform: 'translateX(-100px)', opacity: 0, offset: 0 },
                { offset: 1 },
            ], {
                duration: 300,
                easing: 'ease'
            });
            let inp = backControl2.closest('.inputOptions').firstElementChild, tmp = inp.value;
            inp.focus();
            inp.value = '', inp.value = tmp; // Put cursor at the end of text
        };
    });
    backControl2.addEventListener('click', () => {
        backControl2.animate([
            { offset: 0 },
            { transform: 'translateX(-100px)', opacity: 0, offset: 1 },
        ], {
            duration: 300,
            easing: 'ease'
        }).onfinish = () => {
            backControl2.closest('.inner.others').classList.remove('others')
            backControl.animate([
                { transform: 'translate(70px)', opacity: 0, offset: 0 },
                { offset: 1 },
            ], {
                duration: 300,
                easing: 'ease'
            })
        };
    });

};