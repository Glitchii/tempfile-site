import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DeleteSearchIllustration from '../assets/vectors/delete-search.svg?react'
import FileIcon from '../assets/vectors/file-icon.svg?react'
import HomeIcon from '../assets/vectors/home.svg?react'
import SearchIcon from '../assets/vectors/search.svg?react'
import TrashIcon from '../assets/vectors/trash.svg?react'
import Notification from '../components/Notification'

type FileInfo = {
    filename: string
    originalname: string
    mimetype: string
    size: number
    datetime: string
    limit?: number
    hasPassword: boolean
    ipRestricted: boolean
    requesterRequiresDeleteKey: boolean
}

const filenameFromInput = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ''

    try {
        const name = new URL(trimmed).pathname.split('/').filter(Boolean).pop() || ''
        return decodeURIComponent(name)
    } catch {
        const name = trimmed.split('/').filter(Boolean).pop() || trimmed
        try {
            return decodeURIComponent(name)
        } catch {
            return name
        }
    }
}

const formatBytes = (size: number) => {
    const units = ['B', 'KB', 'MB', 'GB']
    let value = size
    let unit = 0

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
    }

    return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`
}

const extension = (name: string) => {
    const value = name.includes('.') ? name.split('.').pop() || 'file' : 'file'
    return value.length <= 5 ? value : `${name.slice(0, 2)}...`
}

export default function Delete() {
    const { name } = useParams()
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [authkey, setAuthkey] = useState('')
    const [loaded, setLoaded] = useState<{ name: string; file: FileInfo | null } | null>(null)
    const [deletedName, setDeletedName] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [previewFailedName, setPreviewFailedName] = useState<string | null>(null)
    const [notification, setNotification] = useState<{ id: number; text: string; success?: boolean } | null>(null)

    const file = loaded && loaded.name === name ? loaded.file : null
    const loading = Boolean(name) && loaded?.name !== name
    const deleted = deletedName === name
    const canPreview = Boolean(file?.mimetype?.startsWith('image/') && !file.hasPassword && !file.limit && previewFailedName !== file.filename)
    const notify = (text: string, success?: boolean) => setNotification({ id: Date.now(), text, success })

    useEffect(() => {
        document.title = name ? 'Delete file - TempFile' : 'Find a file - TempFile'
        return () => {
            document.title = 'TempFile'
        }
    }, [name])

    useEffect(() => {
        if (!name) return

        let active = true
        fetch(`/files/${encodeURIComponent(name)}/info`)
            .then(async (res) => ({ res, json: await res.json() }))
            .then(({ res, json }) => {
                if (!active) return
                if (res.status === 404) {
                    navigate('/error/404', { replace: true })
                    return
                }
                if (!res.ok) {
                    notify(json?.error?.message || 'Could not load this file')
                    setLoaded({ name, file: null })
                    return
                }
                setLoaded({ name, file: json.file })
            })
            .catch(() => {
                if (!active) return
                notify('Could not reach the server')
                setLoaded({ name, file: null })
            })

        return () => {
            active = false
        }
    }, [name, navigate])

    const submitSearch = () => {
        const filename = filenameFromInput(search)
        if (!filename) return notify('Enter a file name or URL')
        setAuthkey('')
        navigate(`/delete/${encodeURIComponent(filename)}`)
    }

    const deleteFile = async () => {
        if (!name || deleting || deleted) return

        setDeleting(true)
        try {
            const res = await fetch(`/files/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: file?.requesterRequiresDeleteKey && authkey.trim() ? { authkey: authkey.trim() } : undefined,
            })
            const json = await res.json()
            if (!res.ok) return notify(json?.error?.message || 'Could not delete file')

            setDeletedName(name)
            notify('File has been deleted', true)
        } catch {
            notify('Could not reach the server')
        } finally {
            setDeleting(false)
        }
    }

    if (!name) {
        return (
            <section className="route-page delete-search-page">
                {notification && <Notification key={notification.id} text={notification.text} />}
                <DeleteSearchIllustration className="delete-search-illustration" aria-hidden="true" />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && submitSearch()}
                    placeholder="Enter name or URL"
                    autoComplete="off"
                    autoFocus
                />
                <div className="sep"></div>
                <button className="delete-action search-action" type="button" onClick={submitSearch}>
                    <SearchIcon />
                    Search
                </button>
            </section>
        )
    }

    return (
        <section className={`route-page delete-page${deleted ? ' deleted' : ''}`}>
            {notification && <Notification key={notification.id} text={notification.text} success={notification.success} />}

            {loading ? (
                <div className="page-loader" aria-label="Loading"></div>
            ) : file ? (
                <div className="delete-file">
                    <div className="delete-top">
                        <h1>{deleted ? 'File has been deleted' : 'Delete this file?'}</h1>
                        <div className="delete-preview">
                            {canPreview ? (
                                <img src={`/files/${encodeURIComponent(file.filename)}`} alt={file.originalname} onError={() => setPreviewFailedName(file.filename)} />
                            ) : (
                                <div className="fileIcon delete-file-icon">
                                    <p>{extension(file.filename)}</p>
                                    <FileIcon />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="delete-separator"></div>

                    <div className="delete-info">
                        <h2>File Info</h2>
                        <dl>
                            <div>
                                <dt>File name:</dt>
                                <dd>
                                    {file.originalname}
                                    {file.originalname !== file.filename && <i> ({file.filename})</i>}
                                </dd>
                            </div>
                            <div><dt>File size:</dt><dd>{formatBytes(file.size)}</dd></div>
                            <div><dt>File type:</dt><dd>{file.mimetype}</dd></div>
                            <div><dt>Expires on:</dt><dd>{new Date(file.datetime).toLocaleString()}</dd></div>
                            {file.limit && <div><dt>Downloads left:</dt><dd>{file.limit}</dd></div>}
                        </dl>
                        {file.hasPassword && <p className="delete-note"><b>Note:</b> File is password protected.</p>}
                        {file.ipRestricted && <p className="delete-note"><b>Note:</b> File access is restricted by IP address.</p>}
                    </div>

                    {!deleted && file.requesterRequiresDeleteKey && (
                        <input
                            className="delete-authkey"
                            value={authkey}
                            onChange={(event) => setAuthkey(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && void deleteFile()}
                            placeholder="Authentication key"
                            autoComplete="off"
                        />
                    )}

                    {deleted ? (
                        <Link className="delete-action home-action" to="/">
                            <HomeIcon />
                            Home
                        </Link>
                    ) : (
                        <button className="delete-action danger-action" type="button" onClick={() => void deleteFile()} disabled={deleting}>
                            <TrashIcon />
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="delete-load-error">
                    <h1>Could not load this file</h1>
                    <Link className="route-button" to="/delete">Search again</Link>
                </div>
            )}
        </section>
    )
}
