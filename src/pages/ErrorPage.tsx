import { useEffect } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { Link, useParams } from 'react-router-dom'
import ForbiddenIllustration from '../assets/vectors/forbidden.svg?react'
import NotFoundIllustration from '../assets/vectors/not-found.svg?react'
import ServerErrorIllustration from '../assets/vectors/server-error.svg?react'

type ErrorPageProps = {
    status?: number
}

type Illustration = ComponentType<SVGProps<SVGSVGElement>>

const errors: Record<number, { title: string; message: string; image: Illustration }> = {
    403: {
        title: 'You have no access.',
        message: 'The uploader restricted who can open this file.',
        image: ForbiddenIllustration,
    },
    404: {
        title: 'Nothing here.',
        message: 'This part of the website does not exist. If you expected a file, it probably expired or was deleted by the uploader.',
        image: NotFoundIllustration,
    },
    429: {
        title: 'Please slow down',
        message: 'Too many requests were made in a short time. Wait a moment and try again.',
        image: ServerErrorIllustration,
    },
    500: {
        title: "That's an error",
        message: 'The server could not finish that request. Please try again shortly.',
        image: ServerErrorIllustration,
    },
}

export default function ErrorPage({ status }: ErrorPageProps) {
    const { status: routeStatus } = useParams()
    const requestedCode = status || Number(routeStatus) || 404
    const code = errors[requestedCode] ? requestedCode : 500
    const error = errors[code]
    const Illustration = error.image

    useEffect(() => {
        document.title = `${code} - TempFile`
        return () => {
            document.title = 'TempFile'
        }
    }, [code])

    return (
        <section className={`route-page error-page error-${code}`}>
            <Illustration className="error-illustration" aria-hidden="true" />
            <div className="error-main">
                <div className="error-content">
                    <h1>{error.title}</h1>
                    <p>{error.message}</p>
                    <Link className="route-button" to="/">Home</Link>
                </div>
                <strong className="error-code">{code}</strong>
            </div>
        </section>
    )
}
