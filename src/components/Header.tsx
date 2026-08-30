import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import GitHubIcon from '../assets/vectors/github.svg?react'
import LogoIcon from '../assets/vectors/logo.svg?react'

const links = [
    { to: '/', label: 'Home' },
    { to: '/delete', label: 'Delete a file' },
    { to: '/api', label: 'API' },
    { to: 'https://github.com/Glitchii/tempfile.site', label: 'Source code', target: '_blank' },
    { to: 'https://github.com/Glitchii/', label: 'Contact' },
]

export default function Header() {
    const location = useLocation()
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
        }

        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [])

    const renderLinks = (includeHome: boolean, closeMenu = false) =>
        links
            .filter((link) => includeHome || link.to !== '/' || location.pathname !== '/')
            .map((link) => (
                <li key={link.to} onClick={closeMenu ? () => setMenuOpen(false) : undefined}>
                    <NavLink
                        to={link.to}
                        className={({ isActive }) => isActive ? 'underline' : ''}
                        target={link.target}
                        rel={link.target ? 'noreferrer' : undefined}
                    >
                        {link.label}
                    </NavLink>
                </li>
            ))

    return (
        <header>
            <div className="item logo">
                <Link to="/" className="item logoText">
                    <LogoIcon />
                    <span>TempFile</span>
                </Link>
            </div>

            <nav className="item link">
                <ul>{renderLinks(false)}</ul>

                <div className="menu" ref={menuRef}>
                    <div className="lines" onClick={() => setMenuOpen(!menuOpen)} role="button" tabIndex={0}>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                    <div className={`menuBox${menuOpen ? ' active' : ''}`}>
                        <ul>{renderLinks(true, true)}</ul>
                        <div className="bottomBtns">
                            <a target="_blank" rel="noreferrer" href="https://github.com/Glitchii/">
                                <GitHubIcon />
                            </a>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}
