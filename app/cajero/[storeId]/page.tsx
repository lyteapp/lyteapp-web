'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import './cajero.css'

type PaymentStatus = 'pending' | 'approved' | 'rejected'
type Tab = 'comprobantes' | 'cierre'
type ProofFilter = 'new' | 'waiting' | 'approved' | 'rejected' | 'all'

type Order = {
  id: string
  customer_name: string
  customer_phone: string
  payment_method: string | null
  payment_proof_url: string | null
  payment_status: PaymentStatus | null
  total: number
  status: string
  created_at: string
  delivery_type: string | null
}

const METHOD_CURRENCY: Record<string, { label: string; currency: string; symbol: string }> = {
  'pago movil':       { label: 'Pago Movil',       currency: 'VES',  symbol: 'Bs' },
  'pago móvil':       { label: 'Pago Movil',       currency: 'VES',  symbol: 'Bs' },
  'efectivo bs':      { label: 'Efectivo Bs',      currency: 'VES',  symbol: 'Bs' },
  'transferencia':    { label: 'Transferencia',    currency: 'VES',  symbol: 'Bs' },
  'transferencia bs': { label: 'Transferencia Bs', currency: 'VES',  symbol: 'Bs' },
  'punto de venta':   { label: 'Punto de Venta',   currency: 'VES',  symbol: 'Bs' },
  'punto_venta':      { label: 'Punto de Venta',   currency: 'VES',  symbol: 'Bs' },
  'zelle':            { label: 'Zelle',            currency: 'USD',  symbol: '$'  },
  'efectivo usd':     { label: 'Efectivo USD',     currency: 'USD',  symbol: '$'  },
  'efectivo':         { label: 'Efectivo USD',     currency: 'USD',  symbol: '$'  },
  'usdt':             { label: 'USDT',             currency: 'USDT', symbol: '₮'  },
  'binance':          { label: 'Binance Pay',      currency: 'USDT', symbol: '₮'  },
  'binance pay':      { label: 'Binance Pay',      currency: 'USDT', symbol: '₮'  },
}

function getCurrencyInfo(method: string | null) {
  if (!method) return { label: 'Otro', currency: 'USD', symbol: '$' }
  const key = method.toLowerCase().trim()
  return METHOD_CURRENCY[key] ?? { label: method, currency: 'USD', symbol: '$' }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const n = new Date()
  const isToday = d.toDateString() === n.toDateString()
  if (isToday) return fmtTime(iso)
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(iso)
}

