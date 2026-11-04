'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDashboardStore } from '../lib/DashboardStoreProvider'
import { useT } from '../lib/LocaleProvider'
import { WIDGETS, DEFAULT_WIDGETS, type WidgetSize } from './widgets'
import './home.css'

// The dashboard home: a greeting, then the owner's own pick of widgets
// (widgets.tsx). "Personalizar" adds, removes, resizes and reorders them;
// on a phone, pressing and holding a widget lifts it — drag it to move it,
// or let go to get its menu (size, move, remove). The layout is kept per
// account and per store (user_metadata.home_widgets, plus this device's
// copy so it shows right away), as "id" or "id@size" strings.

type Item = { id: string; size: WidgetSize }
const byId = new Map(WIDGETS.map(w => [w.id, w]))
const SIZE_NAME: Record<WidgetSize, string> = { sm: 'Pequeño', md: 'Mediano', lg: 'Grande' }

function parse(raw: unknown): Item[] | null {
  if (!Array.isArray(raw)) return null
  const out: Item[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const [id, size] = x.split('@')
    const w = byId.get(id)
    if (!w || out.some(o => o.id === id)) continue
    out.push({ id, size: w.sizes.includes(size as WidgetSize) ? size as WidgetSize : w.size })
  }
  return out
}
const serialize = (items: Item[]) => items.map(i => (i.size === byId.get(i.id)!.size ? i.id : `${i.id}@${i.size}`))
const defaults = () => parse(DEFAULT_WIDGETS)!

const HOLD_MS = 450
const MOVE_TOLERANCE = 10

