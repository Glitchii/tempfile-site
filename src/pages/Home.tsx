import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import ArrowLeftIcon from '../assets/vectors/arrow-left.svg?react'
import CloseIcon from '../assets/vectors/close.svg?react'
import CopyIcon from '../assets/vectors/copy.svg?react'
import OpenIcon from '../assets/vectors/open.svg?react'
import TextIcon from '../assets/vectors/text.svg?react'
import TrashIcon from '../assets/vectors/trash.svg?react'
import AuthKeyIcon from '../assets/vectors/auth-key.svg?react'
import DatetimeIcon from '../assets/vectors/datetime.svg?react'
import DownloadLimitIcon from '../assets/vectors/download-limit.svg?react'
import FileIcon from '../assets/vectors/file-icon.svg?react'
import IpBlacklistIcon from '../assets/vectors/ip-blacklist.svg?react'
import IpWhitelistIcon from '../assets/vectors/ip-whitelist.svg?react'
import NameIcon from '../assets/vectors/name.svg?react'
import PasswordIcon from '../assets/vectors/password.svg?react'
import PlusIcon from '../assets/vectors/plus.svg?react'
import QuestionMarkIcon from '../assets/vectors/question-mark.svg?react'
import UploadIcon from '../assets/vectors/upload.svg?react'
import UploadCloudIcon from '../assets/vectors/upload-cloud.svg?react'
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

const maxFileSize = 95 * 1024 * 1024
const defaultExpiry = '5m'
const emptyOptions = { limit: '', pass: '', name: '' }

