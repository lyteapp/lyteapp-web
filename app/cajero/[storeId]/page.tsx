'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import './cajero.css'

type Order = {
  id: string
  customer_name: string
  customer_phone: string
  payment_method: string | null
  payment_proof_url: string | null
  payment_status: string | null
  payment_verified_by: string | null
  total: number
  status: string
  created_at: string
  delivery_type: string | null
  order_number?: number | null
  /** a payment the staff collects in person (cash at a kiosk, point of sale) */
  cash_call_at?: string | null
  /** placed at a kiosk: the customer is waiting there */
  from_kiosk?: boolean
}

// A short two-note chime, made on the spot (no sound file)
function chime(ctx: AudioContext) {
  const now = ctx.currentTime
  ;[[880, 0], [660, 0.22], [880, 0.6], [660, 0.82]].forEach(([f, at]) => {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = f
    g.gain.setValueAtTime(0.0001, now + at)
    g.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.2)
    o.connect(g).connect(ctx.destination)
    o.start(now + at); o.stop(now + at + 0.22)
  })
}

const METHOD_CURRENCY: Record<string, { label: string; currency: string; symbol: string }> = {
  'pago movil':       { label: 'Pago Movil',       currency: 'VES', symbol: 'Bs' },
  'pago móvil':       { label: 'Pago Movil',       currency: 'VES', symbol: 'Bs' },
  'efectivo bs':      { label: 'Efectivo Bs',      currency: 'VES', symbol: 'Bs' },
  'transferencia':    { label: 'Transferencia',    currency: 'VES', symbol: 'Bs' },
  'transferencia bs': { label: 'Transferencia Bs', currency: 'VES', symbol: 'Bs' },
  'punto de venta':   { label: 'Punto de Venta',   currency: 'VES', symbol: 'Bs' },
  'punto_venta':      { label: 'Punto de Venta',   currency: 'VES', symbol: 'Bs' },
  'zelle':            { label: 'Zelle',            currency: 'USD', symbol: '$'  },
  'efectivo usd':     { label: 'Efectivo USD',     currency: 'USD', symbol: '$'  },
  'efectivo':         { label: 'Efectivo USD',     currency: 'USD', symbol: '$'  },
  'usdt':             { label: 'USDT',             currency: 'USDT', symbol: '₮' },
  'binance':          { label: 'Binance Pay',      currency: 'USDT', symbol: '₮' },
  'binance pay':      { label: 'Binance Pay',      currency: 'USDT', symbol: '₮' },
}

function whatsappUrl(phone: string) {
  let num = phone.replace(/[^\d]/g, '')
  if (num.startsWith('0')) num = '58' + num.slice(1)
  return `https://wa.me/${num}`
}

function getCurrencyInfo(method: string | null) {
  if (!method) return { label: 'Otro', currency: 'USD', symbol: '$' }
  return METHOD_CURRENCY[method.toLowerCase().trim()] ?? { label: method, currency: 'USD', symbol: '$' }
}

