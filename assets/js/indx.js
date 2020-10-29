var fixed = false, min = new Date(), max = new Date((new Date).setMonth((new Date).getMonth() + 1)), local = d => { return d.toLocaleString().replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/g, '$3-$2-$1T$4:$5'); },
    closeBtn = (el) => {
        try { el.animate({ bottom: '-50px', opacity: '0' }, { duration: 500, easing: 'cubic-bezier(.68, -0.55, .27, 1.55)' }).onfinish = () => el.remove(); }
        catch { };
    },
    notify = (text, type, ms) => {
        text = text || "Hello world", type = type || 1, ms = ms || 5000;
        let notif = document.querySelector(".notification"), normal = notif.querySelectorAll(".normal"), success = notif.querySelectorAll(".success"), content = notif.querySelectorAll(".content"), marginBottom = 0;
        let whatToDo = (what, class_) => {
            if (content) content.forEach(el => { marginBottom += 40; el.style.marginBottom = `${marginBottom}px`; });
            notif.innerHTML += `<div class="${class_.slice(1)} content"><img src="${what === success ? '/assets/imgs/mark.svg' : '/assets/imgs/iBubble.svg'}" width="20px" height="20px" alt=""><p>${text}</p><div class="notifCloseBtn" onclick="closeBtn(this.parentElement)"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svgjs="http://svgjs.com/svgjs" version="1.1" width="512" height="512" x="0" y="0" viewBox="0 0 426.66667 426.66667" style="enable-background:new 0 0 512 512" xml:space="preserve" class=""><g><path xmlns="http://www.w3.org/2000/svg" d="m405.332031 192h-170.664062v-170.667969c0-11.773437-9.558594-21.332031-21.335938-21.332031-11.773437 0-21.332031 9.558594-21.332031 21.332031v170.667969h-170.667969c-11.773437 0-21.332031 9.558594-21.332031 21.332031 0 11.777344 9.558594 21.335938 21.332031 21.335938h170.667969v170.664062c0 11.777344 9.558594 21.335938 21.332031 21.335938 11.777344 0 21.335938-9.558594 21.335938-21.335938v-170.664062h170.664062c11.777344 0 21.335938-9.558594 21.335938-21.335938 0-11.773437-9.558594-21.332031-21.335938-21.332031zm0 0" fill="#000000" data-original="#000000"></path></g></svg></div></div>`;
            if (what[0] || notif.querySelector(class_)) { document.querySelectorAll(class_).forEach((el) => { el.style.opacity = 1; }) };
            setTimeout(() => closeBtn(document.querySelectorAll(class_)[0]), ms);
        };
        if (type === 1) whatToDo(normal, '.normal');
        else if (type === 2) whatToDo(success, '.success');
    },
    dateFromValue = str => {
        let obj = !str ? null : new Date(
            str.endsWith('m') ? ((new Date).setMinutes((new Date).getMinutes() + parseInt(str.replace(/\D+$/, '')))) :
                str.endsWith('h') ? ((new Date).setHours((new Date).getHours() + parseInt(str.replace(/\D+$/, '')))) :
                    str.endsWith('d') ? ((new Date).setDate((new Date).getDate() + parseInt(str.replace(/\D+$/, '')))) :
                        str.endsWith('w') ? ((new Date).setDate((new Date).getDate() + (7 * parseInt(str.replace(/\D+$/, ''))))) :
                            str.endsWith('mo') ? ((new Date).setMonth((new Date).getMonth() + parseInt(str.replace(/\D+$/, '')))) :
                                !!new Date(str).getDate() ? new Date(new Date(str).setMinutes(new Date(str).getMinutes() + 1)) :
                                    null
        );
        return new Date(local(obj)) > max || new Date(local(obj)) < min ? null : obj;
    };

