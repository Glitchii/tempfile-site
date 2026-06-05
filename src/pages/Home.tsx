import clsx from 'clsx'
import UploadIcon from '../assets/icons/upload.svg?react'
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
import { Link } from 'react-router-dom'

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

    timeSelectRef.current?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement
        const value = target.value
        if (!value) return

        const diff = new Date(value).getTime() - Date.now()
        if (diff < 0)
            return showNotification('The time is in the past')
        else if (diff > 31 * 24 * 60 * 60 * 1000)
            return showNotification('The time is too far in the future')
        else if (diff < 60 * 1000)
            return showNotification('The time is too short')
        else
            return showNotification('The time is valid')
    })

    timeGuiRef.current?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement
        const value = target.value
        if (!value) return

        const date = new Date(value)
        if (date.getTime() < Date.now())
            return showNotification('Please select a future time')

        const diff = date.getTime() - Date.now()
        const diffHours = Math.floor(diff / (1000 * 60 * 60))
        if (diffHours > 31)
            return showNotification('The time is too far in the future')

        if (diffHours < 0)
            return showNotification('The time is in the past')
    })

    const upload = async () => {
        const form = formRef.current

        if (uploading || !form)
            return

        if (!fileInputRef.current?.files?.[0])
            return showNotification('Please choose a file')

        const fd = new FormData(form)
        const timeGui = timeGuiRef.current?.value
        const timeSelect = timeSelectRef.current?.value
        const datetime = timeGui

        console.log(timeSelect, timeGui)

        if (!datetime)
            return showNotification('Please select an expiry time')

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
                                </div>
                                <img className="img otherImg" src="" alt="" style={{ width: '250px', height: '100%' }} />
                                <div className="img fileIcon">
                                    <p>File</p>
                                    <FileIcon style={{ fill: '#273036' }} />
                                </div>
                                <h2>{dragging ? 'Drop here to add file' : selectedFile ? 'Ready to upload' : 'Click here to add file'}</h2>
                                <textarea spellCheck={false}></textarea>
                                <p className="desc">

                                    {selectedFile ? (
                                        <span>
                                            "<b>{selectedFile.name}</b>" is ready to upload.
                                            <br />
                                            Pick some options if you need then click "upload"
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
                                        <Link className="linkBtn del" to={uploadedLink.replace('/files/', '/delete/')}>
                                            <svg xmlns="http://www.w3.org/2000/svg" version="1.1"
                                                xmlnsXlink="http://www.w3.org/1999/xlink" x="0" y="0" viewBox="0 0 512.016 512.016"
                                                xmlSpace="preserve">
                                                <g>
                                                    <g xmlns="http://www.w3.org/2000/svg">
                                                        <path
                                                            d="m448.199 164.387h-236.813l106.048-106.048c5.858-5.858 5.858-15.356 0-21.215l-26.872-26.872c-13.669-13.669-35.831-13.669-49.501 0l-27.63 27.631-14.144-14.144c-15.596-15.597-40.975-15.596-56.572 0l-55.158 55.158c-15.597 15.597-15.597 40.976 0 56.573l14.143 14.144-27.63 27.63c-13.669 13.669-13.669 35.831 0 49.501l26.872 26.872c5.857 5.858 15.356 5.859 21.214 0l38.021-38.021v231.416c0 35.901 29.104 65.005 65.005 65.005h158.012c35.901 0 65.005-29.104 65.005-65.005zm-325.284-35.989-14.143-14.143c-3.899-3.899-3.899-10.244 0-14.144l55.158-55.158c3.9-3.9 10.245-3.899 14.143 0l14.143 14.144zm129.533 299.612c0 8.285-6.716 15.001-15.001 15.001s-15.001-6.716-15.001-15.001v-179.616c0-8.285 6.716-15.001 15.001-15.001s15.001 6.716 15.001 15.001zm66.741 0c0 8.285-6.716 15.001-15.001 15.001s-15.001-6.716-15.001-15.001v-179.616c0-8.285 6.716-15.001 15.001-15.001s15.001 6.716 15.001 15.001zm66.741 0c0 8.285-6.716 15.001-15.001 15.001s-15.001-6.716-15.001-15.001v-179.616c0-8.285 6.716-15.001 15.001-15.001s15.001 6.716 15.001 15.001z"
                                                            fill="#000000" data-original="#000000"></path>
                                                        <path
                                                            d="m320.898 113.548c-9.151 3.19-15.571 11.361-16.63120.842h143.932v-24.932c0-17.119-16.845-29.167-33.022-23.682l-93.968 27.672c-.101.029-.211.069-.311.1z"
                                                            fill="#000000" data-original="#000000"></path>
                                                    </g>
                                                </g>
                                            </svg>
                                        </Link>
                                        <div className="linkBtn copy" onClick={() => void copyLink()} role="button" tabIndex={0}>
                                            <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" version="1.1"
                                                x="0px" y="0px" viewBox="0 0 512.001 512.001"
                                                xmlSpace="preserve">
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M439.565,411.847l-21.213-21.213c-5.863-5.863-15.352-5.863-21.215,0c-5.861,5.862-5.861,15.35,0,21.213l21.215,21.213    c5.861,5.863,15.35,5.863,21.213,0C445.428,427.197,445.428,417.71,439.565,411.847z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M364.999,398.671c-8.286,0-14.998,6.713-14.998,14.998v29.998c0,8.285,6.713,14.998,14.998,14.998    c8.288,0,15-6.712,15-14.998v-29.998C379.999,405.384,373.286,398.671,364.999,398.671z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M450.17,344.004h-29.996c-8.286,0-14.998,6.711-14.998,14.998c0,8.286,6.713,14.998,14.998,14.998h29.996    c8.287,0,15-6.713,15-14.998C465.17,350.715,458.457,344.004,450.17,344.004z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M121.366,93.648l-21.213-21.213c-5.863-5.863-15.35-5.863-21.213,0c-5.863,5.863-5.863,15.35,0,21.213l21.213,21.213    c5.863,5.863,15.35,5.863,21.213,0C127.229,109,127.229,99.511,121.366,93.648z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M98.329,132.005H68.333c-8.286-0.001-14.998,6.712-14.998,14.998c0,8.287,6.713,14.998,14.998,14.998h29.996    c8.287,0,15-6.711,15-14.998C113.329,138.717,106.616,132.005,98.329,132.005z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M152.998,46.83c-8.286,0-14.998,6.713-14.998,14.998v29.998c0,8.286,6.713,14.998,14.998,14.998    c8.287,0.001,14.998-6.712,14.998-14.998V61.828C167.996,53.542,161.285,46.83,152.998,46.83z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g>
                                                    <g>
                                                        <path
                                                            d="M472.386,39.615c-52.82-52.821-138.1-52.82-190.92,0.001l-43.427,43.427c-22.273,22.273-35.213,50.486-38.395,79.548    c20.153,1.908,40.093,7.425,58.76,16.758c0-19.517,7.213-39.031,22.062-53.881l43.426-43.426    c29.275-29.275,76.791-29.275,106.066,0c29.275,29.273,29.275,76.791,0,106.066l-43.426,43.426    c-28.665,28.665-76.051,30.016-106.066,0c-52.527-52.526-137.917-53.004-190.92,0l-49.931,49.931    c-52.82,52.82-52.82,138.098,0,190.919c52.82,52.822,138.098,52.822,190.919,0l49.933-49.931    c22.273-22.273,35.425-50.7,38.608-79.761c-20.577-1.485-40.73-7.213-58.973-16.547c0,19.517-7.213,39.033-22.062,53.882    l-49.931,49.931c-29.275,29.275-76.791,29.275-106.066,0c-29.275-29.275-29.275-76.793,0-106.066l49.931-49.931    c28.608-28.61,75.989-30.077,106.066,0c54.441,54.441,139.905,51.013,190.919,0l43.427-43.427    C525.206,177.714,525.206,92.436,472.386,39.615z">
                                                        </path>
                                                    </g>
                                                </g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                                <g></g>
                                            </svg>
                                        </div>
                                        <a className="linkBtn goToLink" href={uploadedLink} target="_blank" rel="noreferrer">
                                            <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" version="1.1" x="0" y="0" viewBox="0 0 26 26" xmlSpace="preserve">
                                                <g>
                                                    <g xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M18,17.759v3.366C18,22.159,17.159,23,16.125,23H4.875C3.841,23,3,22.159,3,21.125V9.875C3,8.841,3.841,8,4.875,8h3.429l3.001-3h-6.43C2.182,5,0,7.182,0,9.875v11.25C0,23.818,2.182,26,4.875,26h11.25C18.818,26,21,23.818,21,21.125v-6.367L18,17.759z" fill="#31ada9" data-original="#030104"/>
                                                        <g>
                                                            <path d="M22.581,0H12.322c-1.886,0.002-1.755,0.51-0.76,1.504l3.22,3.22l-5.52,5.519c-1.145,1.144-1.144,2.998,0,4.141l2.41,2.411c1.144,1.141,2.996,1.142,4.14-0.001l5.52-5.52l3.16,3.16c1.101,1.1,1.507,1.129,1.507-0.757L26,3.419C25.999-0.018,26.024-0.001,22.581,0z" fill="#31ada9" data-original="#030104"/>
                                                        </g>
                                                    </g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                    <g xmlns="http://www.w3.org/2000/svg"></g>
                                                </g>
                                            </svg>
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