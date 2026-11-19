'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { queueStep, queueBackground } from '../../lib/queueSteps'
import './estado.css'

// This screen stays open for hours on a TV/PC. The live connection's
// keep-alive runs in a Web Worker: a hidden or screen-off tab gets its timers
// slowed down to once a minute, which would let the connection drop.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { realtime: { worker: true } }
)

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'completed' | 'cancelled'

type QueueOrder = {
  id: string
  status: OrderStatus
  customer_name: string
  created_at: string
  locker_number: number | null
  /** last "Volver a anunciar" from the locker screen */
  locker_notified_at?: string | null
  payment_status?: string | null
  cash_call_at?: string | null
  delivery_type?: string | null
}

// Not on the board until it's paid: an order to be paid at the counter or
// kiosk (cash, point of sale) isn't confirmed before Caja collects it
function awaitingCounterPayment(o: QueueOrder) {
  return o.status === 'pending' && !!o.cash_call_at && o.payment_status !== 'approved' && o.delivery_type !== 'delivery'
}

type CustomerDisplay = 'firstName' | 'fullName' | 'code'

type QueueBoardConfig = {
  enabled: boolean
  bgColor?: string
  bgImage?: string | null
  title: string
  subtitle: string
  preparingLabel: string
  readyLabel: string
  customerDisplay: CustomerDisplay
  showLogo: boolean
  voice: boolean
}

type StoreInfo = {
  id: string
  name: string
  logo_url: string | null
  accentColor: string
  fontFamily: string
  queueBoard: QueueBoardConfig
  /** the store hands orders out through lockers */
  lockers: boolean
}

const FONT_STACKS: Record<string, string> = {
  system:            'system-ui, -apple-system, sans-serif',
  Inter:             "'Inter', system-ui, sans-serif",
  Roboto:            "'Roboto', system-ui, sans-serif",
  Poppins:           "'Poppins', system-ui, sans-serif",
  Montserrat:        "'Montserrat', system-ui, sans-serif",
  Lato:              "'Lato', system-ui, sans-serif",
  'DM Sans':         "'DM Sans', system-ui, sans-serif",
  Nunito:            "'Nunito', system-ui, sans-serif",
  Raleway:           "'Raleway', system-ui, sans-serif",
  Oswald:            "'Oswald', system-ui, sans-serif",
  'Playfair Display':"'Playfair Display', Georgia, serif",
  Ubuntu:            "'Ubuntu', system-ui, sans-serif",
}

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'ready']
const QUEUE_WINDOW_MS = 6 * 60 * 60 * 1000
// How long each "go to locker N" announcement stays up (a tap closes it)
const ANNOUNCE_MS = 9000

function displayName(name: string, mode: CustomerDisplay): string {
  if (mode === 'firstName') return name.trim().split(/\s+/)[0] || name
  return name
}

function shortCode(id: string): string {
  return `#${id.slice(-4).toUpperCase()}`
}

// ── Data, through lyte-app.com ─────────────────────────────────
// The board reads its store and orders from /api/queue (our own server)
// rather than straight from the database, so a PC whose own connection to
// the database has gone bad (after sleeping, a flaky network) still gets
// them as long as the site opens. The live connection below only makes
// changes arrive instantly when it works.

type QueueFetch =
  | { kind: 'ok'; store: { id: string; name: string; logo_url: string | null; accentColor: string | null; trackingConfig: Record<string, unknown>; lockers?: boolean }; orders: QueueOrder[] }
  | { kind: 'notFound' }
  | { kind: 'error' }

async function fetchQueue(slug: string): Promise<QueueFetch> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(`/api/queue?slug=${encodeURIComponent(slug)}`, { cache: 'no-store', signal: ctrl.signal })
    if (r.status === 404) return { kind: 'notFound' }
    if (!r.ok) return { kind: 'error' }
    const j = await r.json()
    return { kind: 'ok', store: j.store, orders: (j.orders ?? []) as QueueOrder[] }
  } catch {
    return { kind: 'error' }
  } finally {
    clearTimeout(t)
  }
}

// ── Voice for the locker announcements ─────────────────────────
// The browser's own speech (no service, no cost), in the best Spanish voice
// the screen has. Browsers only let a page speak once someone has touched
// it, so the board shows "Activar voz" until a tap (or an announcement that
// managed to speak on its own) proves it can.

function spanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  for (const want of ['es-ve', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-ar', 'es-es']) {
    const v = voices.find(x => norm(x.lang) === want)
    if (v) return v
  }
  return voices.find(x => norm(x.lang).startsWith('es')) ?? null
}

function say(text: string, on: { start?: () => void; blocked?: () => void } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = spanishVoice()
  if (v) u.voice = v
  u.lang = v?.lang ?? 'es-VE'
  u.rate = 0.92
  u.onstart = () => on.start?.()
  u.onerror = e => { if (e.error === 'not-allowed') on.blocked?.() }
  synth.speak(u)
}

/** What's said: "Pedido listo, María. Retirar en el casillero número 3." —
 *  with the order code read out character by character when the board shows
 *  codes instead of names */
function announcementText(o: QueueOrder, mode: CustomerDisplay): string {
  const who = mode === 'code'
    ? `código ${shortCode(o.id).slice(1).split('').join(' ')}`
    : displayName(o.customer_name, mode)
  return `Pedido listo, ${who}. Retirar en el casillero número ${o.locker_number}.`
}

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return mins < 1 ? 'ahora' : `hace ${mins} min`
}

function isWithinWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < QUEUE_WINDOW_MS
}

export default function EstadoPage() {
  const params = useParams()
  const storeSlug = params.store as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [orders, setOrders] = useState<QueueOrder[]>([])
  // Orders that just went into a locker, announced big one after another
  const [announcements, setAnnouncements] = useState<QueueOrder[]>([])
  const ordersRef = useRef<QueueOrder[]>([])
  const announced = useRef(new Set<string>())
  useEffect(() => { ordersRef.current = orders }, [orders])
  const current = announcements[0] ?? null
  const dismiss = useCallback(() => setAnnouncements(q => q.slice(1)), [])
  // the board has been allowed to speak (a tap on "Activar voz", or an
  // announcement that spoke on its own)
  const [voiceOn, setVoiceOn] = useState(false)
  useEffect(() => {
    if (!current) return
    const t = setTimeout(dismiss, ANNOUNCE_MS)
    return () => clearTimeout(t)
  }, [current, dismiss])

  // A failed request (no internet yet right after the PC wakes up, a
  // hiccup) is not "store not found": it keeps trying, saying it's
  // connecting. "Not found" is only an answer that has no store in it.
  const [connecting, setConnecting] = useState(false)
  useEffect(() => {
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const load = () => fetchQueue(storeSlug).then(res => {
      if (cancelled) return
      if (res.kind === 'error') {
        tries++
        setConnecting(true)
        retry = setTimeout(load, Math.min(15000, 1500 * tries))
        return
      }
      setConnecting(false)
      if (res.kind === 'notFound') { setNotFound(true); setLoading(false); return }
      const tracking = res.store.trackingConfig ?? {}
      const qb = (tracking.queueBoard as Partial<QueueBoardConfig> | undefined) ?? {}
      setStore({
        id: res.store.id,
        name: res.store.name,
        logo_url: res.store.logo_url,
        accentColor: (tracking.accentColor as string) || res.store.accentColor || '#7C3AED',
        fontFamily: (tracking.fontFamily as string) || 'system',
        lockers: res.store.lockers === true,
        queueBoard: {
          enabled: qb.enabled === true,
          title: qb.title || 'Estado de pedidos',
          subtitle: qb.subtitle || 'Actualizado en tiempo real',
          preparingLabel: qb.preparingLabel || 'En preparación',
          readyLabel: qb.readyLabel || 'Listo',
          customerDisplay: qb.customerDisplay ?? 'firstName',
          showLogo: qb.showLogo !== false,
          voice: qb.voice !== false,
          bgColor: qb.bgColor,
          bgImage: qb.bgImage ?? null,
        },
      })
      const first = res.orders.filter(r => ACTIVE_STATUSES.includes(r.status) && isWithinWindow(r.created_at) && !awaitingCounterPayment(r))
      ordersRef.current = first
      setOrders(first)
      setLoading(false)
    })
    load()
    return () => { cancelled = true; clearTimeout(retry) }
  }, [storeSlug])

  // Keep the screen on while the board is showing (Windows turning the
  // display off is what lets the browser put the page to sleep); asked again
  // whenever the page comes back into view
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }
    if (!nav.wakeLock) return
    let lock: WakeLock | null = null
    let gone = false
    const ask = () => {
      if (document.visibilityState !== 'visible') return
      nav.wakeLock!.request('screen').then(l => { if (gone) l.release().catch(() => {}); else lock = l }).catch(() => {})
    }
    ask()
    document.addEventListener('visibilitychange', ask)
    return () => { gone = true; document.removeEventListener('visibilitychange', ask); lock?.release().catch(() => {}) }
  }, [])

  const storeId = store?.id
  const enabled = store?.queueBoard.enabled ?? false
  const voice = store?.queueBoard.voice ?? false
  const customerMode = store?.queueBoard.customerDisplay ?? 'firstName'

  // Each locker announcement is said out loud as it comes up (and stops if
  // it's tapped away before the end)
  useEffect(() => {
    if (!current || !voice || current.locker_number == null) return
    say(announcementText(current, customerMode), { start: () => setVoiceOn(true) })
    return () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }
  }, [current, voice, customerMode])
  // the list of voices arrives a moment after the page opens on some browsers
  useEffect(() => {
    if (!voice || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.getVoices()
  }, [voice])

  const applyRow = useCallback((row: QueueOrder) => {
    setOrders(prev => {
      const isActive = ACTIVE_STATUSES.includes(row.status) && isWithinWindow(row.created_at) && !awaitingCounterPayment(row)
      if (!isActive) return prev.filter(o => o.id !== row.id)
      const exists = prev.some(o => o.id === row.id)
      const next = exists ? prev.map(o => (o.id === row.id ? row : o)) : [...prev, row]
      return next.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
    })
  }, [])

  // An order on the board that just got its locker (not one that already
  // had it when the screen loaded), or whose locker the locker screen asked
  // to announce again ("Volver a anunciar") — whether the change came live
  // or from a catch-up fetch
  const noteForAnnouncement = useCallback((row: QueueOrder) => {
    const before = ordersRef.current.find(o => o.id === row.id)
    const inLocker = row.locker_number != null && row.status === 'ready' && !!before
    const justPut = inLocker && before!.locker_number == null
    const again = inLocker && !!row.locker_notified_at && row.locker_notified_at !== before!.locker_notified_at
    const key = `${row.id}:${again ? row.locker_notified_at : 'locker'}`
    if ((justPut || again) && !announced.current.has(key)) {
      announced.current.add(key)
      // (if it's already up or waiting, it goes up again from the start)
      setAnnouncements(q => [...q.filter(o => o.id !== row.id), row])
    }
  }, [])

  useEffect(() => {
    if (!storeId || !enabled) return
    let cancelled = false
    // the live connection is up (changes arrive instantly) — while it isn't,
    // the list is re-read through the server every few seconds instead
    let live = false

    // The whole current list, through the server: to catch up on whatever
    // the live connection missed (when it reconnects, when the screen/tab
    // comes back, when the internet returns), and on a timer — every 30s
    // while the live connection works, every 4s while it doesn't
    const refresh = () => fetchQueue(storeSlug).then(res => {
      if (cancelled || res.kind !== 'ok') return
      res.orders.forEach(noteForAnnouncement)
      const next = res.orders.filter(r => ACTIVE_STATUSES.includes(r.status) && isWithinWindow(r.created_at) && !awaitingCounterPayment(r))
      ordersRef.current = next
      setOrders(next)
    })
    let poll: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(poll)
      poll = setTimeout(() => { refresh().finally(() => { if (!cancelled) schedule() }) }, live ? 30000 : 4000)
    }

    // The live connection, rebuilt whenever it breaks
    let channel: ReturnType<typeof supabase.channel> | null = null
    let rejoin: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      if (cancelled) return
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel(`queue-${storeId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
          payload => {
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string }
              setOrders(prev => prev.filter(o => o.id !== old.id))
              return
            }
            const row = payload.new as QueueOrder
            noteForAnnouncement(row)
            applyRow(row)
          }
        )
        .subscribe(status => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') { live = true; refresh(); schedule(); return }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            live = false
            schedule()
            clearTimeout(rejoin)
            rejoin = setTimeout(connect, 5000)
          }
        })
    }

    connect()
    schedule()
    const wake = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      cancelled = true
      clearTimeout(rejoin)
      clearTimeout(poll)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      if (channel) supabase.removeChannel(channel)
    }
  }, [storeId, storeSlug, enabled, applyRow, noteForAnnouncement])

  if (loading) {
    return (
      <div className="oq-state">
        <div className="oq-spinner" />
        {connecting && <div className="oq-subtitle" style={{ marginTop: 16 }}>Conectando…</div>}
      </div>
    )
  }

  if (notFound || !store) {
    return (
      <div className="oq-state">
        <div className="oq-title">Tienda no encontrada</div>
        <div className="oq-subtitle">Este enlace no corresponde a ninguna tienda activa.</div>
      </div>
    )
  }

  if (!store.queueBoard.enabled) {
    return (
      <div className="oq-state">
        <div className="oq-title">No disponible</div>
        <div className="oq-subtitle">Esta pantalla no esta habilitada por el momento.</div>
      </div>
    )
  }

  // A store with lockers: "Listo" holds only what's already in a locker
  // (by locker number); an order that's done but not in one yet stays in
  // preparation, as "Casi listo"
  const inLocker = (o: QueueOrder) => o.status === 'ready' && o.locker_number != null
  const preparing = store.lockers ? orders.filter(o => !inLocker(o)) : orders.filter(o => o.status !== 'ready')
  const ready = store.lockers
    ? orders.filter(inLocker).sort((a, b) => (a.locker_number ?? 0) - (b.locker_number ?? 0))
    : orders.filter(o => o.status === 'ready')
  const font = FONT_STACKS[store.fontFamily] ?? FONT_STACKS.system
  const bg = queueBackground(store.queueBoard)

  return (
    <div
      className={`oq-wrap${bg.dark ? ' oq-dark' : ''}`}
      style={{ ['--oq-accent' as string]: store.accentColor, fontFamily: font }}
    >
      {/* the background (color or photo) stays put while the list scrolls */}
      <div className="oq-bg" style={{ background: bg.css }} aria-hidden="true" />
      <div className="oq-header">
        {store.queueBoard.showLogo && (
          store.logo_url
            ? <img src={store.logo_url} alt={store.name} className="oq-logo" />
            : <div className="oq-logo-fallback">{store.name.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="oq-title">{store.queueBoard.title}</div>
        <div className="oq-subtitle">{store.queueBoard.subtitle}</div>
      </div>

      <div className="oq-board">
        <QueueColumn
          label={store.queueBoard.preparingLabel}
          dotColor="#F59E0B"
          orders={preparing}
          customerDisplay={store.queueBoard.customerDisplay}
          accentColor={store.accentColor}
          showTime
          lockerMode={store.lockers}
        />
        <QueueColumn
          label={store.queueBoard.readyLabel}
          dotColor="#10B981"
          orders={ready}
          customerDisplay={store.queueBoard.customerDisplay}
          accentColor={store.accentColor}
          asLockers={store.lockers}
        />
      </div>

      {current && (
        <div className="oq-announce" role="alert" onClick={dismiss}>
          <div className="oq-announce-card" key={current.id}>
            <div className="oq-announce-kicker">Tu pedido está listo</div>
            <div className="oq-announce-name">
              {store.queueBoard.customerDisplay === 'code' ? shortCode(current.id) : displayName(current.customer_name, store.queueBoard.customerDisplay)}
            </div>
            {store.queueBoard.customerDisplay !== 'code' && <div className="oq-announce-code">{shortCode(current.id)}</div>}
            <div className="oq-announce-locker">
              <span className="oq-announce-locker-label">Retíralo en el casillero</span>
              <span className="oq-announce-locker-num">{current.locker_number}</span>
            </div>
            <div className="oq-announce-timer" style={{ animationDuration: `${ANNOUNCE_MS}ms` }} />
          </div>
        </div>
      )}

      {store.queueBoard.voice && !voiceOn && (
        // Browsers only let a page speak after a touch: one tap when the
        // screen is turned on, and the announcements speak from then on
        <button type="button" className="oq-voice-btn"
          onClick={() => say('Voz activada', { start: () => setVoiceOn(true) })}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />
          </svg>
          Activar voz
        </button>
      )}

      <div className="oq-footer">
        Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a>
      </div>
    </div>
  )
}

// How long each page of a column stays up when its orders don't all fit
const PAGE_MS = 8000

/** One column of the board. It never scrolls: when its orders don't all fit
 *  in the screen's height they're split into pages that take turns by
 *  themselves, like an airport's departures board (the dots show which page
 *  is up). How many fit is measured from the column's own height and a card's. */
function QueueColumn({
  label, dotColor, orders, customerDisplay, accentColor, showTime, lockerMode, asLockers,
}: {
  label: string
  dotColor: string
  orders: QueueOrder[]
  customerDisplay: CustomerDisplay
  accentColor: string
  showTime?: boolean
  /** the store uses lockers: a done order not in one yet reads "Casi listo" */
  lockerMode?: boolean
  /** show the orders as locker boxes (big number + name) in a grid */
  asLockers?: boolean
}) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [perPage, setPerPage] = useState(0)
  const [turn, setTurn] = useState(0)

  // how many cards fit, measured again whenever the column's size changes
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const card = list.querySelector('.oq-card, .oq-locker') as HTMLElement | null
      const grid = list.firstElementChild as HTMLElement | null
      if (!card || !grid) return
      const cs = getComputedStyle(grid)
      const gap = parseFloat(cs.rowGap) || 0
      const rows = Math.max(1, Math.floor((list.clientHeight + gap) / (card.offsetHeight + gap)))
      // the locker boxes sit several to a row
      const cols = asLockers ? Math.max(1, cs.gridTemplateColumns.split(' ').filter(Boolean).length) : 1
      const fit = rows * cols
      setPerPage(p => (p === fit ? p : fit))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    measure()
    return () => ro.disconnect()
  }, [orders.length, asLockers])

  const size = perPage || orders.length || 1
  const pages = Math.max(1, Math.ceil(orders.length / size))
  const page = turn % pages
  const shown = orders.slice(page * size, page * size + size)

  // the pages take turns
  useEffect(() => {
    if (pages <= 1) return
    const t = setInterval(() => setTurn(n => n + 1), PAGE_MS)
    return () => clearInterval(t)
  }, [pages])

  return (
    <div className="oq-column">
      <div className="oq-column-head">
        <div className="oq-column-dot" style={{ background: dotColor }} />
        <span className="oq-column-label">{label}</span>
        {pages > 1 && (
          <span className="oq-pages" aria-label={`Página ${page + 1} de ${pages}`}>
            {Array.from({ length: pages }, (_, i) => <i key={i} className={i === page ? 'on' : ''} />)}
          </span>
        )}
        <span className="oq-column-count">{orders.length}</span>
      </div>
      <div className="oq-column-list" ref={listRef}>
        <div key={pages > 1 ? page : 'all'} className={`oq-page${asLockers ? ' oq-locker-grid' : ''}${pages > 1 ? ' turning' : ''}`}>
      {asLockers ? shown.map(o => (
        // a locker: "Casillero", its number big, and whose it is
        <div key={o.id} className="oq-locker">
          <span className="oq-locker-label">Casillero</span>
          <span className="oq-locker-num">{o.locker_number}</span>
          {/* the customer's full name (or the code, when the board shows codes) */}
          <span className="oq-locker-name">
            {customerDisplay === 'code' ? shortCode(o.id) : o.customer_name.trim()}
          </span>
        </div>
      )) : shown.map(o => {
        const waitingLocker = lockerMode && o.status === 'ready' && o.locker_number == null
        const step = waitingLocker ? { pct: 92, label: 'Casi listo' } : queueStep(o.status)
        return (
        <div key={o.id} className="oq-card">
          <div className="oq-card-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em', minWidth: 0 }}>
            <span className="oq-card-code" style={{ color: accentColor, background: accentColor + '14' }}>
              {shortCode(o.id)}
            </span>
            {customerDisplay !== 'code' && (
              <span className="oq-card-name">{displayName(o.customer_name, customerDisplay)}</span>
            )}
            {o.locker_number != null && (
              <span className="oq-card-code" style={{ color: accentColor, background: accentColor + '14' }}>
                Casillero {o.locker_number}
              </span>
            )}
          </div>
          {showTime && <span className="oq-card-time">{minutesAgo(o.created_at)}</span>}
          </div>
          {/* the bar and its step on one line (a shorter card: more fit) */}
          <div className="oq-progress-row">
            <div
              className={`oq-progress${o.status === 'ready' && !waitingLocker ? ' done' : ''}`}
              role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={step.pct} aria-label={step.label}
            >
              <div className="oq-progress-fill" style={{ width: `${step.pct}%` }} />
            </div>
            <div className="oq-progress-label">{step.label}</div>
          </div>
        </div>
        )
      })}
        </div>
      </div>
    </div>
  )
}