const sock = io.connect(window.location.origin);
window.onload = () => {
    let menuBox = document.querySelector('.menuBox'),
        links = document.querySelector('.links'),
        fileIcon = document.querySelector('.partInner div .fileIcon'),
        fileImg = document.querySelector('.partInner div img'),
        loader = document.querySelector(".loader"),
        uploadInput = document.querySelector('input#upload'),
        closeMenuBox = () => {
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

        }, reset = () => {
            let div = document.querySelector('.partInner div:nth-of-type(2)')
            div.querySelector('h2').innerText = 'Drag file here';
            div.querySelector('p').style.removeProperty('opacity');
            fileIcon.style.removeProperty('display');
            fileImg.setAttribute('src', '/assets/imgs/upload.svg');
            fileImg.style.removeProperty('display');
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
    timeGui.min = local(min);
    timeGui.max = local(max);
    timeGui.value = local(dateFromValue(sel.querySelector('option[selected]').value));
    let createCust = () => {
        let el = document.createElement('option');
        el.setAttribute('class', 'cust');
        el.setAttribute('value', local(new Date(timeGui.value)));
        el.setAttribute('selected', '');
        el.setAttribute('disabled', '');
        el.innerText = new Date(local(timeGui.value)).toString().replace(/(\w+)\s(\w+)\s(\w+)\s(.+):\d+\s.+$/, '$1, $3 $2 $4');
        sel.insertBefore(el, allOpts[allOpts.length - 1]);
    }
    timeGui.onchange = e => {
        document.querySelectorAll('option[selected]').forEach(s => { s.removeAttribute('selected') });
        document.querySelectorAll('option.cust').forEach(c => { c.remove() });
        createCust();
        window.fixed = true; // Make time stop updating after user has changed it to custom. (Look at the 'dTChanger' function )
    };
    sel.onchange = e => {
        timeGui.value = local(dateFromValue(e.target.options[e.target.selectedIndex].value));
        document.querySelectorAll('option[selected]').forEach(s => { s.removeAttribute('selected') });
        document.querySelectorAll('option.cust').forEach(c => { c.remove() });
        e.target.options[e.target.selectedIndex].setAttribute('selected', '');
        window.fixed = false;
    };

    let dTChanger = () => { // Update datetime input when time changes
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
        document.querySelector('.linkBtn:last-child').addEventListener('click', (el) =>
            window.location.href = el.target.closest('.urls').querySelector('.btn input').value.replace('/file/', '/del/'));
        

    $("form").submit(function (e) {
        e.preventDefault();
        if (uploadInput.files.length === 0) return notify('You must first add a file');
        getI().then(IP => {
            if (!IP) return notify('Failed to get your IP which is required');
            load();
            let data = { dateTime: local(timeGui.value), userIP: IP }, name = btnsInner.querySelector('.btn.name input').value,
                ip = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipBlackList input')).filter(el => el.value).map(el => el.value.trim()),
                ip2 = Array.from(document.querySelector('.btns .inner').querySelectorAll('.btn.ipWhiteList input')).filter(el => el.value).map(el => el.value.trim()),
                limit = btnsInner.querySelector('.btn.limit input').value, pass = btnsInner.querySelector('.btn.pass input').value;

            if (ip.length > 0) data.ip = ip;
            if (ip2.length > 0) data.ip2 = ip2;
            if (limit && limit > 0) data.limit = limit;
            if (pass) data.pass = pass;
            if (name) data.name = name;

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
                    else if (e.status === 0) notify("Upload failed, did you upload a folder?");
                    else console.error("Error", `${e.status} (${e.statusText}) - ${e.responseText}`);
                    loaded();
                }
            });
        }).catch(e => {
            console.error(e);
            notify('There was an error, check console');
        });


    });

    submitBtn.addEventListener('click', () => submitInput.click());

    let previewFile = (files) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            let div = document.querySelector('.partInner div:nth-of-type(2)')
            div.querySelector('h2').innerText = 'Ready to upload';
            div.querySelector('p').style.opacity = 0;
            if (files[0].type.startsWith('image/')) {
                fileImg.setAttribute('src', e.target.result);
                fileImg.setAttribute('width', '200px');
                fileIcon.style.display = 'none'
                fileImg.style.display = 'revert';
            } else {
                fileImg.style.display = 'none';
                fileIcon.style.display = 'revert';
                let ext = files[0].name.split('.').pop();
                fileIcon.querySelector('p').innerText = ext.length <= 5 ? ext : files[0].name.substr(0, 2) + '...';
            }
            loaded();
        };

        reader.readAsDataURL(files[0]);
    };

    uploadInput.onchange = (e) => {
        if (e.target.files) previewFile(e.target.files);
    }

    let drag = document.querySelector('.dragParent');
    drag.ondragover = () => { drag.classList.add('hover'); return false; };
    drag.ondragleave = () => { drag.classList.remove('hover'); return false; };
    drag.ondrop = (e) => {
        e.preventDefault();
        let files = e.dataTransfer.files;
        if (files) {
            uploadInput.files = files;
            previewFile(files);
        }
    };

    document.onpaste = (e) => {
        var items = e.clipboardData || e.originalEvent.clipboardData;
        if (items.files && items.files.length > 0) {
            uploadInput.files = items.files;
            previewFile(items.files);
        };
    };

    sock.on('notify', outp => { notify(outp.msg, outp.type) });
};