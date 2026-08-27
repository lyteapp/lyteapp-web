'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const navItems: { href: string; label: string; soon?: boolean; icon: React.ReactNode }[] = [
  {
    href: '/finanzas', label: 'Resumen',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>,
  },
  {
    href: '/finanzas/movimientos', label: 'Movimientos', soon: true,
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" clipRule="evenodd" /></svg>,
  },
  {
    href: '/finanzas/categorias', label: 'Categorías', soon: true,
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>,
  },
  {
    href: '/finanzas/tasas', label: 'Tasas de cambio', soon: true,
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>,
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

  const pageTitle = navItems.find(i => i.href === pathname)?.label ?? 'Resumen'

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
