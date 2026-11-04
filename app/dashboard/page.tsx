'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDashboardStore } from '../lib/DashboardStoreProvider'
import { useT } from '../lib/LocaleProvider'
import { WIDGETS, DEFAULT_WIDGETS } from './widgets'
import './home.css'

// The dashboard home: a greeting, then the owner's own pick of widgets
// (widgets.tsx). "Personalizar" adds, removes and reorders them; the
// layout is kept per account and per store (user_metadata.home_widgets,
// plus this device's copy so it shows right away).

const known = new Set(WIDGETS.map(w => w.id))
const clean = (ids: unknown): string[] | null =>
  Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && known.has(x)) : null

export default function Dashboard() {
  const { user } = useAuth()
  const t = useT()
  const { storeId, store } = useDashboardStore()
  const storeSlug = store?.slug ?? ''
  const [layout, setLayout] = useState<string[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [library, setLibrary] = useState(false)
  const [todayOrders, setTodayOrders] = useState(0)

  const cacheKey = user && storeId ? `lyte-home-widgets:${user.id}:${storeId}` : ''

  // Load this store's layout: the account's saved one, else this device's, else the default
  useEffect(() => {
    if (!user || !storeId) return
    const saved = clean((user.user_metadata?.home_widgets ?? {})[storeId])
    let local: string[] | null = null
    try { local = clean(JSON.parse(localStorage.getItem(cacheKey) || 'null')) } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(saved ?? local ?? DEFAULT_WIDGETS)
  }, [user, storeId, cacheKey])

  useEffect(() => {
    if (!storeId) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).gte('created_at', start.toISOString()).neq('status', 'cancelled')
      .then(({ count }) => setTodayOrders(count ?? 0))
  }, [storeId])

  function save(next: string[]) {
    setLayout(next)
    if (!user || !storeId) return
    try { localStorage.setItem(cacheKey, JSON.stringify(next)) } catch {}
    const all = { ...(user.user_metadata?.home_widgets ?? {}), [storeId]: next }
    supabase.auth.updateUser({ data: { home_widgets: all } }).catch(() => {})
  }
  const move = (i: number, d: -1 | 1) => {
    if (!layout) return
    const j = i + d
    if (j < 0 || j >= layout.length) return
    const next = [...layout]; [next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  const remove = (id: string) => layout && save(layout.filter(x => x !== id))
  const add = (id: string) => { if (layout && !layout.includes(id)) save([...layout, id]); setLibrary(false) }

  const firstName = user?.email?.split('@')[0] ?? ''
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const available = WIDGETS.filter(w => !(layout ?? []).includes(w.id))

  return (
    <div className="dh-content">

      {/* ── HERO ── */}
      <section className="dh-hero">
        <div className="dh-greeting">
          <div className="dh-eyebrow">{today}</div>
          <h1 className="dh-headline">
            {t('dash.hello')} {firstName}.<br />
            {todayOrders > 0
              ? <em>{t('dash.ordersToday', { n: String(todayOrders) })}</em>
              : <em>{t('dash.startSelling')}</em>}
          </h1>
          <div className="dh-cta">
            {storeSlug && <Link href={`/${storeSlug}`} target="_blank" className="dh-btn-secondary">{t('dash.viewPublicStore')}</Link>}
            <button className="dh-btn-ghost" onClick={() => { if (storeSlug) navigator.clipboard.writeText(`https://lyte-app.com/${storeSlug}`) }}>
              {t('dash.shareLink')}
            </button>
            <button type="button" className={`dh-btn-ghost dw-customize${editing ? ' on' : ''}`} onClick={() => setEditing(e => !e)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7M14 17.5h7" /></svg>
              {editing ? 'Listo' : 'Personalizar'}
            </button>
          </div>
        </div>
      </section>

      {editing && (
        <div className="dw-editbar">
          <span>Agrega, quita y ordena los widgets de tu inicio.</span>
          <button type="button" onClick={() => save(DEFAULT_WIDGETS)}>Restablecer</button>
        </div>
      )}

      {/* ── WIDGETS ── */}
      <div className={`dw-grid${editing ? ' editing' : ''}`}>
        {storeId && (layout ?? []).map((id, i) => {
          const w = WIDGETS.find(x => x.id === id)
          if (!w) return null
          return (
            <section key={id} className={`dh-card dw-card dw-${w.size}`}>
              {editing && (
                <div className="dw-tools">
                  <span className="dw-tools-name">{w.title}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover antes">←</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === layout!.length - 1} aria-label="Mover después">→</button>
                  <button type="button" className="dw-tools-x" onClick={() => remove(id)} aria-label="Quitar">✕</button>
                </div>
              )}
              <w.Component storeId={storeId} storeSlug={storeSlug} />
            </section>
          )
        })}
        {(editing || (layout && layout.length === 0)) && (
          <button type="button" className="dh-card dw-card dw-sm dw-add" onClick={() => setLibrary(true)}>
            <span>+</span>
            Agregar widget
          </button>
        )}
      </div>

      {/* ── WIDGET LIBRARY ── */}
      {library && (
        <div className="dw-lib-backdrop" onClick={() => setLibrary(false)}>
          <div className="dw-lib" onClick={e => e.stopPropagation()} role="dialog" aria-label="Agregar widget">
            <div className="dw-lib-head">
              <div>
                <div className="dw-lib-title">Agregar widget</div>
                <div className="dw-lib-sub">Elige qué quieres ver en tu inicio.</div>
              </div>
              <button type="button" className="dw-lib-close" onClick={() => setLibrary(false)} aria-label="Cerrar">✕</button>
            </div>
            {available.length === 0 ? (
              <div className="dw-empty">Ya tienes todos los widgets en tu inicio.</div>
            ) : (
              <div className="dw-lib-list">
                {available.map(w => (
                  <button key={w.id} type="button" className="dw-lib-item" onClick={() => add(w.id)}>
                    <span className="dw-lib-icon">{w.icon}</span>
                    <span className="dw-lib-text"><b>{w.title}</b><small>{w.desc}</small></span>
                    <span className="dw-lib-add">Agregar</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
