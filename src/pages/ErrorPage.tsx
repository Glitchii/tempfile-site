import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ArrowLeftIcon from '../assets/icons/arrow-left.svg?react'
import FileIcon from '../assets/icons/file-icon.svg?react'

type ErrorPageProps = {
    status?: number
}

const errors: Record<number, { title: string; message: string }> = {
    403: {
        title: 'You do not have access',
        message: 'The uploader restricted who can open this file.',
    },
    404: {
        title: 'That file is not here',
        message: 'It may have expired, reached its download limit, been deleted, or never existed.',
    },
    429: {
        title: 'Please slow down',
        message: 'Too many requests were made in a short time. Wait a moment and try again.',
    },
    500: {
        title: 'Something went wrong',
        message: 'The server could not finish that request. Please try again shortly.',
    },
}

const reasons: Record<string, string> = {
    'file-not-found': 'It may have expired, reached its download limit, been deleted, or never existed.',
    'ip-restricted': 'Your IP address is not allowed by this file\'s access settings.',
    'server-error': 'The server could not load this file. Please try again shortly.',
}

export default function ErrorPage({ status }: ErrorPageProps) {
    const { status: routeStatus } = useParams()
    const [search] = useSearchParams()
    const navigate = useNavigate()
    const requestedCode = status || Number(routeStatus) || 404
    const code = errors[requestedCode] ? requestedCode : 500
    const error = errors[code] || errors[500]
    const message = reasons[search.get('reason') || ''] || error.message
    
    useEffect(() => {
        document.title = `${code} - TempFile`
        return () => {
            document.title = 'TempFile'
        }
    }, [code])

    return (
        <section className="route-page error-page">
            <div className="error-visual" aria-hidden="true">
                <span>{code}</span>
                <FileIcon />
            </div>

            <div className="error-content">
                <p className="route-eyebrow">Error {code}</p>
                <h1>{error.title}</h1>
                <p>{message}</p>
                <div className="route-actions">
                    <Link className="route-button" to="/">Home</Link>
                    <button className="route-button secondary error-back" type="button" onClick={() => navigate(-1)}>
                        <ArrowLeftIcon aria-hidden="true" />
                        Go back
                    </button>
                </div>
            </div>
        </section>
    )
}
