import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import ArrowLeftIcon from '../assets/icons/arrow-left.svg?react'
import AuthKeyIcon from '../assets/icons/auth-key.svg?react'
import DatetimeIcon from '../assets/icons/datetime.svg?react'
import DownloadLimitIcon from '../assets/icons/download-limit.svg?react'
import FileIcon from '../assets/icons/file-icon.svg?react'
import IpBlacklistIcon from '../assets/icons/ip-blacklist.svg?react'
import IpWhitelistIcon from '../assets/icons/ip-whitelist.svg?react'
import NameIcon from '../assets/icons/name.svg?react'
import PasswordIcon from '../assets/icons/password.svg?react'
import PlusIcon from '../assets/icons/plus.svg?react'
import QuestionMarkIcon from '../assets/icons/question-mark.svg?react'
import UploadIcon from '../assets/icons/upload.svg?react'
import UploadCloudIcon from '../assets/icons/upload-cloud.svg?react'
import Notification from '../components/Notification'

const timeOptions = [
    ['1m', '1 Minute'],
    ['5m', '5 Minutes'],
    ['10m', '10 Minutes'],
    ['20m', '20 Minutes'],
    ['30m', '30 Minutes'],
    ['1h', '1 Hour'],
    ['2h', '2 Hours'],
    ['3h', '3 Hours'],
    ['4h', '4 Hours'],
    ['5h', '5 Hours'],
    ['12h', '12 Hours'],
    ['1d', '1 day'],
    ['2d', '2 days'],
    ['3d', '3 days'],
    ['1w', '1 Week'],
    ['2w', '2 Weeks'],
    ['3w', '3 Weeks'],
    ['1mo', '1 Month'],
] as const

const maxFileSize = 2 * 1024 * 1024 * 1024

const dateFromValue = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null

    const digit = Number(trimmed.replace(/\D+$/, ''))
    const now = new Date()
    const date =
        trimmed.endsWith('mo') ? new Date(new Date(now).setMonth(now.getMonth() + digit)) :
            trimmed.endsWith('w') ? new Date(now.getTime() + digit * 7 * 24 * 60 * 60_000) :
                trimmed.endsWith('d') ? new Date(now.getTime() + digit * 24 * 60 * 60_000) :
                    trimmed.endsWith('h') ? new Date(now.getTime() + digit * 60 * 60_000) :
                        trimmed.endsWith('m') ? new Date(now.getTime() + digit * 60_000) :
                            new Date(trimmed)

    return Number.isNaN(date.getTime()) ? null : date
}

const localDateTime = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 16)
}

const splitName = (name: string) => {
    const ext = name.includes('.') ? name.split('.').pop() || 'file' : 'file'
    return ext.length <= 5 ? ext : `${name.slice(0, 2)}...`
}

const setInputFile = (input: HTMLInputElement | null, file: File | null) => {
    if (!input) return
    const transfer = new DataTransfer()
    if (file) transfer.items.add(file)
    input.files = transfer.files
}

