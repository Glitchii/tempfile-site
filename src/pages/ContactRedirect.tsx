import { useEffect } from 'react'

export default function ContactRedirect() {
    useEffect(() => {
        window.location.replace('https://github.com/Glitchii/')
    }, [])

    return null
}