function isToday(iso: string) {
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function fmtBs(amount: number, rate: number) {
  return (amount * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [storeName, setStoreName]     = useState('')
  const [cajeraName, setCajeraName]   = useState('')
  const [orders, setOrders]           = useState<Order[]>([])
  const [bcvRate, setBcvRate]         = useState<number | null>(null)
  const [tab, setTab]                 = useState<Tab>('comprobantes')
  const [proofFilter, setProofFilter] = useState<ProofFilter>('new')
  const [lightbox, setLightbox]       = useState<string | null>(null)
  const [verifying, setVerifying]     = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const [lastUpdate, setLastUpdate]   = useState<Date>(new Date())
  const [newCount, setNewCount]       = useState(0)
  const prevPendingRef = useRef<Set<string>>(new Set())
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  const doFetch = useCallback(async (pin: string): Promise<{ ok: boolean; requiresPin?: boolean; notFound?: boolean; error?: boolean }> => {
    try {
      const res = await fetch(`/api/caja?storeId=${storeId}`, {
        headers: { 'x-cajero-pin': pin },
      })
      if (res.status === 404) return { ok: false, notFound: true }
      if (res.status === 401) return { ok: false, requiresPin: true }
      if (!res.ok) return { ok: false, error: true }
      const json = await res.json()
      setStoreName(json.store?.name ?? '')
      if (json.cajera?.name) setCajeraName(json.cajera.name)

      const incoming: Order[] = json.orders ?? []
      setOrders(incoming)
      setLastUpdate(new Date())

      // Detect new orders since last poll
      const currentIds = new Set(incoming.filter(o => o.status !== 'cancelled').map(o => o.id))
      const newOnes = [...currentIds].filter(id => !prevPendingRef.current.has(id))
      if (newOnes.length > 0 && prevPendingRef.current.size > 0) {
        setNewCount(n => n + newOnes.length)
        setTimeout(() => setNewCount(0), 4000)
      }
      prevPendingRef.current = currentIds

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

  // Polling
  useEffect(() => {
    if (authState !== 'ok') return
    const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
    pollRef.current = setInterval(() => doFetch(pin), 6000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [authState, storeId, doFetch])

  // BCV rate
  useEffect(() => {
    fetch('/api/bcv-rate').then(r => r.json()).then(d => {
      setBcvRate(d?.rates?.USD ?? null)
    }).catch(() => {})
  }, [])

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

  function logout() {
    sessionStorage.removeItem(SESSION_KEY(storeId))
    sessionStorage.removeItem(SESSION_CAJERA(storeId))
    setCajeraName('')
    setPinInput('')
    setPinError('')
    setAuthState('pin')
  }

  async function setPaymentStatus(orderId: string, status: PaymentStatus) {
    setVerifying(orderId)
    const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''
    const res = await fetch('/api/caja', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-cajero-pin': pin },
      body:    JSON.stringify({ orderId, status, storeId }),
    })
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: status } : o))
      showToast(status === 'approved' ? 'Pago aprobado' : status === 'rejected' ? 'Pago rechazado' : 'Revertido')
    } else if (res.status === 401) {
      setAuthState('pin')
      sessionStorage.removeItem(SESSION_KEY(storeId))
    }
    setVerifying(null)
  }

  // ── PIN / LOADING SCREENS ──
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
        onClick={() => { setAuthState('checking'); const pin = sessionStorage.getItem(SESSION_KEY(storeId)) ?? ''; doFetch(pin).then(r => { if (r.ok) setAuthState('ok'); else if (r.requiresPin) setAuthState('pin'); else setAuthState('error') }) }}
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
  const allActive     = orders.filter(o => o.status !== 'cancelled')
  const todayOrders   = allActive.filter(o => isToday(o.created_at))
  const todayProofs   = todayOrders.filter(o => o.payment_proof_url)
  const waitingProof  = allActive.filter(o => o.payment_proof_url && o.payment_status === 'pending')
  const noProof       = allActive.filter(o => !o.payment_proof_url)

  const filteredOrders = (() => {
    // Default: all active orders most recent first
    if (proofFilter === 'new')      return allActive
    if (proofFilter === 'waiting')  return waitingProof
    if (proofFilter === 'approved') return allActive.filter(o => o.payment_status === 'approved')
    if (proofFilter === 'rejected') return allActive.filter(o => o.payment_status === 'rejected')
    return allActive
  })()

  const methodTotals = (() => {
    const map: Record<string, { label: string; currency: string; symbol: string; total: number; count: number }> = {}
    for (const o of todayOrders) {
      if (o.status === 'cancelled') continue
      const info = getCurrencyInfo(o.payment_method)
      if (!map[info.label]) map[info.label] = { ...info, total: 0, count: 0 }
      map[info.label].total += Number(o.total)
      map[info.label].count += 1
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const currencyTotals = (() => {
    const map: Record<string, { currency: string; symbol: string; total: number }> = {}
    for (const m of methodTotals) {
      if (!map[m.currency]) map[m.currency] = { currency: m.currency, symbol: m.symbol, total: 0 }
      map[m.currency].total += m.total
    }
    return Object.values(map)
  })()

  const todayTotal    = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
  const approvedTotal = todayProofs.filter(o => o.payment_status === 'approved').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="cj-root" onContextMenu={e => e.preventDefault()} style={{ userSelect: 'none' }}>

      {/* ── HEADER ── */}
      <header className="cj-header">
        <div className="cj-header-inner">
          <div>
            <div className="cj-header-title">Caja · {storeName}</div>
            <div className="cj-header-store">{cajeraName || 'Sin identificar'}</div>
          </div>
          <div className="cj-header-right">
            {waitingProof.length > 0 && <div className="cj-pending-badge">{waitingProof.length}</div>}
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

      {/* ── TABS ── */}
      <nav className="cj-tabs">
        <button className={`cj-tab${tab === 'comprobantes' ? ' active' : ''}`} onClick={() => setTab('comprobantes')}>
          Comprobantes
          {waitingProof.length > 0 && <span className="cj-tab-dot" />}
        </button>
        <button className={`cj-tab${tab === 'cierre' ? ' active' : ''}`} onClick={() => setTab('cierre')}>
          Cierre del dia
        </button>
      </nav>

      {/* ── NEW PROOF BANNER ── */}
      {newCount > 0 && (
        <div className="cj-new-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
          </svg>
          {newCount} nuevo{newCount > 1 ? 's' : ''} comprobante{newCount > 1 ? 's' : ''}
        </div>
      )}

      {/* ══ COMPROBANTES ══ */}
      {tab === 'comprobantes' && (
        <div className="cj-view">

          {/* KPIs */}
          <div className="cj-kpi-bar">
            <div className="cj-kpi">
              <div className="cj-kpi-num">{todayOrders.length}</div>
              <div className="cj-kpi-label">Pedidos hoy</div>
            </div>
            <div className="cj-kpi">
              <div className="cj-kpi-num" style={{ color: waitingProof.length > 0 ? '#7C3AED' : '#0F172A' }}>{waitingProof.length}</div>
              <div className="cj-kpi-label">Por verificar</div>
            </div>
            <div className="cj-kpi">
              <div className="cj-kpi-num">{todayProofs.filter(o => o.payment_status === 'approved').length}</div>
              <div className="cj-kpi-label">Aprobados hoy</div>
            </div>
            <div className="cj-kpi">
              <div className="cj-kpi-num">${approvedTotal.toFixed(2)}</div>
              <div className="cj-kpi-label">Monto aprobado</div>
            </div>
          </div>

          {/* Filters */}
          <div className="cj-filter-bar">
            <button className={`cj-filter-pill${proofFilter === 'new'      ? ' active' : ''}`} onClick={() => setProofFilter('new')}>
              Todos · {allActive.length}
            </button>
            <button className={`cj-filter-pill${proofFilter === 'waiting'  ? ' active' : ''}`} onClick={() => setProofFilter('waiting')}>
              Por verificar · {waitingProof.length}
            </button>
            <button className={`cj-filter-pill${proofFilter === 'approved' ? ' active' : ''}`} onClick={() => setProofFilter('approved')}>
              Aprobados · {allActive.filter(o => o.payment_status === 'approved').length}
            </button>
            <button className={`cj-filter-pill${proofFilter === 'rejected' ? ' active' : ''}`} onClick={() => setProofFilter('rejected')}>
              Rechazados · {allActive.filter(o => o.payment_status === 'rejected').length}
            </button>
          </div>

          {/* Cards */}
          {filteredOrders.length === 0 ? (
            <div className="cj-empty">
              <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="44" height="44">
                <rect x="6" y="10" width="36" height="28" rx="3"/>
                <path strokeLinecap="round" d="M14 20h20M14 26h12"/>
              </svg>
              <p>{proofFilter === 'waiting' ? 'Sin comprobantes pendientes' : 'Sin pedidos'}</p>
            </div>
          ) : (
            <div className="cj-proof-list">
              {filteredOrders.map(order => {
                const info       = getCurrencyInfo(order.payment_method)
                const hasProof   = Boolean(order.payment_proof_url)
                const isPending  = order.payment_status === 'pending'
                const isApproved = order.payment_status === 'approved'
                const isVES      = info.currency === 'VES'
                const amount     = Number(order.total)
                return (
                  <div key={order.id} className={`cj-card${isApproved ? ' approved' : order.payment_status === 'rejected' ? ' rejected' : ''}`}>

                    {/* Status stripe */}
                    {!isPending && order.payment_status && (
                      <div className={`cj-card-stripe ${order.payment_status}`}>
                        {isApproved ? 'Aprobado' : 'Rechazado'}
                      </div>
                    )}

                    {/* Proof image or waiting placeholder */}
                    {hasProof ? (
                      <div className="cj-card-img-wrap" onClick={() => setLightbox(order.payment_proof_url!)}>
                        <img src={order.payment_proof_url!} alt="Comprobante" className="cj-card-img" draggable={false} />
                        <div className="cj-card-img-overlay">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path d="M5 8a1 1 0 011-1h1V6a1 1 0 012 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9H6a1 1 0 01-1-1z"/>
                            <path fillRule="evenodd" d="M2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8zm6-4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd"/>
                          </svg>
                          Ampliar
                        </div>
                      </div>
                    ) : (
                      <div className="cj-card-waiting">
                        <div className="cj-waiting-pulse" />
                        <span>Esperando comprobante de pago...</span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="cj-card-body">
                      <div className="cj-card-customer">
                        <div className="cj-card-name">{order.customer_name}</div>
                        <div className="cj-card-phone">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style={{ flexShrink: 0 }}>
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                          </svg>
                          {order.customer_phone}
                        </div>
                      </div>

                      <div className="cj-card-meta">
                        <span className="cj-method-tag">{info.label}</span>
                        {order.delivery_type && (
                          <span className="cj-delivery-tag">
                            {order.delivery_type === 'pickup' ? 'Retiro' : 'Delivery'}
                          </span>
                        )}
                        <span className="cj-card-time">{fmtDate(order.created_at)}</span>
                      </div>

                      <div className="cj-card-amounts">
                        <div className="cj-card-amount-main">{info.symbol}{amount.toFixed(2)}</div>
                        {bcvRate && !isVES && (
                          <div className="cj-card-amount-bs">Bs {fmtBs(amount, bcvRate)}</div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="cj-card-actions">
                      {hasProof && isPending ? (
                        <>
                          <button className="cj-btn-approve" disabled={verifying === order.id} onClick={() => setPaymentStatus(order.id, 'approved')}>
                            {verifying === order.id ? '...' : 'Aprobar pago'}
                          </button>
                          <button className="cj-btn-reject" disabled={verifying === order.id} onClick={() => setPaymentStatus(order.id, 'rejected')}>
                            Rechazar
                          </button>
                        </>
                      ) : !hasProof ? (
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>Sin acciones — esperando comprobante</span>
                      ) : (
                        <>
                          <span className={`cj-status-badge ${order.payment_status}`}>
                            {isApproved ? 'Aprobado' : 'Rechazado'}
                          </span>
                          <button className="cj-btn-undo" onClick={() => setPaymentStatus(order.id, 'pending')}>
                            Revertir
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ CIERRE ══ */}
      {tab === 'cierre' && (
        <div className="cj-view">
          <div className="cj-cierre-date">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className="cj-currency-grid">
            {currencyTotals.length === 0 ? (
              <div className="cj-empty" style={{ gridColumn: '1/-1' }}><p>Sin movimientos hoy</p></div>
            ) : currencyTotals.map(c => (
              <div key={c.currency} className="cj-currency-card">
                <div className="cj-currency-code">{c.currency}</div>
                <div className="cj-currency-amount">{c.symbol}{c.total.toFixed(2)}</div>
                <div className="cj-currency-sub">total del dia</div>
              </div>
            ))}
          </div>
          <div className="cj-stats-row">
            <div className="cj-stat">
              <div className="cj-stat-num">{todayOrders.filter(o => o.status !== 'cancelled').length}</div>
              <div className="cj-stat-lbl">Pedidos</div>
            </div>
            <div className="cj-stat">
              <div className="cj-stat-num">{todayProofs.filter(o => o.payment_status === 'approved').length}</div>
              <div className="cj-stat-lbl">Verificados</div>
            </div>
            <div className="cj-stat">
              <div className="cj-stat-num">{noProof.length}</div>
              <div className="cj-stat-lbl">Sin comprobante</div>
            </div>
          </div>
          {methodTotals.length > 0 && (
            <div className="cj-breakdown">
              <div className="cj-breakdown-title">Por metodo de pago</div>
              {methodTotals.map(m => (
                <div key={m.label} className="cj-breakdown-row">
                  <div className="cj-breakdown-left">
                    <span className="cj-method-tag">{m.label}</span>
                    <span className="cj-breakdown-count">{m.count} {m.count === 1 ? 'pedido' : 'pedidos'}</span>
                  </div>
                  <div className="cj-breakdown-amount">{m.symbol}{m.total.toFixed(2)}</div>
                </div>
              ))}
              <div className="cj-breakdown-total">
                <span>Total general</span>
                <span>${todayTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
          {todayOrders.length > 0 && (
            <div className="cj-breakdown">
              <div className="cj-breakdown-title">Pedidos del dia</div>
              {todayOrders.map(o => {
                const info = getCurrencyInfo(o.payment_method)
                return (
                  <div key={o.id} className={`cj-order-row${o.status === 'cancelled' ? ' cancelled' : ''}`}>
                    <div className="cj-order-left">
                      <div className="cj-order-name">{o.customer_name}</div>
                      <div className="cj-order-meta">{fmtTime(o.created_at)} · {info.label}</div>
                    </div>
                    <div className="cj-order-right">
                      {o.payment_proof_url && (
                        <button className="cj-thumb-btn" onClick={() => setLightbox(o.payment_proof_url!)}>
                          <img src={o.payment_proof_url} alt="" className="cj-thumb-img" draggable={false} />
                        </button>
                      )}
                      {o.payment_status && (
                        <span className={`cj-status-badge ${o.payment_status}`}>
                          {o.payment_status === 'approved' ? 'OK' : o.payment_status === 'rejected' ? '✕' : '...'}
                        </span>
                      )}
                      <span className="cj-order-total">{info.symbol}{Number(o.total).toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="cj-lightbox" onClick={() => setLightbox(null)}>
          <button className="cj-lightbox-close" onClick={() => setLightbox(null)}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
          <img src={lightbox} alt="Comprobante" className="cj-lightbox-img" onClick={e => e.stopPropagation()} draggable={false} />
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="cj-toast">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
          {toast}
        </div>
      )}
    </div>
  )
}
