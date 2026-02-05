import clsx from 'clsx'
import UploadIcon from '../assets/icons/upload-no-blob.svg?react'
import UploadBlobBackground from '../assets/icons/upload-blob.svg?react'
import UploadOriginalIcon from '../assets/icons/upload.svg?react'
import AttachIcon from '../assets/icons/attach.svg?react'
import FileIcon from '../assets/icons/file-icon.svg?react'
import IpBlacklistIcon from '../assets/icons/ip-blacklist.svg?react'
import IpWhitelistIcon from '../assets/icons/ip-whitelist.svg?react'
import PlusIcon from '../assets/icons/plus.svg?react'
import DownloadLimitIcon from '../assets/icons/download-limit.svg?react'
import PasswordIcon from '../assets/icons/password.svg?react'
import NameIcon from '../assets/icons/name.svg?react'
import DatetimeIcon from '../assets/icons/datetime.svg?react'
import ArrowLeftIcon from '../assets/icons/arrow-left.svg?react'
import AuthKeyIcon from '../assets/icons/auth-key.svg?react'
import QuestionMarkIcon from '../assets/icons/question-mark.svg?react'
import UploadCloudIcon from '../assets/icons/upload-cloud.svg?react'
import Notification from '../components/Notification'
import { useEffect, useMemo, useRef, useState } from 'react'

