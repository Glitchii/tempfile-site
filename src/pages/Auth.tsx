import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ArrowLeftIcon from '../assets/vectors/arrow-left.svg?react'
import PasswordIcon from '../assets/vectors/password.svg?react'

export default function Auth() {
    const { name = '' } = useParams()
    const navigate = useNavigate()
    const encodedName = encodeURIComponent(name)
    const [password, setPassword] = useState('')
    const [checking, setChecking] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        document.title = 'Password required - TempFile'
        let active = true

        fetch(`/api/files/${encodedName}/info`)
            .then(async (res) => ({ res, json: await res.json() }))
            .then(({ res, json }) => {
                if (!active) return
                if (!res.ok) {
                    navigate('/error/404', { replace: true })
                    return
                }
                if (!json.file.hasPassword) window.location.replace(`/files/${encodedName}`)
            })
            .catch(() => active && setMessage('Could not reach the server. Please try again.'))
            .finally(() => active && setChecking(false))

        return () => {
            active = false
            document.title = 'TempFile'
        }
    }, [encodedName, navigate])

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        if (!password || submitting) {
            if (!password) setMessage('Enter the file password')
            return
        }

        setMessage('')
        setSubmitting(true)
        try {
            const res = await fetch(`/api/files/${encodedName}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            })
            const json = await res.json()

            if (!res.ok) {
                if (res.status === 404) return navigate('/error/404', { replace: true })
                if (res.status === 403) return navigate('/error/403', { replace: true })
                setMessage(json?.error?.message || 'Could not unlock this file')
                return
            }

            window.location.assign(json.link)
        } catch {
            setMessage('Could not reach the server. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <section className="route-page auth-page">
            <div className="auth-visual" aria-hidden="true">
                <div className="auth-icon"><PasswordIcon /></div>
                <p>{name}</p>
            </div>

            <div className="auth-content">
                <p className="route-eyebrow">Protected download</p>
                <h1>Password required</h1>
                <p className="auth-intro">The uploader protected this file. Enter its password to continue.</p>

                <form className="auth-form" onSubmit={(event) => void submit(event)}>
                    <label htmlFor="file-password">File password</label>
                    <div className="auth-field">
                        <PasswordIcon aria-hidden="true" />
                        <input
                            id="file-password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            autoFocus
                            maxLength={72}
                            disabled={checking || submitting}
                        />
                    </div>
                    <p className="auth-message" role="alert" aria-live="polite">
                        {message || (checking ? 'Checking file...' : '')}
                    </p>
                    <div className="route-actions">
                        <button className="route-button auth-continue" type="submit" disabled={checking || submitting}>
                            {submitting ? 'Checking...' : 'Continue'}
                            <ArrowLeftIcon aria-hidden="true" />
                        </button>
                        <Link className="route-button secondary" to="/">Home</Link>
                    </div>
                </form>
            </div>
        </section>
    )
}
