import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FileIcon from '../assets/icons/file-icon.svg?react'
import Notification from '../components/Notification'

type FileInfo = {
    filename: string
    originalname?: string
    mimetype?: string
    size?: number
    datetime?: string
    limit?: number
    hasPassword?: boolean
    ipRestricted?: boolean
}

const filenameFromInput = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ''

    try {
        return new URL(trimmed).pathname.split('/').filter(Boolean).pop() || ''
    } catch {
        return trimmed.split('/').filter(Boolean).pop() || trimmed
    }
}

const formatBytes = (size?: number) => {
    if (!Number.isFinite(size)) return 'Unknown'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = Number(size)
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
    }
    return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`
}

export default function Delete() {
    const { name } = useParams()
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [authkey, setAuthkey] = useState('')
    const [loaded, setLoaded] = useState<{ name: string; file: FileInfo | null } | null>(null)
    const file = loaded && loaded.name === name ? loaded.file : null
    const loading = Boolean(name) && loaded?.name !== name
    const [deleting, setDeleting] = useState(false)
    const [notification, setNotification] = useState<{ id: number; text: string; success?: boolean } | null>(null)

    const ext = useMemo(() => {
        const value = file?.filename || name || 'file'
        const part = value.includes('.') ? value.split('.').pop() || 'file' : 'file'
        return part.length <= 5 ? part : `${value.slice(0, 2)}...`
    }, [file?.filename, name])

    const notify = (text: string, success?: boolean) => setNotification({ id: Date.now(), text, success })

    useEffect(() => {
        if (!name) return

        let cancelled = false
        fetch(`/api/files/${encodeURIComponent(name)}/info`)
            .then((res) => res.json().then((json) => ({ res, json })).catch(() => ({ res, json: null })))
            .then(({ res, json }) => {
                if (cancelled) return
                if (!res.ok || !json?.ok) {
                    notify(json?.error?.message || 'File not found')
                    setLoaded({ name, file: null })
                    return
                }
                setLoaded({ name, file: json.file })
            })
            .catch(() => {
                if (cancelled) return
                notify('Could not reach the server')
                setLoaded({ name, file: null })
            })

        return () => {
            cancelled = true
        }
    }, [name])

    const submitSearch = () => {
        const filename = filenameFromInput(search)
        if (!filename) return notify('Enter a file name or URL')
        navigate(`/delete/${encodeURIComponent(filename)}`)
    }

    const deleteFile = async () => {
        if (!name || deleting) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: authkey.trim() ? { authkey: authkey.trim() } : undefined,
            })
            const json = await res.json().catch(() => null)
            if (!res.ok || !json?.ok) return notify(json?.error?.message || 'Could not delete file')
            notify('File has been deleted', true)
            setLoaded({ name, file: null })
        } catch {
            notify('Could not reach the server')
        } finally {
            setDeleting(false)
        }
    }

    if (!name) {
        return (
            <section className="route-page delete-page delete-search-page">
                {notification && <Notification key={notification.id} text={notification.text} success={notification.success} />}
                <div className="delete-search">
                    <h2>Delete a file</h2>
                    <input className="route-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submitSearch()} placeholder="Enter name or URL" autoComplete="off" />
                    <button className="route-button" onClick={submitSearch}>Search</button>
                </div>
            </section>
        )
    }

    return (
        <section className="route-page delete-page">
            {notification && <Notification key={notification.id} text={notification.text} success={notification.success} />}
            <div className="delete-file">
                <div className="delete-preview">
                    <div className="img fileIcon">
                        <p>{ext}</p>
                        <FileIcon style={{ fill: '#273036' }} />
                    </div>
                </div>
                <div className="delete-details">
                    <h1>{loading ? 'Looking for file...' : file ? 'Delete this file?' : 'File not found'}</h1>
                    {file && (
                        <>
                            <dl>
                                <div><dt>File name</dt><dd>{file.originalname || file.filename}</dd></div>
                                <div><dt>Stored as</dt><dd>{file.filename}</dd></div>
                                <div><dt>File size</dt><dd>{formatBytes(file.size)}</dd></div>
                                <div><dt>File type</dt><dd>{file.mimetype || 'Unknown'}</dd></div>
                                <div><dt>Expires</dt><dd>{file.datetime ? new Date(file.datetime).toLocaleString() : 'Unknown'}</dd></div>
                                {file.limit && <div><dt>Downloads left</dt><dd>{file.limit}</dd></div>}
                            </dl>
                            {(file.hasPassword || file.ipRestricted) && <p className="route-note">This file has access restrictions. Deleting from another IP may require the auth key.</p>}
                            <input className="route-input" value={authkey} onChange={(event) => setAuthkey(event.target.value)} placeholder="Auth key, if needed" autoComplete="off" />
                            <div className="route-actions">
                                <button className="route-button danger" onClick={() => void deleteFile()} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
                                <Link className="route-button secondary" to="/">Home</Link>
                            </div>
                        </>
                    )}
                    {!loading && !file && <Link className="route-button secondary" to="/delete">Search again</Link>}
                </div>
            </div>
        </section>
    )
}
