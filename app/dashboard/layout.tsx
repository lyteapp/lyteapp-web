'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth, signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useT, useLocale } from '../lib/LocaleProvider'
import { useLyteSound } from '../lib/useLyteSound'
import './dashboard.css'

import type { TranslationKey } from '../lib/i18n'

const navItems: { href: string; tKey: TranslationKey; exact?: boolean; soon?: boolean; icon: React.ReactNode }[] = [
  {
    href: '/dashboard', tKey: 'nav.dashboard', exact: true,
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
  },
  {
    href: '/dashboard/pedidos', tKey: 'nav.orders',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>,
  },
  {
    href: '/dashboard/productos', tKey: 'nav.products',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>,
  },
  {
    href: '/dashboard/chats', tKey: 'nav.chats', soon: true,
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>,
  },
  {
    href: '/dashboard/analitics', tKey: 'nav.analytics',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>,
  },
  {
    href: '/dashboard/configuracion', tKey: 'nav.settings',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>,
  },
]

const canalSubItems: { href: string; tKey: TranslationKey }[] = [
  { href: '/dashboard/canal/vitrina/editor', tKey: 'nav.vitrina' },
  { href: '/dashboard/canal/checkout',       tKey: 'nav.checkout' },
  { href: '/dashboard/canal/apariencia',     tKey: 'nav.apariencia' },
]

