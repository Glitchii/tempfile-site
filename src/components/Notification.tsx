import { useEffect, useState } from 'react'
import CloseIcon from '../assets/vectors/close.svg?react'
import InfoIcon from '../assets/vectors/info.svg?react'
import SuccessIcon from '../assets/vectors/success.svg?react'

interface NotificationProps {
    text: string
    success?: boolean
    duration?: number
}

export default function Notification({ text, success = false, duration = 5000 }: NotificationProps) {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(false), duration)
        return () => window.clearTimeout(timer)
    }, [duration])

    if (!visible) return null

    const StatusIcon = success ? SuccessIcon : InfoIcon

    return (
        <div className="notif">
            <div className={`${success ? 'success' : 'normal'} content`}>
                <StatusIcon className="leftIcon" aria-hidden="true" />
                <p>{text}</p>
                <button className="notif-close" type="button" onClick={() => setVisible(false)} aria-label="Close notification">
                    <CloseIcon aria-hidden="true" />
                </button>
            </div>
        </div>
    )
}