// Alternate consonants and vowels so the key remains easy to remember.
const createAuthKey = () => {
    const letters = ['bcdfghkmnprstvwy', 'aeiou']
    const bytes = crypto.getRandomValues(new Uint8Array(9))

    return [...bytes].map((byte, index) => {
        const chars = letters[index % 3 === 1 ? 1 : 0]
        const separator = index > 0 && index % 3 === 0 ? '.' : ''
        return separator + chars[byte % chars.length]
    }).join('')
}

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

    const [expiry, setExpiry] = useState(defaultExpiry)
    const [customExpiry, setCustomExpiry] = useState(() => localDateTime(dateFromValue(defaultExpiry)!))
    const [useCustomExpiry, setUseCustomExpiry] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadedLink, setUploadedLink] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const [notification, setNotification] = useState<{ id: number; text: string; success?: boolean } | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [textMode, setTextMode] = useState(false)
    const [text, setText] = useState('')
    const [showMore, setShowMore] = useState(false)
    const [showAuthHelp, setShowAuthHelp] = useState(true)
    const [ipBlacklist, setIpBlacklist] = useState([''])
    const [ipWhitelist, setIpWhitelist] = useState([''])
    const [authKey, setAuthKey] = useState(createAuthKey)
    const [options, setOptions] = useState(emptyOptions)

    const hasUpload = textMode ? text.trim().length > 0 : Boolean(selectedFile)
    const setOption = (name: keyof typeof emptyOptions, value: string) => setOptions((current) => ({ ...current, [name]: value }))
    const showUploadPanel = uploading || Boolean(uploadedLink)
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
        document.body.classList.toggle('showLinks', showUploadPanel)
        return () => document.body.classList.remove('showLinks')
    }, [showUploadPanel])

    useEffect(() => {
        document.body.classList.toggle('text', textMode)
        return () => document.body.classList.remove('text')
    }, [textMode])

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
    }, [previewUrl])

    useEffect(() => {
        if (useCustomExpiry) return

        const tick = () => setCustomExpiry(localDateTime(dateFromValue(expiry)!))
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

        if (file.size > maxFileSize) return showNotification('File too large, the limit is 95MB')
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
        const setValues = type === 'blacklist' ? setIpBlacklist : setIpWhitelist
        setValues(values)
    }

    const onExpiryChange = (value: string) => {
        setExpiry(value)
        setUseCustomExpiry(false)
        setCustomExpiry(localDateTime(dateFromValue(value)!))
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
        setOptions(emptyOptions)
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
        if (!hasUpload) return showNotification(textMode ? 'Enter some text first' : 'Choose a file first')
        
        const dateError = expiryError()
        if (dateError) return showNotification(dateError)
        
        const normalizedAuthKey = authKey.trim()
        if (!normalizedAuthKey) return showNotification('Enter an authentication key')

        const fd = new FormData(formRef.current)
        fd.set('datetime', activeExpiry)
        fd.set('authkey', normalizedAuthKey)
        for (const [name, value] of Object.entries(options)) {
            if (value) fd.set(name, value)
            else fd.delete(name)
        }

        fd.delete('ipblacklist')
        fd.delete('ipwhitelist')

        const blacklisted = ipBlacklist.map((ip) => ip.trim()).filter(Boolean)
        const whitelisted = ipWhitelist.map((ip) => ip.trim()).filter(Boolean)
        if (blacklisted.length) fd.set('ipblacklist', blacklisted.join(','))
        if (whitelisted.length) fd.set('ipwhitelist', whitelisted.join(','))
        if (!textMode) fd.delete('text')
        else {
            fd.delete('file')
            fd.set('text', text)
        }

        setUploadedLink(null)
        setUploading(true)
        try {
            const res = await fetch('/files', { method: 'POST', body: fd })
            const json = await res.json()

            if (!res.ok)
                return showNotification(json?.error?.message || 'Upload failed')

            setUploadedLink(json.link)
            showNotification('File has been uploaded', true)
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
                <form ref={formRef} action="/files" method="post" encType="multipart/form-data" onSubmit={(event) => { event.preventDefault(); upload() }}>
                    <input ref={fileInputRef} type="file" id="upload" name="file" autoComplete="off" onChange={onFileChange} />
                    <input type="submit" className="submitInput" />
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
                                    <UploadIcon />
                                </div>
                                <img className="img otherImg" src={previewUrl || undefined} alt={selectedFile?.name || ''} />
                                <div className="img fileIcon">
                                    <p>{fileLabel}</p>
                                    <FileIcon />
                                </div>
                                <h2>{dragging ? 'Drop here to add file' : selectedFile ? 'Ready to upload' : textMode ? 'Write text to upload' : 'Click here to add file'}</h2>
                                <textarea ref={textareaRef} name="text" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} placeholder='Type or paste text here to upload as a file' />
                                <p className="desc">
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
                                    <p className="qMarkDesc">This browser can <Link to="/delete" className="URL">delete the upload</Link> automatically. This key is required from another browser or device, and for <Link to="/api" className="URL">API requests</Link>. Change it to something simpler if you like</p>
                                    <div className="inputOptions">
                                        <input className="input btnPad" name="authkey" type="text" placeholder="Auth Key" value={authKey} onChange={(event) => setAuthKey(event.target.value)} maxLength={80} autoComplete="off" />
                                    </div>
                                </div> :
                                <>
                                    <div className="btn limit">
                                        <div className="icon">
                                            <DownloadLimitIcon />
                                        </div>
                                        <input className="input" name="limit" type="number" min="1" placeholder="Download limit (empty = unlimited)" value={options.limit} onChange={(event) => setOption('limit', event.target.value)} />
                                    </div>
                                    <div className="sep"></div>
                                    <div className="btn pass">
                                        <div className="icon">
                                            <PasswordIcon />
                                        </div>
                                        <input className="input" name="pass" type="password" placeholder="Password protect" value={options.pass} onChange={(event) => setOption('pass', event.target.value)} />
                                    </div>
                                    <div className="sep"></div>
                                    <div className="btn name">
                                        <div className="icon">
                                            <NameIcon />
                                        </div>
                                        <input className="input" name="name" type="text" placeholder="Custom file name" value={options.name} onChange={(event) => setOption('name', event.target.value)} />
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
                            {!showMore && (
                                <div className="btn datetime-picker">
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
                            )}
                            <div className="controls before" title="See more options">
                                <div className="backControl" onClick={() => setShowMore(!showMore)} role="button" tabIndex={0}>
                                    {showMore && <ArrowLeftIcon style={{ width: '15px', transform: 'translateY(-1px)' }} />}
                                    {showMore && <div className="controlText">Back</div>}
                                    {!showMore && <div className="controlText">More</div>}
                                    {!showMore && <ArrowLeftIcon style={{ width: '15px', transform: 'rotate(180deg)' }} />}
                                </div>
                            </div>
                        </div>

                        <div className="submit" onClick={() => upload()} onKeyDown={onSubmitKey} role="button" tabIndex={0} aria-disabled={!hasUpload || uploading}>
                            <div className="in">
                                <UploadCloudIcon className="upload" />
                                <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                            </div>
                        </div>
                    </div>
                </form>
            </main>

            {showUploadPanel && (
                <>
                    <div className="links">
                        {!uploading && (
                            <div className="closeBtn" onClick={() => setUploadedLink(null)} role="button" tabIndex={0}>
                                <CloseIcon />
                            </div>
                        )}
                        <div className="inner">
                            <div className="title">
                                <h2>{uploading ? 'Uploading...' : 'File Uploaded'}</h2>
                            </div>
                            {uploading ? (
                                <div className="upload-status">
                                    <div className="upload-spinner" aria-hidden="true"></div>
                                    <p>Please keep this page open while your file uploads</p>
                                </div>
                            ) : uploadedLink && (
                                <div className="urls">
                                    <p>Go to this link to download your file</p>
                                    <div className="btn name">
                                        <div className="icon"></div>
                                        <input ref={uploadedLinkInputRef} className="input" type="text" value={uploadedLink} readOnly onFocus={(event) => event.currentTarget.select()} />
                                    </div>
                                    <div className="linkBtns">
                                        <Link className="linkBtn del" to={uploadedLink.replace('/files/', '/delete/')} title="Delete file">
                                            <TrashIcon />
                                        </Link>
                                        <div className="linkBtn copy" onClick={() => copyLink()} role="button" tabIndex={0} title="Copy link">
                                            <CopyIcon />
                                        </div>
                                        <a className="linkBtn goToLink" href={uploadedLink} target="_blank" rel="noreferrer" title="Open file">
                                            <OpenIcon />
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div
                        className={clsx('ov', { locked: uploading })}
                        onClick={uploading ? undefined : () => setUploadedLink(null)}
                        role={uploading ? undefined : 'button'}
                        tabIndex={uploading ? undefined : 0}
                    ></div>
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
                <TextIcon />
            </div>
        </>
    )
}
