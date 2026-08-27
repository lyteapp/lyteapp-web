'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import BalanceProvider, { useBalance } from './BalanceProvider'
import { SECCIONES, buscarPartida, money, montoPartida, totalSeccion, type Corte } from './balance'

export default function FinanzasShell({ children }: { children: React.ReactNode }) {
  return (
    <BalanceProvider>
      <Shell>{children}</Shell>
    </BalanceProvider>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { corte } = useBalance()
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

        <Arbol />

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
            <Link href="/finanzas" className="fz-crumb-link">Finanzas</Link>
            <span className="fz-crumb-sep">›</span>
            <span className="fz-crumb-here">{tituloDe(pathname, corte)}</span>
          </div>
        </div>

        <div className="fz-content">{children}</div>
      </div>
    </div>
  )
}

/* The sheet's structure, navigable: every section lists its partidas, and each
   one opens its own page. Totals here are the same numbers the sheet shows, so
   the rail doubles as a running summary. */
function Arbol() {
  const { corte, agregarPartida } = useBalance()
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className="fz-nav">
      <Link href="/finanzas" className={`fz-nav-item${pathname === '/finanzas' ? ' active' : ''}`}>
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
          <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
        </svg>
        Balance general
      </Link>

      <Link href="/finanzas/comparacion" className={`fz-nav-item${pathname === '/finanzas/comparacion' ? ' active' : ''}`}>
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
        Comparación
      </Link>

      <Link href="/finanzas/flujo" className={`fz-nav-item${pathname === '/finanzas/flujo' ? ' active' : ''}`}>
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
        </svg>
        Flujo de caja
      </Link>

      {SECCIONES.map(sec => {
        const partidas = corte[sec.id]
        return (
          <div className="fz-group" key={sec.id}>
            <div className={`fz-group-head fz-lado-${sec.lado}`}>
              <span className="fz-group-title">{sec.titulo}</span>
              <span className="fz-group-total num">{money(totalSeccion(partidas))}</span>
            </div>

            <div className="fz-group-items">
              {partidas.map(p => {
                const href = `/finanzas/partida/${p.id}`
                return (
                  <Link
                    key={p.id}
                    href={href}
                    className={`fz-leaf${pathname === href ? ' active' : ''}`}
                  >
                    <span className="fz-leaf-name">{p.nombre || <em>Sin nombre</em>}</span>
                    <span className="fz-leaf-amt num">{money(montoPartida(p))}</span>
                  </Link>
                )
              })}

              <button
                className="fz-add"
                onClick={() => {
                  const p = agregarPartida(sec.id)
                  router.push(`/finanzas/partida/${p.id}`)
                }}
              >
                + Agregar partida
              </button>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

/* The rail says where you are; the topbar says what you're looking at. A
   partida is named rather than shown as an opaque id. */
function tituloDe(pathname: string, corte: Corte): string {
  if (pathname === '/finanzas') return 'Balance general'
  if (pathname === '/finanzas/comparacion') return 'Comparación'
  if (pathname === '/finanzas/flujo') return 'Flujo de caja'
  const m = pathname.match(/^\/finanzas\/partida\/(.+)$/)
  if (m) {
    const hallazgo = buscarPartida(corte, m[1])
    return hallazgo?.partida.nombre || 'Partida sin nombre'
  }
  return 'Finanzas'
}