const settingsSubItems: { href: string; tKey: TranslationKey }[] = [
  { href: '/dashboard/configuracion?section=general', tKey: 'nav.general' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const t = useT()
  const [locale, setLocale] = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [orderNotif, setOrderNotif] = useState<{ name: string; total: number } | null>(null)
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [canalOpen, setCanalOpen]         = useState(false)
  const [productosOpen, setProductosOpen] = useState(false)
  const [settingsOpen, setSettingsOpen]   = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const { play, unlock } = useLyteSound()

  useEffect(() => {
    const once = () => { unlock(); window.removeEventListener('pointerdown', once) }
    window.addEventListener('pointerdown', once)
    return () => window.removeEventListener('pointerdown', once)
  }, [unlock])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id, name, slug, logo_url').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) { setStoreId(data.id); setStoreName(data.name); setStoreSlug(data.slug); setLogoUrl(data.logo_url ?? null) }
    })
  }, [user])

  useEffect(() => {
    if (!storeId) return
    const channel = supabase
      .channel(`orders-notif-${storeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          const o = payload.new as { customer_name: string; total: number }
          play()
          setOrderNotif({ name: o.customer_name, total: o.total })
          if (notifTimer.current) clearTimeout(notifTimer.current)
          notifTimer.current = setTimeout(() => setOrderNotif(null), 3000)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId])

  useEffect(() => {
    if (pathname.startsWith('/dashboard/canal')) setCanalOpen(true)
    if (pathname.startsWith('/dashboard/productos')) setProductosOpen(true)
    if (pathname.startsWith('/dashboard/configuracion')) setSettingsOpen(true)
    setMobileNav(false)
  }, [pathname])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F4' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(124,58,237,0.15)', borderTop: '3px solid #7C3AED', borderRadius: '50%', animation: 'dbSpin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!user) return null

  const emailInitial = user.email ? user.email[0].toUpperCase() : '?'
  const pageTitles: Record<string, string> = {
    '/dashboard': t('nav.dashboard'),
    '/dashboard/pedidos': t('nav.orders'),
    '/dashboard/caja': 'Caja',
    '/dashboard/delivery': 'Delivery',
    '/dashboard/clientes': 'Clientes',
    '/dashboard/productos': t('nav.products'),
    '/dashboard/productos/categorias': 'Categorias',
    '/dashboard/chats': t('nav.chats'),
    '/dashboard/analitics': t('nav.analytics'),
    '/dashboard/tienda': t('nav.myStore'),
    '/dashboard/configuracion': t('nav.settings'),
    '/dashboard/canal/vitrina': t('nav.vitrina'),
    '/dashboard/canal/vitrina/editor': t('nav.vitrina'),
    '/dashboard/canal/checkout': t('nav.checkout'),
    '/dashboard/canal/apariencia': t('nav.apariencia'),
    '/dashboard/canal/menu': t('nav.menu'),
    '/dashboard/canal/resenas': t('nav.resenas'),
  }
  const pageTitle = pageTitles[pathname] ?? t('nav.dashboard')

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  return (
    <div className="db-layout">
      {/* SIDEBAR */}
      <aside className={`db-sidebar${mobileNav ? ' open' : ''}`}>
        {/* Brand + close */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '22px 20px', borderBottom: '1px solid #E8E6DF' }}>
          <Link href="/dashboard" className="db-brand-link" style={{ margin: 0 }} onClick={() => setMobileNav(false)}>
            <span className="db-brand-lyte">Lyte</span><span className="db-brand-app">app</span>
          </Link>
          <button className="db-sidebar-close" onClick={() => setMobileNav(false)}>
            {t('nav.close')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Store name */}
        <Link href="/dashboard/tienda" className="db-store-block">
          <div className="db-store-avatar" style={logoUrl ? { background: 'transparent', padding: 0, overflow: 'hidden' } : {}}>
            {logoUrl
              ? <img src={logoUrl} alt={storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : storeName.slice(0, 1).toUpperCase()
            }
          </div>
          <div>
            <div className="db-store-name">{storeName}</div>
            {storeSlug && <div className="db-store-url">lyte-app.com/{storeSlug}</div>}
          </div>
        </Link>

        {/* Nav */}
        <nav className="db-nav">
          {/* Main items: Dashboard, Orders */}
          {navItems.slice(0, 2).map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className={`db-nav-item${isActive ? ' active' : ''}`}>
                {item.icon}
                {t(item.tKey)}
              </Link>
            )
          })}

          {/* Caja */}
          <Link
            href="/dashboard/caja"
            className={`db-nav-item${pathname.startsWith('/dashboard/caja') ? ' active' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
            </svg>
            Caja
          </Link>

          {/* Delivery */}
          <Link
            href="/dashboard/delivery"
            className={`db-nav-item${pathname.startsWith('/dashboard/delivery') ? ' active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="1"/>
              <path d="M16 8h4l3 5v4h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
              <path d="M8 18.5h7"/>
            </svg>
            {t('nav.delivery')}
          </Link>

          {/* Productos (expandable) */}
          <button
            className={`db-canal-toggle${productosOpen ? ' open' : ''}${pathname.startsWith('/dashboard/productos') ? ' active' : ''}`}
            onClick={() => setProductosOpen(o => !o)}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
            {t('nav.products')}
            <svg className="db-canal-chevron" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {productosOpen && (
            <div className="db-canal-items">
              <Link href="/dashboard/productos" className={`db-canal-item${pathname === '/dashboard/productos' ? ' active' : ''}`}>
                Mis productos
              </Link>
              <Link href="/dashboard/productos/categorias" className={`db-canal-item${pathname === '/dashboard/productos/categorias' ? ' active' : ''}`}>
                Categorias
              </Link>
            </div>
          )}

          {/* Inventario — soon */}
          <Link
            href="#"
            className="db-nav-item soon"
            onClick={e => e.preventDefault()}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
              <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/>
            </svg>
            Inventario
            <span className="db-nav-soon">{t('nav.soon')}</span>
          </Link>

          {/* Clientes */}
          <Link
            href="/dashboard/clientes"
            className={`db-nav-item${pathname.startsWith('/dashboard/clientes') ? ' active' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            Clientes
          </Link>

          {/* Diseño (web builder) */}
          <button
            className={`db-canal-toggle${canalOpen ? ' open' : ''}`}
            onClick={() => setCanalOpen(o => !o)}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            Diseño
            <svg className="db-canal-chevron" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {canalOpen && (
            <div className="db-canal-items">
              {canalSubItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`db-canal-item${pathname === item.href ? ' active' : ''}`}
                >
                  {t(item.tKey)}
                </Link>
              ))}
            </div>
          )}

          {/* Analytics */}
          <Link
            href="/dashboard/analitics"
            className={`db-nav-item${pathname.startsWith('/dashboard/analitics') ? ' active' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
            {t('nav.analytics')}
          </Link>

          {/* Bottom items: Chats, Settings */}
          <div className="db-nav-section">{t('nav.config')}</div>
          {navItems.slice(3, 4).map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.soon ? '#' : item.href}
                className={`db-nav-item${isActive ? ' active' : ''}${item.soon ? ' soon' : ''}`}
                onClick={item.soon ? (e) => e.preventDefault() : undefined}
              >
                {item.icon}
                {t(item.tKey)}
                {item.soon && <span className="db-nav-soon">{t('nav.soon')}</span>}
              </Link>
            )
          })}

          {/* Settings submenu */}
          <button
            className={`db-canal-toggle${settingsOpen ? ' open' : ''}${pathname.startsWith('/dashboard/configuracion') ? ' active' : ''}`}
            onClick={() => setSettingsOpen(o => !o)}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            {t('nav.settings')}
            <svg className="db-canal-chevron" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {settingsOpen && (
            <div className="db-canal-items">
              {settingsSubItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="db-canal-item"
                >
                  {t(item.tKey)}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom user row */}
        <div className="db-sidebar-bottom">
          <div className="db-user-row" onClick={handleSignOut} role="button" tabIndex={0}>
            <div className="db-user-avatar">{emailInitial}</div>
            <div className="db-user-info">
              <div className="db-user-email">{user.email}</div>
              <div className="db-signout">{t('nav.signOut')}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="db-main">
        <div className="db-topbar">
          <div className="db-topbar-left">
            <button className="db-hamburger" onClick={() => setMobileNav(o => !o)} aria-label="Menú">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileNav
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                }
              </svg>
            </button>
            <div className="db-crumb">
              <span>{storeName || t('nav.myStore')}</span>
              <span className="db-crumb-sep">›</span>
              <span className="db-crumb-here">{pageTitle}</span>
            </div>
          </div>
          <div className="db-topbar-right">
            <div className="db-lang-switch">
              <button className={locale === 'es' ? 'active' : ''} onClick={() => setLocale('es')}>ESP</button>
              <span className="db-lang-sep" />
              <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>ING</button>
            </div>
            <button className="db-icon-btn" aria-label="Buscar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <button className="db-icon-btn" aria-label="Notificaciones">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
              <span className="db-notif-dot" />
            </button>
          </div>
        </div>

        <div className="db-content db-fade-in">
          {children}
        </div>
      </div>

      {orderNotif && (
        <div className="db-order-toast">
          <div className="db-toast-bell">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path d="M10 2a6 6 0 00-6 6c0 4.5-2 6-2 6h16s-2-1.5-2-6a6 6 0 00-6-6zM8.7 17a1.5 1.5 0 002.6 0H8.7z"/>
            </svg>
          </div>
          <div className="db-toast-body">
            <div className="db-toast-title">Nuevo pedido</div>
            <div className="db-toast-sub">{orderNotif.name} · ${Number(orderNotif.total).toFixed(2)}</div>
          </div>
          <Link href="/dashboard/pedidos" className="db-toast-link" onClick={() => setOrderNotif(null)}>
            Ver
          </Link>
          <button className="db-toast-close" onClick={() => setOrderNotif(null)}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