export default function Home() {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const timeSelectRef = useRef<HTMLSelectElement | null>(null)
    const timeGuiRef = useRef<HTMLInputElement | null>(null)
    const formRef = useRef<HTMLFormElement | null>(null)

    const [uploading, setUploading] = useState(false)
    const [uploadedLink, setUploadedLink] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const dragDepthRef = useRef(0)
    const [notification, setNotification] = useState<{ text: string; success?: boolean } | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const defaultAuthKey = useMemo(() => crypto.getRandomValues(new Uint32Array(3)).join('.'), [])

    const showNotification = (text: string, success?: boolean) => {
        setNotification({ text, success })
    }

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null
        setSelectedFile(file)
    }

    useEffect(() => {
        if (uploadedLink) document.body.classList.add('showLinks')
        else document.body.classList.remove('showLinks')

        return () => document.body.classList.remove('showLinks')
    }, [uploadedLink])

    const closeLinks = () => setUploadedLink(null)

    const copyLink = async () => {
        if (!uploadedLink) return
        try {
            await navigator.clipboard.writeText(uploadedLink)
        } catch {
            // ignore
        }
    }

    const onDragEnter = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault()
        dragDepthRef.current += 1
        setDragging(true)
    }

    const onDragLeave = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault()
        dragDepthRef.current -= 1
        if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0
            setDragging(false)
        }
    }

    const onDragOver = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault()
    }

    const onDrop = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault()
        dragDepthRef.current = 0
        setDragging(false)

        const file = e.dataTransfer.files?.[0] ?? null
        setSelectedFile(file)

        if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files
    }

    const upload = async () => {
        if (uploading) return
        const file = fileInputRef.current?.files?.[0]
        if (!file) return window.alert('Please choose a file')

        const form = formRef.current
        if (!form) return

        const fd = new FormData(form)

        const timeGui = timeGuiRef.current?.value
        const timeSelect = timeSelectRef.current?.value
        const datetime = timeGui && timeGui.trim().length ? timeGui : timeSelect
        if (!datetime) return window.alert('Please select an expiry time')
        fd.set('datetime', datetime)

        setUploading(true)
        try {
            const res = await fetch('/api/files', { method: 'POST', body: fd })
            const json = await res.json().catch(() => null)

            if (!res.ok || !json?.ok) {
                const msg = json?.error?.message || 'Upload failed'
                showNotification(msg, false)
                return
            }

            setUploadedLink(json.link)
            showNotification('File uploaded successfully!', true)
        } finally {
            setUploading(false)
        }
    }

    return (
        <>
            {notification && <Notification {...notification} />}
            <main className={clsx({ 'file-selected': selectedFile })}>
                <form ref={formRef} action="/api/files" method="post" encType="multipart/form-data" onSubmit={(e) => { e.preventDefault(); void upload() }}>
                    <input ref={fileInputRef} type="file" id="upload" name="file" autoComplete="off" onChange={onFileChange} />
                    <input type="hidden" name="datetime" value="" />
                    <input type="submit" className="submitInput" style={{ position: 'absolute', display: 'none' }} />
                    <div>
                        <label className="part drag" htmlFor="upload" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
                            <div className="partInner">
                                <div className="upload-icon-container">
                                    <UploadIcon style={{ width: '250px', height: '100%' }} />
                                    <UploadBlobBackground style={{ width: '250px', height: '100%' }} />
                                    {/* <AttachIcon style={{ width: '250px', height: '100%' }} /> */}
                                </div>
                                <img className="img otherImg" src="" alt="" style={{ width: '250px', height: '100%' }} />
                                <div className="img fileIcon">
                                    <p>File</p>
                                    <FileIcon style={{ fill: '#273036' }} />
                                </div>
                                <h2>{dragging ? 'Drop file here' : selectedFile ? 'Ready to upload' : 'Drag file here'}</h2>
                                <textarea spellCheck={false}></textarea>
                                <p className="desc">

                                    {selectedFile ? (
                                        <span>
                                            "<b>{selectedFile.name}</b>" is ready to upload.
                                            <br />
                                            Choose any options if you want, then click "upload"
                                        </span>
                                    ) : (
                                        <span>
                                            Drag and drop a file or click anywere here to browse your computer.
                                            <br />
                                            You can also paste images (coming soon)
                                        </span>
                                    )}

                                    <span>
                                        {selectedFile ?
                                            `"${selectedFile.name}" is ready to upload` :
                                            "Tap here to select a file to upload"}
                                    </span>
                                </p>
                            </div>
                        </label>
                    </div>

                    <div className="part btns btnsInner">
                        <h2 className="optsTitle">Options</h2>
                        <div className={clsx('inner', { 'disabled-': !selectedFile })}>
                            <div className="btn limit">
                                <div className="icon">
                                    <DownloadLimitIcon />
                                </div>
                                <input className="input" name="limit" type="number" min="1" placeholder="Download limit (empty = unliminted)" />
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
                            <div className="btn ipBlackList">
                                <div className="icon">
                                    <IpBlacklistIcon />
                                </div>
                                <div className="inputAndAddMore">
                                    {/* <input className="input" type="text" placeholder="Restricted IP" /> */}
                                    <input className="input" name="ipblacklist" type="text" placeholder="Restrict access to an IP" />
                                    <div className="addMore">
                                        <PlusIcon />
                                    </div>
                                </div>
                            </div>
                            <div className="sep"></div>
                            <div className="btn ipWhiteList">
                                <div className="icon">
                                    <IpWhitelistIcon />
                                </div>
                                <div className="inputAndAddMore">
                                    <input className="input" name="ipwhitelist" type="text" placeholder="Restrict all IPS except" />
                                    <div className="addMore">
                                        <PlusIcon />
                                    </div>
                                </div>
                            </div>
                            <div className="sep"></div>
                            <div className="btn datetime">
                                <div className="icon">
                                    <DatetimeIcon />
                                </div>
                                <p className="input">Auto delete in</p>
                            </div>
                            <div className="btn datetime-picker">
                                <select ref={timeSelectRef} autoComplete="off" className="select btnUnder btnPad time" defaultValue="5m">
                                    <option value="1m">1 Minute</option>
                                    <option value="5m">5 Minutes</option>
                                    <option value="10m">10 Minutes</option>
                                    <option value="20m">20 Minutes</option>
                                    <option value="30m">30 Minutes</option>
                                    <option value="1h">1 Hour</option>
                                    <option value="2h">2 Hours</option>
                                    <option value="3h">3 Hours</option>
                                    <option value="4h">4 Hours</option>
                                    <option value="5h">5 Hours</option>
                                    <option value="12h">12 Hours</option>
                                    <option value="1d">1 day</option>
                                    <option value="2d">2 days</option>
                                    <option value="3d">3 days</option>
                                    <option value="1w">1 Week</option>
                                    <option value="2w">2 Weeks</option>
                                    <option value="3w">3 Weeks</option>
                                    <option value="1mo">1 Month</option>
                                    <option value="" disabled>For custom time or date, update the date box below</option>
                                </select>
                                <div className="btnFollowUp time btnPad">
                                    <input ref={timeGuiRef} type="datetime-local" className="timeGui" />
                                </div>
                            </div>
                            <div className="controls before" title="See more options">
                                <div className="backControl">
                                    <div className="controlText">More</div>
                                    <ArrowLeftIcon style={{ width: '15px', transform: 'rotate(180deg)' }} />
                                </div>
                            </div>
                            <div className="btn authKey other">
                                <div className="icon">
                                    <AuthKeyIcon />
                                </div>
                                <div className="qMarkAndTxt">
                                    <p className="input">Authentication Key </p>
                                    <div className="qMark">
                                        <QuestionMarkIcon>
                                            <title>This is a key required for actions like file deletions. Without it you can't delete a file through http requests</title>
                                        </QuestionMarkIcon>
                                    </div>
                                </div>
                                <p className="qMarkDesc">By default, you can delete a file if it was uploaded from the same IP address you're uploading from. This key allows you to delete the file from a different IP address. This is especially useful with <a href="/api" className="URL">API requests</a>.</p>
                                <div className="inputOptions">
                                    <input className="input btnPad" name="authkey" type="text" placeholder="Auth Key" defaultValue={defaultAuthKey} autoComplete="off" />
                                    <div className="controls" title="Back to main options">
                                        <div className="backControl">
                                            <ArrowLeftIcon style={{ width: '15px' }} />
                                            <div className="controlText">Back</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={clsx('submit', { 'disabled': !selectedFile })} onClick={() => upload()} role="button" tabIndex={0} aria-disabled={uploading}>
                            <div className="in">
                                <UploadCloudIcon className="upload" />
                                <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                            </div>
                        </div>
                    </div>
                </form>

                {uploadedLink && (
                    <>
                        <div className="links">
                            <div className="closeBtn" onClick={closeLinks} role="button" tabIndex={0}>
                                <svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" viewBox="0 0 492 492" xmlSpace="preserve">
                                    <g>
                                        <g>
                                            <path d="M300.188,246L484.14,62.04c5.06-5.064,7.852-11.82,7.86-19.024c0-7.208-2.792-13.972-7.86-19.028L468.02,7.872c-5.068-5.076-11.824-7.856-19.036-7.856c-7.2,0-13.956,2.78-19.024,7.856L246.008,191.82L62.048,7.872c-5.06-5.076-11.82-7.856-19.028-7.856c-7.2,0-13.96,2.78-19.02,7.856L7.872,23.988c-10.496,10.496-10.496,27.568,0,38.052L191.828,246L7.872,429.952c-5.064,5.072-7.852,11.828-7.852,19.032c0,7.204,2.788,13.96,7.852,19.028l16.124,16.116c5.06,5.072,11.824,7.856,19.02,7.856c7.208,0,13.968-2.784,19.028-7.856l183.96-183.952l183.952,183.952c5.068,5.072,11.824,7.856,19.024,7.856h0.008c7.204,0,13.96-2.784,19.028-7.856l16.12-16.116c5.06-5.064,7.852-11.824,7.852-19.028c0-7.204-2.792-13.96-7.852-19.028L300.188,246z" />
                                        </g>
                                    </g>
                                </svg>
                            </div>
                            <div className="inner">
                                <h2>File Uploaded</h2>
                                <div className="urls">
                                    <p>Go to this link to download your file</p>
                                    <div className="btn name">
                                        <div className="icon"></div>
                                        <input className="input" type="text" value={uploadedLink} readOnly onFocus={(e) => e.currentTarget.select()} />
                                    </div>
                                    <div className="linkBtns">
                                        <div className="linkBtn copy" onClick={() => void copyLink()} role="button" tabIndex={0}>
                                            Copy
                                        </div>
                                        <a className="linkBtn goToLink" href={uploadedLink} target="_blank" rel="noreferrer">
                                            Open
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="ov" onClick={closeLinks} role="button" tabIndex={0}></div>
                    </>
                )}
            </main>
        </>
    )
}