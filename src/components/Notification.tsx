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
                    <svg className="leftIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 1250 1250" xmlSpace="preserve">
                        <g>
                            <g>
                                <g>
                                    <path style={{fill:'none',stroke:'#FFFFFF',strokeWidth:'83.3333'}} d="M1143.9,439.2l1,395.7c0,14.5-1.5,89.8-66,151.3c-40.6,38.7-97.2,62.9-158.9,62.9l-147.3-2.6c-26,0-44.3,22.9-51.6,33.8c-2.5,3.8-5.1,7.4-8.1,10.7c-23.6,27.4-57.6,90.6-87.1,91.6c-25.6,0.8-65.9-57-84-85c-11.5-17.8-28.2-32.1-48.4-40.5c-16.3-6.8-34.2-10.2-52.3-9.9l-89.2,1.5c-14.4,0.2-28.8-0.8-43-3.1c-43.5-7-93.7-19.1-136.1-59.5c-40.6-38.7-66-92.6-66-151.3V304.4c0-117.5,100.8-214.2,224.9-214.2l576.2-2.7l0,0c67.8-0.3,132.7,27.2,177.2,75.9c23.7,25.9,44.7,58.4,54.3,97.9c3.6,14.5,5.5,30,5.5,46.5"/>
                                    <path style={{fill:'#FFFFFF'}} d="M1187.5,450.2"/>
                                    <path style={{fill:'#FFFFFF'}} d="M1100.3,439.8c0-22.9,19-41.5,42.4-41.5h2.2c23.4,0,42.4,18.6,42.4,41.5"/>
                                    <path style={{fill:'#FFFFFF'}} d="M1188.5,307.8c-1.5,4.2-4.6,11.1-11.2,17.4c-12.2,11.5-27.2,11.9-31,11.8h-2.3c-2.8-0.1-19.3-0.9-31-11.8c-6.3-5.9-10.2-13.7-11.4-17.4c0-0.1-0.1-0.3-0.1-0.3"/>
                                </g>
                            </g>
                        </g>
                        <g>
                            <g>
                                <path style={{fill:'#FFFFFF'}} d="M614.5,903.3L614.5,903.3c-45.1,0-81.7-36.5-81.7-81.7V576.2c0-45.1,36.5-81.7,81.7-81.7l0,0c45.1,0,81.7,36.5,81.7,81.7v245.4C696.1,866.6,659.5,903.3,614.5,903.3z"/>
                                <path style={{fill:'#FFFFFF'}} d="M614.5,418.7L614.5,418.7c-45.1,0-81.7-36.5-81.7-81.7l0,0c0-45.1,36.5-81.7,81.7-81.7l0,0c45.1,0,81.7,36.5,81.7,81.7l0,0C696.1,382.1,659.5,418.7,614.5,418.7z"/>
                            </g>
                        </g>
                    </svg>
                )}
                <p>{text || children || 'Notification content'}</p>
                <div className="notifCloseBtn" onClick={() => setVisible(false)} role="button" tabIndex={0}>
                    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" version="1.1" width="512" height="512" x="0" y="0" viewBox="0 0 426.66667 426.66667" xmlSpace="preserve">
                        <g>
                            <path xmlns="http://www.w3.org/2000/svg" d="m405.332031 192h-170.664062v-170.667969c0-11.773437-9.558594-21.332031-21.335938-21.332031-11.773437 0-21.332031 9.558594-21.332031 21.332031v170.667969h-170.667969c-11.773437 0-21.332031 9.558594-21.332031 21.332031 0 11.777344 9.558594 21.335938 21.332031 21.335938h170.667969v170.664062c0 11.777344 9.558594 21.335938 21.332031 21.335938 11.777344 0 21.335938-9.558594 21.335938-21.335938v-170.664062h170.664062c11.777344 0 21.335938-9.558594 21.335938-21.335938 0-11.773437-9.558594-21.332031-21.335938-21.332031zm0 0" fill="#000000" data-original="#000000"></path>
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    )
}