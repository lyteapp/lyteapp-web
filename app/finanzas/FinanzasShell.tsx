'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const navItems: { href: string; label: string; soon?: boolean; icon: React.ReactNode }[] = [
  {
    href: '/finanzas', label: 'Balance general',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>,
  },
]

export default function FinanzasShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [storeName, setStoreName] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('name').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) setStoreName(data.name)
    })
  }, [user])

  useEffect(() => { setMobileNav(false) }, [pathname])

  if (loading) {
    return (
      <div className="fz-boot">
        <div className="fz-spinner" />
      </div>
    )
  }

  if (!user) return null

  const pageTitle = navItems.find(i => i.href === pathname)?.label ?? 'Balance general'

  return (
    <div className="fz-layout">
      <aside className={`fz-sidebar${mobileNav ? ' open' : ''}`}>
        <div className="fz-brand">
          <div className="fz-brand-mark">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
          </div>
          <div>
            <div className="fz-brand-title">Finanzas</div>
            {storeName && <div className="fz-brand-sub">{storeName}</div>}
          </div>
          <button className="fz-sidebar-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="fz-nav">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.soon ? '#' : item.href}
              className={`fz-nav-item${pathname === item.href ? ' active' : ''}${item.soon ? ' soon' : ''}`}
              onClick={item.soon ? (e) => e.preventDefault() : undefined}
            >
              {item.icon}
              {item.label}
              {item.soon && <span className="fz-soon">pronto</span>}
            </Link>
          ))}
        </nav>

        <div className="fz-sidebar-bottom">
          <Link href="/dashboard" className="fz-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Volver al dashboard
          </Link>
        </div>
      </aside>

      <div className="fz-main">
        <div className="fz-topbar">
          <button className="fz-hamburger" onClick={() => setMobileNav(o => !o)} aria-label="Menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="fz-crumb">
            <span>Finanzas</span>
            <span className="fz-crumb-sep">›</span>
            <span className="fz-crumb-here">{pageTitle}</span>
          </div>
        </div>

        <div className="fz-content">{children}</div>
      </div>
    </div>
  )
}