function isToday(iso: string) {
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

const SESSION_KEY    = (id: string) => `cajero-pin-${id}`
const SESSION_CAJERA = (id: string) => `cajero-name-${id}`

export default function CajeroPage() {
  const params  = useParams()
  const storeId = params.storeId as string

  // Auth
  const [authState, setAuthState]   = useState<'checking' | 'pin' | 'ok' | 'notfound' | 'error'>('checking')
  const [pinInput, setPinInput]     = useState('')
  const [pinError, setPinError]     = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  // App
  const [storeName, setStoreName]   = useState('')
  const [cajeraName, setCajeraName] = useState('')
  const [orders, setOrders]         = useState<Order[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [bcvRate, setBcvRate]       = useState<number>(0)
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const [verifying, setVerifying]   = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // the alert's sound: browsers only allow it after a touch on the page
  const audioRef = useRef<AudioContext | null>(null)
  const [soundOn, setSoundOn] = useState(false)

  const doFetch = useCallback(async (pin: string): Promise<{ ok: boolean; requiresPin?: boolean; notFound?: boolean; error?: boolean }> => {
    try {
      const res = await fetch(`/api/caja?storeId=${storeId}`, {
        headers: { 'x-cajero-pin': pin },
      })
      if (res.status === 404) return { ok: false, notFound: true }
      if (res.status === 401) return { ok: false, requiresPin: true }
      if (!res.ok)            return { ok: false, error: true }
      const json = await res.json()
      setStoreName(json.store?.name ?? '')
      if (json.cajera?.name) setCajeraName(json.cajera.name)
      setOrders(json.orders ?? [])
      setLastUpdate(new Date())
      return { ok: true }
    } catch {
      return { ok: false, error: true }
    }
  }, [storeId])

  // Initial auth
  useEffect(() => {
    const savedPin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
    doFetch(savedPin).then(result => {
      if (result.notFound)    { setAuthState('notfound'); return }
      if (result.requiresPin) { setAuthState('pin');      return }
      if (result.error)       { setAuthState('error');    return }
      if (result.ok)            setAuthState('ok')
    })
  }, [storeId, doFetch])

  // Realtime via SSE
  useEffect(() => {
    if (authState !== 'ok') return
    const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
    let abort = new AbortController()
    let reconnectTimer: ReturnType<typeof setTimeout>

    const connect = async () => {
      try {
        const res = await fetch(`/api/caja/stream?storeId=${storeId}`, {
          headers: { 'x-cajero-pin': pin },
          signal: abort.signal,
        })
        if (!res.ok || !res.body) { reconnectTimer = setTimeout(connect, 4000); return }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const msg = JSON.parse(line.slice(6))
              if (msg.type === 'change') doFetch(pin)
            } catch { /* ignore */ }
          }
        }
        reconnectTimer = setTimeout(connect, 2000)
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== 'AbortError') reconnectTimer = setTimeout(connect, 4000)
      }
    }

    connect()
    pollRef.current = setInterval(() => doFetch(pin), 30000)

    return () => {
      abort.abort()
      clearTimeout(reconnectTimer)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [authState, storeId, doFetch])

  // BCV rate
  useEffect(() => {
    if (authState !== 'ok') return
    fetch(`/api/bcv-rate?store=${storeId}`)
      .then(r => r.json())
      .then(d => { const r = d.rate ?? d.rates?.USD; if (r > 0) setBcvRate(r) })
      .catch(() => {})
  }, [authState, storeId])

  // Focus PIN input
  useEffect(() => {
    if (authState === 'pin') setTimeout(() => pinRef.current?.focus(), 100)
  }, [authState])

  async function submitPin() {
    if (!pinInput.trim()) return
    setPinLoading(true)
    setPinError('')
    const result = await doFetch(pinInput.trim())
    if (result.ok) {
      sessionStorage.setItem(SESSION_KEY(storeId), pinInput.trim())
      setAuthState('ok')
    } else if (result.requiresPin) {
      setPinError('PIN incorrecto. Intentalo de nuevo.')
      setPinInput('')
      pinRef.current?.focus()
    }
    setPinLoading(false)
  }

  async function verifyPayment(orderId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
    setVerifying(prev => new Set(prev).add(orderId))
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cajero-pin': pin },
        body: JSON.stringify({ orderId, storeId, status: 'approved', verifiedBy: cajeraName }),
      })
      if (res.ok) {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, payment_status: 'approved', payment_verified_by: cajeraName } : o
        ))
      }
    } finally {
      setVerifying(prev => { const s = new Set(prev); s.delete(orderId); return s })
    }
  }

  // a kiosk call to charge on the point-of-sale terminal (not cash)
  const isPos = (o: Order) => /punto/i.test(o.payment_method ?? '')
  // ── Kiosk customers waiting to pay cash (or by card on the terminal) ──
  // Each one shows as a loud alert at the top (with a chime every few
  // seconds) until "Cobrado" marks its payment collected — which also tells
  // the kiosk, so it frees itself for the next customer
  const toCollect = orders.filter(o =>
    o.cash_call_at && o.payment_status !== 'approved' && o.status !== 'cancelled' && isToday(o.cash_call_at))
  // loud: someone waiting at a kiosk; quiet: online orders paid on the
  // point-of-sale terminal at pickup or on delivery
  const cashCalls = toCollect.filter(o => o.from_kiosk)
  const posToCollect = toCollect.filter(o => !o.from_kiosk)
  const calling = cashCalls.length > 0
  useEffect(() => {
    const unlock = () => {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      if (!audioRef.current) audioRef.current = new AC()
      audioRef.current.resume().then(() => setSoundOn(audioRef.current?.state === 'running')).catch(() => {})
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])
  useEffect(() => {
    if (!calling) return
    const ring = () => { const ctx = audioRef.current; if (ctx && ctx.state === 'running') chime(ctx) }
    ring()
    const t = setInterval(ring, 7000)
    return () => clearInterval(t)
  }, [calling, soundOn])

  async function collectCash(orderId: string) {
    const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
    setVerifying(prev => new Set(prev).add(orderId))
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cajero-pin': pin },
        body: JSON.stringify({ orderId, storeId, status: 'approved', verifiedBy: cajeraName }),
      })
      if (res.ok) {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, payment_status: 'approved', payment_verified_by: cajeraName } : o
        ))
      }
    } finally {
      setVerifying(prev => { const s = new Set(prev); s.delete(orderId); return s })
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY(storeId))
    sessionStorage.removeItem(SESSION_CAJERA(storeId))
    setCajeraName('')
    setPinInput('')
    setPinError('')
    setAuthState('pin')
  }

  // ── SCREENS ──
  if (authState === 'checking') return (
    <div className="cj-loading"><div className="cj-spinner" /></div>
  )

  if (authState === 'notfound') return (
    <div className="cj-loading">
      <div style={{ fontWeight: 700, fontSize: 16 }}>Caja no encontrada</div>
      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Verifica el link con el administrador</div>
    </div>
  )

  if (authState === 'error') return (
    <div className="cj-loading">
      <div style={{ fontWeight: 700, fontSize: 16, color: '#DC2626' }}>Error de conexion</div>
      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4, textAlign: 'center', maxWidth: 260 }}>
        No se pudo conectar con el servidor. Revisa la conexion y vuelve a intentar.
      </div>
      <button
        onClick={() => {
          setAuthState('checking')
          const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
          doFetch(pin).then(r => {
            if (r.ok) setAuthState('ok')
            else if (r.requiresPin) setAuthState('pin')
            else setAuthState('error')
          })
        }}
        style={{ marginTop: 16, background: '#7C3AED', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Reintentar
      </button>
    </div>
  )

  if (authState === 'pin') return (
    <div className="cj-pin-screen" onContextMenu={e => e.preventDefault()}>
      <div className="cj-pin-card">
        <div className="cj-pin-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
          </svg>
        </div>
        <h1 className="cj-pin-title">Caja — Acceso restringido</h1>
        <p className="cj-pin-sub">Ingresa el PIN proporcionado por el administrador</p>
        <input
          ref={pinRef}
          className="cj-pin-input"
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinError('') }}
          onKeyDown={e => e.key === 'Enter' && submitPin()}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {pinError && <div className="cj-pin-error">{pinError}</div>}
        <button className="cj-pin-btn" onClick={submitPin} disabled={pinLoading || !pinInput.trim()}>
          {pinLoading ? 'Verificando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )

  // ── MAIN APP ──
  const todayOrders = orders.filter(o => o.status !== 'cancelled' && isToday(o.created_at))

  const methodTotals = Object.values(
    todayOrders.reduce((acc, o) => {
      const info = getCurrencyInfo(o.payment_method)
      if (!acc[info.label]) acc[info.label] = { ...info, total: 0 }
      acc[info.label].total += Number(o.total)
      return acc
    }, {} as Record<string, { label: string; currency: string; symbol: string; total: number }>)
  )

  return (
    <div className="cj-root" onContextMenu={e => e.preventDefault()} style={{ userSelect: 'none' }}>

      {/* HEADER */}
      <header className="cj-header">
        <div className="cj-header-inner">
          <div>
            <div className="cj-header-title">Caja · {storeName}</div>
            <div className="cj-header-store">{cajeraName || 'Sin identificar'}</div>
          </div>
          <div className="cj-header-right">
            <div className="cj-update-time">
              {lastUpdate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button className="cj-logout-btn" onClick={logout} title="Cambiar cajera">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* KIOSK CASH CALLS */}
      {calling && (
        <div className="cj-cash-calls" role="alert">
          {cashCalls.map(o => (
            <div key={o.id} className="cj-cash-call">
              <div className="cj-cash-call-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
                  {isPos(o)
                    ? <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><rect x="8" y="5.5" width="8" height="5" rx="1" /><path d="M8.5 14h1M11.5 14h1M14.5 14h1M8.5 17h1M11.5 17h1M14.5 17h1" /></>
                    : <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>}
                </svg>
              </div>
              <div className="cj-cash-call-text">
                <div className="cj-cash-call-kicker">{isPos(o) ? 'Cobro con punto de venta en el kiosko' : 'Cobro en efectivo en el kiosko'}</div>
                <div className="cj-cash-call-name">
                  {o.customer_name}{o.order_number != null ? <span> · #{o.order_number}</span> : null}
                </div>
                {isPos(o) ? (
                  <div className="cj-cash-call-sub">
                    Lleva el punto de venta al kiosko y cobra <strong>{bcvRate > 0
                      ? `Bs ${(Number(o.total) * bcvRate).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `$${Number(o.total).toFixed(2)}`}</strong>{bcvRate > 0 ? ` ($${Number(o.total).toFixed(2)})` : ''}
                  </div>
                ) : (
                  <div className="cj-cash-call-sub">Ve al kiosko a cobrar <strong>${Number(o.total).toFixed(2)}</strong> y lleva el cambio</div>
                )}
              </div>
              <button className="cj-cash-call-btn" disabled={verifying.has(o.id)} onClick={() => collectCash(o.id)}>
                {verifying.has(o.id) ? '...' : 'Cobrado'}
              </button>
            </div>
          ))}
          {!soundOn && <div className="cj-cash-sound">Toca la pantalla una vez para activar el sonido de estas alertas</div>}
        </div>
      )}

      {/* ONLINE ORDERS TO CHARGE ON THE POINT-OF-SALE TERMINAL */}
      {posToCollect.length > 0 && (
        <div className="cj-pos-todo">
          <div className="cj-pos-todo-title">Por cobrar con punto de venta · {posToCollect.length}</div>
          {posToCollect.map(o => (
            <div key={o.id} className="cj-pos-todo-row">
              <div className="cj-pos-todo-text">
                <div className="cj-pos-todo-name">
                  {o.customer_name}{o.order_number != null ? <span> · #{o.order_number}</span> : null}
                </div>
                <div className="cj-pos-todo-sub">
                  <strong>{bcvRate > 0
                    ? `Bs ${(Number(o.total) * bcvRate).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${Number(o.total).toFixed(2)}`}</strong>{bcvRate > 0 ? ` ($${Number(o.total).toFixed(2)})` : ''}
                  {' · '}
                  {o.delivery_type === 'delivery' ? 'Delivery: que el repartidor lleve el punto de venta' : 'Viene a la caja a pagar · se confirma al cobrar'}
                </div>
              </div>
              <button className="cj-pos-todo-btn" disabled={verifying.has(o.id)} onClick={() => collectCash(o.id)}>
                {verifying.has(o.id) ? '...' : 'Cobrado'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ORDER LIST */}
      <div className="cj-view">
        <div className="cj-list-header">
          {todayOrders.length} pedido{todayOrders.length !== 1 ? 's' : ''} hoy
        </div>

        {methodTotals.length > 0 && (
          <div className="cj-totals">
            {methodTotals.map(m => {
              const isVES = m.currency === 'VES'
              const displayAmount = isVES
                ? bcvRate > 0
                  ? `Bs ${(m.total * bcvRate).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Bs ...'
                : `${m.symbol}${m.total.toFixed(2)}`
              return (
                <div key={m.label} className="cj-total-card">
                  <div className="cj-total-label">{m.label}</div>
                  <div className="cj-total-amount">{displayAmount}</div>
                </div>
              )
            })}
          </div>
        )}

        {todayOrders.length === 0 ? (
          <div className="cj-empty">
            <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="44" height="44">
              <rect x="6" y="10" width="36" height="28" rx="3"/>
              <path strokeLinecap="round" d="M14 20h20M14 26h12"/>
            </svg>
            <p>Sin pedidos hoy</p>
          </div>
        ) : (
          <div className="cj-proof-list">
            {todayOrders.map((order, idx) => {
              const info   = getCurrencyInfo(order.payment_method)
              const amount = Number(order.total)
              const isVES  = info.currency === 'VES'
              const displayAmount = isVES
                ? bcvRate > 0 ? `Bs ${(amount * bcvRate).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Bs ...'
                : `${info.symbol}${amount.toFixed(2)}`
              const hasProof = !!order.payment_proof_url
              const orderNum = todayOrders.length - idx
              return (
                <div
                  key={order.id}
                  className={`cj-card${hasProof ? ' cj-card--proof' : ''}`}
                  onClick={() => hasProof && setLightbox(order.payment_proof_url!)}
                >
                  <div className="cj-card-row">
                    <div className="cj-card-left">
                      <div className="cj-card-name">
                        <span className="cj-order-num">#{orderNum}</span>
                        {order.customer_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="cj-method-tag">{info.label}</span>
                        {order.customer_phone && (
                          <a
                            href={whatsappUrl(order.customer_phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cj-wa-btn"
                            onClick={e => e.stopPropagation()}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="21" height="21">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {hasProof && (
                        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ color: '#94A3B8', flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                        </svg>
                      )}
                      <div className="cj-card-amount-main">{displayAmount}</div>
                    </div>
                  </div>
                  <div className="cj-card-footer">
                    {order.payment_verified_by ? (
                      <div className="cj-verified-badge">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Verificado por {order.payment_verified_by}
                      </div>
                    ) : (
                      <button
                        className="cj-verify-btn"
                        disabled={verifying.has(order.id)}
                        onClick={e => verifyPayment(order.id, e)}
                      >
                        {verifying.has(order.id) ? 'Verificando...' : 'Verificar pago'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="cj-lightbox" onClick={() => setLightbox(null)}>
          <img
            src={lightbox}
            className="cj-lightbox-img"
            onClick={e => e.stopPropagation()}
            alt="Comprobante"
          />
          <button className="cj-lightbox-close" onClick={() => setLightbox(null)}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
