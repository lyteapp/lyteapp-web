'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '../lib/LocaleProvider'

export default function NavMobile() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        className={`nav-hamburger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={t('nav.menu')}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        )}
      </button>

      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}

      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <div className="nav-drawer-logo">Lyte<span>app</span></div>
        <nav className="nav-drawer-links">
          <a href="#features" onClick={() => setOpen(false)}>{t('landing.nav.features')}</a>
          <a href="#how" onClick={() => setOpen(false)}>{t('landing.nav.how')}</a>
          <a href="#pricing" onClick={() => setOpen(false)}>{t('landing.nav.pricing')}</a>
          <a href="#testimonials" onClick={() => setOpen(false)}>{t('landing.nav.stories')}</a>
        </nav>
        <div className="nav-drawer-footer">
          <Link href="/registro" className="nav-drawer-cta" onClick={() => setOpen(false)}>
            {t('landing.nav.startFree')}
          </Link>
          <Link href="/login" className="nav-drawer-login" onClick={() => setOpen(false)}>
            {t('landing.nav.haveAccount')}
          </Link>
        </div>
      </div>
    </>
  )
}