export default function Dashboard() {
  const { user } = useAuth()
  const t = useT()
  const { storeId, store } = useDashboardStore()
  const storeSlug = store?.slug ?? ''
  const [layout, setLayout] = useState<Item[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [library, setLibrary] = useState(false)
  const [menu, setMenu] = useState<string | null>(null) // phone: widget whose menu is open
  const [todayOrders, setTodayOrders] = useState(0)
  // phone press-and-hold / drag
  const [lifted, setLifted] = useState<string | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const press = useRef<{ id: string; x: number; y: number; timer: ReturnType<typeof setTimeout> | null; lifted: boolean; moved: boolean } | null>(null)
  const swallowClick = useRef(false)

  const cacheKey = user && storeId ? `lyte-home-widgets:${user.id}:${storeId}` : ''

  // Load this store's layout: the account's saved one, else this device's, else the default
  useEffect(() => {
    if (!user || !storeId) return
    const saved = parse((user.user_metadata?.home_widgets ?? {})[storeId])
    let local: Item[] | null = null
    try { local = parse(JSON.parse(localStorage.getItem(cacheKey) || 'null')) } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(saved ?? local ?? defaults())
  }, [user, storeId, cacheKey])

  useEffect(() => {
    if (!storeId) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).gte('created_at', start.toISOString()).neq('status', 'cancelled')
      .then(({ count }) => setTodayOrders(count ?? 0))
  }, [storeId])

  function save(next: Item[]) {
    setLayout(next)
    if (!user || !storeId) return
    const raw = serialize(next)
    try { localStorage.setItem(cacheKey, JSON.stringify(raw)) } catch {}
    const all = { ...(user.user_metadata?.home_widgets ?? {}), [storeId]: raw }
    supabase.auth.updateUser({ data: { home_widgets: all } }).catch(() => {})
  }
  const indexOf = (id: string) => (layout ?? []).findIndex(i => i.id === id)
  const move = (id: string, d: -1 | 1) => {
    if (!layout) return
    const i = indexOf(id), j = i + d
    if (i < 0 || j < 0 || j >= layout.length) return
    const next = [...layout]; [next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  const moveTo = (id: string, targetId: string) => {
    if (!layout || id === targetId) return
    const from = indexOf(id), to = indexOf(targetId)
    const next = [...layout]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    save(next)
  }
  const resize = (id: string, size: WidgetSize) => layout && save(layout.map(i => (i.id === id ? { ...i, size } : i)))
  const cycleSize = (id: string) => {
    const it = layout?.find(i => i.id === id); const w = byId.get(id)
    if (!it || !w) return
    resize(id, w.sizes[(w.sizes.indexOf(it.size) + 1) % w.sizes.length])
  }
  const remove = (id: string) => { if (layout) save(layout.filter(i => i.id !== id)); setMenu(null) }
  const add = (id: string) => {
    const w = byId.get(id)
    if (layout && w && !layout.some(i => i.id === id)) save([...layout, { id, size: w.size }])
    setLibrary(false)
  }

  // ── Phone: press and hold a widget ─────────────────────────────────────
  function onTouchStart(id: string, e: React.TouchEvent) {
    if (e.touches.length !== 1) return
    const tch = e.touches[0]
    const p = { id, x: tch.clientX, y: tch.clientY, timer: null as ReturnType<typeof setTimeout> | null, lifted: false, moved: false }
    p.timer = setTimeout(() => {
      p.lifted = true
      swallowClick.current = true
      try { navigator.vibrate?.(30) } catch {}
      setLifted(id); setDrag({ x: 0, y: 0 })
    }, HOLD_MS)
    press.current = p
  }
  // a non-passive listener, so a lifted widget can stop the page from scrolling
  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      const p = press.current
      if (!p) return
      const tch = e.touches[0]
      const dx = tch.clientX - p.x, dy = tch.clientY - p.y
      if (!p.lifted) {
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) { if (p.timer) clearTimeout(p.timer); press.current = null }
        return
      }
      e.preventDefault()
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) p.moved = true
      // near the top/bottom edge, scroll the page so it can go further
      const edge = 90
      const step = tch.clientY < edge ? -14 : tch.clientY > window.innerHeight - edge ? 14 : 0
      if (step) { window.scrollBy(0, step); p.y -= step }
      setDrag({ x: dx, y: tch.clientY - p.y })
      // which widget is under the finger
      const under = document.elementsFromPoint(tch.clientX, tch.clientY)
        .map(el => (el as HTMLElement).closest<HTMLElement>('[data-wid]'))
        .find(el => el && el.dataset.wid !== p.id)
      setDropOn(under?.dataset.wid ?? null)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    return () => document.removeEventListener('touchmove', onMove)
  }, [])
  function onTouchEnd(e: React.TouchEvent) {
    const p = press.current
    press.current = null
    if (!p) return
    if (p.timer) clearTimeout(p.timer)
    if (!p.lifted) return
    // no tap/click from this touch (it would land on the menu's backdrop)
    if (e.cancelable) e.preventDefault()
    if (p.moved && dropOn) moveTo(p.id, dropOn)
    else if (!p.moved) setMenu(p.id)
    setLifted(null); setDropOn(null); setDrag({ x: 0, y: 0 })
    setTimeout(() => { swallowClick.current = false }, 350)
  }

  const firstName = user?.email?.split('@')[0] ?? ''
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const available = WIDGETS.filter(w => !(layout ?? []).some(i => i.id === w.id))
  const menuItem = menu ? layout?.find(i => i.id === menu) : null
  const menuDef = menu ? byId.get(menu) : null

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
          <span>Agrega, quita, cambia el tamaño y ordena tus widgets.</span>
          <button type="button" onClick={() => save(defaults())}>Restablecer</button>
        </div>
      )}

      {/* ── WIDGETS ── */}
      <div
        className={`dw-grid${editing ? ' editing' : ''}${lifted ? ' dragging' : ''}`}
        onClickCapture={e => { if (swallowClick.current) { e.preventDefault(); e.stopPropagation() } }}
      >
        {storeId && (layout ?? []).map((item, i) => {
          const w = byId.get(item.id)
          if (!w) return null
          const isLifted = lifted === item.id
          return (
            <section
              key={item.id}
              data-wid={item.id}
              className={`dh-card dw-card dw-${item.size}${isLifted ? ' lifted' : ''}${dropOn === item.id ? ' drop-target' : ''}`}
              style={isLifted ? { transform: `translate(${drag.x}px, ${drag.y}px) scale(1.03)` } : undefined}
              onTouchStart={e => onTouchStart(item.id, e)}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              onContextMenu={e => e.preventDefault()}
            >
              {editing && (
                <div className="dw-tools">
                  <span className="dw-tools-name">{w.title}</span>
                  {w.sizes.length > 1 && (
                    <button type="button" className="dw-tools-size" onClick={() => cycleSize(item.id)} aria-label="Cambiar tamaño" title={`Tamaño: ${SIZE_NAME[item.size]}`}>
                      {item.size === 'sm' ? 'S' : item.size === 'md' ? 'M' : 'L'}
                    </button>
                  )}
                  <button type="button" onClick={() => move(item.id, -1)} disabled={i === 0} aria-label="Mover antes">←</button>
                  <button type="button" onClick={() => move(item.id, 1)} disabled={i === layout!.length - 1} aria-label="Mover después">→</button>
                  <button type="button" className="dw-tools-x" onClick={() => remove(item.id)} aria-label="Quitar">✕</button>
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
      {layout && layout.length > 0 && !editing && (
        <div className="dw-hint">Mantén presionado un widget para moverlo, cambiarle el tamaño o quitarlo.</div>
      )}

      {/* ── PHONE: a widget's menu (after press and hold) ── */}
      {menuItem && menuDef && (
        <div className="dw-lib-backdrop" onClick={() => { if (!swallowClick.current) setMenu(null) }}>
          <div className="dw-lib dw-menu" onClick={e => e.stopPropagation()} role="dialog" aria-label={menuDef.title}>
            <div className="dw-lib-head">
              <div className="dw-menu-title"><span className="dw-lib-icon">{menuDef.icon}</span><b>{menuDef.title}</b></div>
              <button type="button" className="dw-lib-close" onClick={() => setMenu(null)} aria-label="Cerrar">✕</button>
            </div>
            {menuDef.sizes.length > 1 && (
              <>
                <div className="dw-menu-label">Tamaño</div>
                <div className="dw-menu-sizes">
                  {menuDef.sizes.slice().sort((a, b) => ['sm', 'md', 'lg'].indexOf(a) - ['sm', 'md', 'lg'].indexOf(b)).map(sz => (
                    <button key={sz} type="button" className={menuItem.size === sz ? 'on' : ''} onClick={() => resize(menuItem.id, sz)}>
                      <span className={`dw-size-ico ${sz}`} />
                      {SIZE_NAME[sz]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="dw-menu-label">Posición</div>
            <div className="dw-menu-row">
              <button type="button" onClick={() => move(menuItem.id, -1)} disabled={indexOf(menuItem.id) === 0}>↑ Subir</button>
              <button type="button" onClick={() => move(menuItem.id, 1)} disabled={indexOf(menuItem.id) === (layout?.length ?? 1) - 1}>↓ Bajar</button>
            </div>
            <div className="dw-menu-row">
              <button type="button" onClick={() => { setMenu(null); setEditing(true) }}>Editar inicio</button>
              <button type="button" className="danger" onClick={() => remove(menuItem.id)}>Quitar widget</button>
            </div>
          </div>
        </div>
      )}

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
