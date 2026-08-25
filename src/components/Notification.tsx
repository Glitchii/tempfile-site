import { useState } from 'react'

interface NotificationProps {
    success?: boolean
    text?: string
    children?: React.ReactNode
}

export default function Notification({ success = false, text = '', children }: NotificationProps) {
    const [visible, setVisible] = useState(true)

    if (!visible) return null

    return (
        <div className="notif">
            <div className={`${success ? 'success' : 'normal'} content`}>
                {success ? (
                    <svg className="leftIcon" width="100%" height="100%" viewBox="0 0 128 128" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" xmlSpace="preserve" style={{fillRule:'evenodd',clipRule:'evenodd',strokeLinejoin:'round',strokeMiterlimit:2}}>
                        <g transform="matrix(0.707059,0.710077,-0.878948,0.875212,58.0097,-69.4869)">
                            <rect x="98.907" y="20.67" width="12.052" height="68.911" style={{fill:'white'}}/>
                        </g>
                        <g transform="matrix(0.712102,-0.705019,0.390911,0.394838,-47.7082,122.029)">
                            <rect x="98.907" y="20.67" width="12.052" height="68.911" style={{fill:'white'}}/>
                        </g>
                        <g transform="matrix(1,0,0,1,0.628701,-0.419134)">
                            <path d="M79.014,6.404C73.74,4.936 68.292,4.192 62.818,4.192C29.478,4.192 2.41,31.26 2.41,64.6C2.41,97.94 29.478,125.008 62.818,125.008C96.18,125.008 123.226,97.962 123.226,64.6L110.089,64.6C110.089,90.707 88.925,111.872 62.818,111.872C36.728,111.872 15.547,90.69 15.547,64.6C15.547,38.51 36.728,17.329 62.818,17.329C67.101,17.329 71.365,17.911 75.492,19.059L79.014,6.404Z" style={{fill:'white'}}/>
                        </g>
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-info-icon lucide-info">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                    </svg>
                )}
                <p>{text || children || 'Notification content'}</p>
                <svg xmlns="http://www.w3.org/2000/svg" onClick={() => setVisible(false)} role="button" tabIndex={0} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-x-icon lucide-x">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                </svg>
            </div>
        </div>
    )
}