export default function Home() {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const formRef = useRef<HTMLFormElement | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const uploadedLinkInputRef = useRef<HTMLInputElement | null>(null)
    const dragDepthRef = useRef(0)

    const defaultExpiry = '5m'
    const [expiry, setExpiry] = useState(defaultExpiry)
    const [customExpiry, setCustomExpiry] = useState(() => localDateTime(dateFromValue(defaultExpiry) || new Date()))
    const [useCustomExpiry, setUseCustomExpiry] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadedLink, setUploadedLink] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const [notification, setNotification] = useState<{ id: number; text: string; success?: boolean } | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [textMode, setTextMode] = useState(false)
    const [text, setText] = useState('')
    const [showMore, setShowMore] = useState(false)
    const [showAuthHelp, setShowAuthHelp] = useState(false)
    const [ipBlacklist, setIpBlacklist] = useState([''])
    const [ipWhitelist, setIpWhitelist] = useState([''])

    const defaultAuthKey = useMemo(() => crypto.getRandomValues(new Uint32Array(3)).join('.'), [])
    const hasUpload = textMode ? text.trim().length > 0 : Boolean(selectedFile)
    const previewUrl = useMemo(
        () => selectedFile?.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : null,
        [selectedFile],
    )
    const activeExpiry = useCustomExpiry ? customExpiry : expiry
    const fileLabel = selectedFile ? splitName(selectedFile.name) : 'File'

    const showNotification = (text: string, success?: boolean) => {
        setNotification({ id: Date.now(), text, success })
    }

    useEffect(() => {
        document.body.classList.toggle('showLinks', Boolean(uploadedLink))
        return () => document.body.classList.remove('showLinks')
    }, [uploadedLink])

    useEffect(() => {
        document.body.classList.toggle('text', textMode)
        return () => document.body.classList.remove('text')
    }, [textMode])

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
    }, [previewUrl])

    useEffect(() => {
        if (useCustomExpiry) return

        const tick = () => setCustomExpiry(localDateTime(dateFromValue(expiry) || new Date()))
        tick()
        const interval = window.setInterval(tick, 60_000)
        return () => window.clearInterval(interval)
    }, [expiry, useCustomExpiry])

    const selectFile = (file: File | null) => {
        if (!file) {
            setSelectedFile(null)
            setInputFile(fileInputRef.current, null)
            return
        }

        if (file.size > maxFileSize) return showNotification('File too large, the limit is 2GB')
        if (!file.size && !/.+?\.[^.]+$/.test(file.name)) return showNotification('File has no extension or size.')

        setTextMode(false)
        setSelectedFile(file)
        setInputFile(fileInputRef.current, file)
    }

    useEffect(() => {
        const onPaste = (event: ClipboardEvent) => {
            const file = Array.from(event.clipboardData?.files || [])[0]
            if (!file) return
            event.preventDefault()
            selectFile(file)
            showNotification(`Pasted "${file.name || 'clipboard file'}"`)
        }

        document.addEventListener('paste', onPaste)
        return () => document.removeEventListener('paste', onPaste)
    })

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        selectFile(event.target.files?.[0] ?? null)
    }

    const onDragEnter = (event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        dragDepthRef.current += 1
        setDragging(true)
    }

    const onDragLeave = (event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        dragDepthRef.current -= 1
        if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0
            setDragging(false)
        }
    }

    const onDrop = (event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        dragDepthRef.current = 0
        setDragging(false)
        selectFile(event.dataTransfer.files?.[0] ?? null)
    }

    const addIp = (type: 'blacklist' | 'whitelist') => {
        const values = type === 'blacklist' ? ipBlacklist : ipWhitelist
        if (values.length >= 5) return showNotification('You can only add up to 5')
        const setter = type === 'blacklist' ? setIpBlacklist : setIpWhitelist
        setter([...values, ''])
    }

    const setIp = (type: 'blacklist' | 'whitelist', index: number, value: string) => {
        const values = [...(type === 'blacklist' ? ipBlacklist : ipWhitelist)]
        values[index] = value
        ;(type === 'blacklist' ? setIpBlacklist : setIpWhitelist)(values)
    }

    const onExpiryChange = (value: string) => {
        const date = dateFromValue(value)
        setExpiry(value)
        setUseCustomExpiry(false)
        setCustomExpiry(localDateTime(date || new Date()))
    }

    const onCustomExpiryChange = (value: string) => {
        setCustomExpiry(value)
        setUseCustomExpiry(true)
    }

    const expiryError = () => {
        const date = dateFromValue(activeExpiry)
        if (!date) return 'Please select an expiry time'

        const diff = date.getTime() - Date.now()
        if (diff < 60_000) return 'The time is too short'
        if (diff > 31 * 24 * 60 * 60_000) return 'The time is too far in the future'
        return null
    }

    const resetUpload = () => {
        selectFile(null)
        setText('')
        setTextMode(false)
        setIpBlacklist([''])
        setIpWhitelist([''])
        formRef.current?.reset()
    }

    const copyLink = async () => {
        if (!uploadedLink) return
        try {
            await navigator.clipboard.writeText(uploadedLink)
            showNotification('Link copied', true)
        } catch {
            uploadedLinkInputRef.current?.focus()
            uploadedLinkInputRef.current?.select()
            showNotification('Could not copy automatically. The link is selected so you can copy it manually.')
        }
    }

    const upload = async () => {
        if (uploading || !formRef.current) return
        if (!hasUpload) return showNotification(textMode ? 'Please enter some text' : 'Please choose a file')

        const dateError = expiryError()
        if (dateError) return showNotification(dateError)

        const fd = new FormData(formRef.current)
        fd.set('datetime', activeExpiry)
        fd.delete('ipblacklist')
        fd.delete('ipwhitelist')

        const blacklisted = ipBlacklist.map((ip) => ip.trim()).filter(Boolean)
        const whitelisted = ipWhitelist.map((ip) => ip.trim()).filter(Boolean)
        if (blacklisted.length) fd.set('ipblacklist', blacklisted.join(','))
        if (whitelisted.length) fd.set('ipwhitelist', whitelisted.join(','))

        if (textMode) {
            fd.delete('file')
            fd.set('text', text)
        } else {
            fd.delete('text')
        }

        setUploading(true)
        try {
            const res = await fetch('/api/files', { method: 'POST', body: fd })
            const json = await res.json().catch(() => null)

            if (!res.ok || !json?.ok) {
                showNotification(json?.error?.message || 'Upload failed')
                return
            }

            setUploadedLink(json.link)
            showNotification('File uploaded successfully!', true)
            resetUpload()
        } catch {
            showNotification('Could not reach the server. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    const onSubmitKey = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            upload()
        }
    }

    const renderIpInputs = (type: 'blacklist' | 'whitelist') => {
        const values = type === 'blacklist' ? ipBlacklist : ipWhitelist
        const Icon = type === 'blacklist' ? IpBlacklistIcon : IpWhitelistIcon
        const cls = type === 'blacklist' ? 'ipBlackList' : 'ipWhiteList'
        const name = type === 'blacklist' ? 'ipblacklist' : 'ipwhitelist'
        const placeholder = type === 'blacklist' ? 'Restrict access to an IP' : 'Restrict all IPS except'

        return values.map((value, index) => (
            <div className="ip-input-row" key={`${type}-${index}`}>
                {index > 0 && <div className="sep"></div>}
                <div className={`btn ${cls}`}>
                    <div className="icon">
                        <Icon />
                    </div>
                    <div className="inputAndAddMore">
                        <input
                            className="input"
                            name={name}
                            type="text"
                            placeholder={index ? `${placeholder} (${index + 1})` : placeholder}
                            value={value}
                            onChange={(event) => setIp(type, index, event.target.value)}
                        />
                        {index === values.length - 1 && (
                            <div className="addMore" onClick={() => addIp(type)} role="button" tabIndex={0}>
                                <PlusIcon />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        ))
    }

    return (
        <>
            {notification && <Notification key={notification.id} text={notification.text} success={notification.success} />}
            <main className={clsx({ 'file-selected': hasUpload })}>
                <form ref={formRef} action="/api/files" method="post" encType="multipart/form-data" onSubmit={(event) => { event.preventDefault(); upload() }}>
                    <input ref={fileInputRef} type="file" id="upload" name="file" autoComplete="off" onChange={onFileChange} />
                    <input type="submit" className="submitInput" style={{ position: 'absolute', display: 'none' }} />
                    <div className="dragParent">
                        <label
                            className={clsx('part drag', { hasFile: selectedFile, notImg: selectedFile && !previewUrl })}
                            onDragEnter={onDragEnter}
                            onDragLeave={onDragLeave}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={onDrop}
                            {...(textMode ? {} : { htmlFor: 'upload' })}
                        >
                            <div className="partInner">
                                <div className="img mainImg upload-icon-container">
                                    <UploadIcon style={{ width: '250px', height: '100%' }} />
                                </div>
                                <img className="img otherImg" src={previewUrl || ''} alt={selectedFile?.name || ''} style={{ width: '250px', height: '100%' }} />
                                <div className="img fileIcon">
                                    <p>{fileLabel}</p>
                                    <FileIcon style={{ fill: '#273036' }} />
                                </div>
                                <h2>{dragging ? 'Drop here to add file' : selectedFile ? 'Ready to upload' : textMode ? 'Write text to upload' : 'Click here to add file'}</h2>
                                <textarea ref={textareaRef} name="text" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} placeholder='Type or paste text here to upload as a file' />
                                  <p className="desc" style={textMode ? { opacity: '0', height: 0, transition: '.2s ease-out' } : {}}>
                                    {selectedFile ? (
                                        <span>
                                            "<b>{selectedFile.name}</b>" is ready to upload.
                                            <br />
                                            Choose some options if you need then click "upload"
                                        </span>
                                    ) : (
                                        <span>
                                            Drag and drop a file or click anywhere here to browse your computer.
                                            <br />
                                            You can also paste images or files from your clipboard
                                        </span>
                                    )}
                                    <span>
                                        {selectedFile ? `"${selectedFile.name}" is ready to upload` : 'Tap here to select a file to upload'}
                                    </span>
                                </p>
                            </div>
                        </label>
                    </div>

                    <div className="part btns btnsInner">
                        <h2 className="optsTitle">Options</h2>
                        <div className={clsx('inner', { others: showMore })}>
                            {showMore ?
                                <div className={clsx('btn authKey other', { qMarkClicked: showAuthHelp })}>
                                    <div className="icon">
                                        <AuthKeyIcon />
                                    </div>
                                    <div className="qMarkAndTxt">
                                        <p className="input">Authentication Key </p>
                                        <div className="qMark" onClick={() => setShowAuthHelp(!showAuthHelp)} role="button" tabIndex={0}>
                                            <QuestionMarkIcon>
                                                <title>This is a key required for actions like file deletions. Without it you cannot delete a file through HTTP requests.</title>
                                            </QuestionMarkIcon>
                                        </div>
                                    </div>
                                    <p className="qMarkDesc">You can delete a file if it was uploaded from your IP address. This key allows you to delete the file even from a different one. This is also useful with <a href="/api" className="URL">API requests</a>. Change to something simpler if you like</p>
                                    <div className="inputOptions">
                                        <input className="input btnPad" name="authkey" type="text" placeholder="Auth Key" defaultValue={defaultAuthKey} autoComplete="off" />
                                        {/* <div className="controls" title="Back to main options">
                                            <div className="backControl" onClick={() => setShowMore(false)} role="button" tabIndex={0}>
                                                <ArrowLeftIcon style={{ width: '15px' }} />
                                                <div className="controlText">Back</div>
                                            </div>
                                        </div> */}
                                    </div>
                                </div> :
                                <>
                                    <div className="btn limit">
                                        <div className="icon">
                                            <DownloadLimitIcon />
                                        </div>
                                        <input className="input" name="limit" type="number" min="1" placeholder="Download limit (empty = unlimited)" />
                                    </div>
                                    <div className="sep"></div>
                                    <div className="btn pass">
                                        <div className="icon">
                                            <PasswordIcon />
                                        </div>
                                        <input className="input" name="pass" type="password" placeholder="Password protect" />
                                    </div>
                                    <div className="sep"></div>
                                    <div className="btn name">
                                        <div className="icon">
                                            <NameIcon />
                                        </div>
                                        <input className="input" name="name" type="text" placeholder="Custom file name" />
                                    </div>
                                    <div className="sep"></div>
                                    {renderIpInputs('blacklist')}
                                    <div className="sep"></div>
                                    {renderIpInputs('whitelist')}
                                    <div className="sep"></div>
                                    <div className="btn datetime">
                                        <div className="icon">
                                            <DatetimeIcon />
                                        </div>
                                        <p className="input">Auto delete in</p>
                                    </div>
                                </>}
                                <div className="btn datetime-picker" style={showMore ? { visibility: 'hidden', height: 0 } : {}}>
                                    <select autoComplete="off" className="select btnUnder btnPad time" value={expiry} onChange={(event) => onExpiryChange(event.target.value)}>
                                        {timeOptions.map(([value, label]) => (
                                            <option value={value} key={value}>{label}</option>
                                        ))}
                                        <option value="" disabled>For custom time or date, update the date box below</option>
                                    </select>
                                    <div className="btnFollowUp time btnPad">
                                        <input
                                            type="datetime-local"
                                            className="timeGui"
                                            min={localDateTime()}
                                            max={localDateTime(new Date(new Date().setMonth(new Date().getMonth() + 1)))}
                                            value={customExpiry}
                                            onChange={(event) => onCustomExpiryChange(event.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="controls before" title="See more options">
                                    <div className="backControl" onClick={() => setShowMore(!showMore)} role="button" tabIndex={0}>
                                        {showMore && <ArrowLeftIcon style={{ width: '15px', transform: 'translateY(-1px)' }} />}
                                        {showMore && <div className="controlText">Back</div>}
                                        {!showMore && <div className="controlText">More</div>}
                                        {!showMore && <ArrowLeftIcon style={{ width: '15px', transform: 'rotate(180deg)' }} />}
                                    </div>
                                </div>
                        </div>

                        <div className={clsx('submit', /* { disabled: !hasUpload || uploading } */)} onClick={() => upload()} onKeyDown={onSubmitKey} role="button" tabIndex={0} aria-disabled={!hasUpload || uploading}>
                            <div className="in">
                                <UploadCloudIcon className="upload" />
                                <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                            </div>
                        </div>
                    </div>
                </form>
            </main>

                {uploadedLink && (
                    <>
                        <div className="links">
                            <div className="closeBtn" onClick={() => setUploadedLink(null)} role="button" tabIndex={0}>
                                <CloseIcon />
                            </div>
                            <div className="inner">
                                <h2>File Uploaded</h2>
                                <div className="urls">
                                    <p>Go to this link to download your file</p>
                                    <div className="btn name">
                                        <div className="icon"></div>
                                        <input ref={uploadedLinkInputRef} className="input" type="text" value={uploadedLink} readOnly onFocus={(event) => event.currentTarget.select()} />
                                    </div>
                                    <div className="linkBtns">
                                        <Link className="linkBtn del" to={uploadedLink.replace('/files/', '/delete/')} title="Delete file">
                                            <DeleteIcon />
                                        </Link>
                                        <div className="linkBtn copy" onClick={() => copyLink()} role="button" tabIndex={0} title="Copy link">
                                            <CopyIcon />
                                        </div>
                                        <a className="linkBtn goToLink" href={uploadedLink} target="_blank" rel="noreferrer" title="Open file">
                                            <OpenIcon />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="ov" onClick={() => setUploadedLink(null)} role="button" tabIndex={0}></div>
                    </>
                )}
            <div
                className="textBtn"
                title="Upload text instead of file"
                onClick={() => {
                    const next = !textMode
                    setTextMode(next)
                    if (next) {
                        selectFile(null)
                        window.setTimeout(() => textareaRef.current?.focus(), 50)
                    }
                }}
                role="button"
                tabIndex={0}
            >
                <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 64 64">
                    <g>
                        <path d="m39.1 12.333c2.762 0 5-2.239 5-5s-2.238-5-5-5h-33.707c-2.761 0-5 2.239-5 5s2.239 5 5 5h11.854v44.326c0 2.762 2.239 5 5 5s5-2.238 5-5v-44.326z" fill="#ffffff"></path>
                        <path d="m58.607 25.849h-22.083c-2.762 0-5 2.239-5 5 0 2.762 2.238 5 5 5h6.042v20.818c0 2.762 2.238 5 5 5s5-2.238 5-5v-20.818h6.041c2.762 0 5-2.238 5-5 0-2.761-2.238-5-5-5z" fill="#ffffff"></path>
                    </g>
                </svg>
            </div>
        </>
    )
}

function CloseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 492 492">
            <path d="M300.188 246 484.14 62.04c10.48-10.488 10.48-27.56 0-38.052L468.02 7.872c-10.496-10.504-27.56-10.496-38.06-.016L246.008 191.82 62.048 7.872c-10.488-10.504-27.56-10.496-38.048 0L7.872 23.988c-10.496 10.496-10.496 27.568 0 38.052L191.828 246 7.872 429.952c-10.496 10.512-10.496 27.568 0 38.06l16.124 16.116c10.488 10.496 27.568 10.496 38.048 0l183.96-183.952 183.952 183.952c10.496 10.496 27.568 10.496 38.06 0l16.12-16.116c10.488-10.488 10.488-27.548 0-38.056z" />
        </svg>
    )
}

function DeleteIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <path d="M448 96h-96l-32-48H192l-32 48H64v48h384zM96 176l32 288h256l32-288zm128 224h-40l-16-176h40zm104 0h-40V224h40z" />
        </svg>
    )
}

function CopyIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <path d="M160 96h224v288H160zM112 32h224v40H136v264H96V48c0-8.8 7.2-16 16-16zm304 128h-40v-40H136v328h280z" />
        </svg>
    )
}

function OpenIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
            <path d="M18 17.759v3.366C18 22.159 17.159 23 16.125 23H4.875C3.841 23 3 22.159 3 21.125V9.875C3 8.841 3.841 8 4.875 8h3.429l3.001-3h-6.43C2.182 5 0 7.182 0 9.875v11.25C0 23.818 2.182 26 4.875 26h11.25C18.818 26 21 23.818 21 21.125v-6.367z" />
            <path d="M22.581 0H12.322c-1.886.002-1.755.51-.76 1.504l3.22 3.22-5.52 5.519c-1.145 1.144-1.144 2.998 0 4.141l2.41 2.411c1.144 1.141 2.996 1.142 4.14-.001l5.52-5.52 3.16 3.16c1.101 1.1 1.507 1.129 1.507-.757L26 3.419C25.999-.018 26.024-.001 22.581 0z" />
        </svg>
    )
}
