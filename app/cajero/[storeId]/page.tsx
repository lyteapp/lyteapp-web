'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import './cajero.css'

type PaymentStatus = 'pending' | 'approved' | 'rejected'
type Tab = 'comprobantes' | 'cierre'
type ProofFilter = 'pending' | 'approved' | 'rejected'

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
  'pago movil':      { label: 'Pago Movil',      currency: 'VES',  symbol: 'Bs' },
  'pago móvil':      { label: 'Pago Movil',      currency: 'VES',  symbol: 'Bs' },
  'efectivo bs':     { label: 'Efectivo Bs',     currency: 'VES',  symbol: 'Bs' },
  'transferencia':   { label: 'Transferencia',   currency: 'VES',  symbol: 'Bs' },
  'transferencia bs':{ label: 'Transferencia Bs',currency: 'VES',  symbol: 'Bs' },
  'punto de venta':  { label: 'Punto de Venta',  currency: 'VES',  symbol: 'Bs' },
  'punto_venta':     { label: 'Punto de Venta',  currency: 'VES',  symbol: 'Bs' },
  'zelle':           { label: 'Zelle',           currency: 'USD',  symbol: '$'  },
  'efectivo usd':    { label: 'Efectivo USD',    currency: 'USD',  symbol: '$'  },
  'efectivo':        { label: 'Efectivo USD',    currency: 'USD',  symbol: '$'  },
  'usdt':            { label: 'USDT',            currency: 'USDT', symbol: '₮'  },
  'binance':         { label: 'Binance Pay',     currency: 'USDT', symbol: '₮'  },
  'binance pay':     { label: 'Binance Pay',     currency: 'USDT', symbol: '₮'  },
}

function getCurrencyInfo(method: string | null) {
  if (!method) return { label: 'Otro', currency: 'USD', symbol: '$' }
  const key = method.toLowerCase().trim()
  return METHOD_CURRENCY[key] ?? { label: method, currency: 'USD', symbol: '$' }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function isToday(iso: string) {
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function CajeroPage() {
  const params  = useParams()
  const storeId = params.storeId as string

  const [storeName, setStoreName]   = useState('')
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [tab, setTab]               = useState<Tab>('comprobantes')
  const [proofFilter, setProofFilter] = useState<ProofFilter>('pending')
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const [verifying, setVerifying]   = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  const fetchOrders = useCallback(async () => {
    const res  = await fetch(`/api/caja?storeId=${storeId}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const json = await res.json()
    if (json.error) { setNotFound(true); setLoading(false); return }
    setStoreName(json.store.name ?? '')
    setOrders(json.orders)
    setLastUpdate(new Date())
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchOrders()
    pollRef.current = setInterval(fetchOrders, 6000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchOrders])

  async function setPaymentStatus(orderId: string, status: PaymentStatus) {
    setVerifying(orderId)
    const res = await fetch('/api/caja', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ orderId, status, storeId }),
    })
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: status } : o))
      showToast(status === 'approved' ? 'Pago aprobado' : status === 'rejected' ? 'Pago rechazado' : 'Revertido')
    }
    setVerifying(null)
  }

  // Derived
  const todayOrders  = orders.filter(o => isToday(o.created_at))
  const withProof    = todayOrders.filter(o => o.payment_proof_url)
  const pending      = withProof.filter(o => o.payment_status === 'pending')

  const filteredProofs = withProof.filter(o => {
    if (proofFilter === 'pending')  return o.payment_status === 'pending'
    if (proofFilter === 'approved') return o.payment_status === 'approved'
    return o.payment_status === 'rejected'
  })

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
  const approvedTotal = todayOrders.filter(o => o.payment_status === 'approved').reduce((s, o) => s + Number(o.total), 0)

  if (loading) return (
    <div className="cj-loading">
      <div className="cj-spinner" />
      <span>Cargando caja...</span>
    </div>
  )

  if (notFound) return (
    <div className="cj-loading">
      <div style={{ fontSize: 36, marginBottom: 12 }}>—</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Caja no encontrada</div>
      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Verifica el link con el administrador</div>
    </div>
  )

  return (
    <div className="cj-root">

      {/* ── HEADER ── */}
      <header className="cj-header">
        <div className="cj-header-inner">
          <div>
            <div className="cj-header-title">Caja</div>
            <div className="cj-header-store">{storeName}</div>
          </div>
          <div className="cj-header-right">
            {pending.length > 0 && (
              <div className="cj-pending-badge">{pending.length}</div>
            )}
            <div className="cj-update-time">
              {lastUpdate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </header>

      {/* ── TABS ── */}
      <nav className="cj-tabs">
        <button className={`cj-tab${tab === 'comprobantes' ? ' active' : ''}`} onClick={() => setTab('comprobantes')}>
          Comprobantes
          {pending.length > 0 && <span className="cj-tab-dot" />}
        </button>
        <button className={`cj-tab${tab === 'cierre' ? ' active' : ''}`} onClick={() => setTab('cierre')}>
          Cierre del dia
        </button>
      </nav>

      {/* ══════════════════════════════════
          COMPROBANTES
      ══════════════════════════════════ */}
      {tab === 'comprobantes' && (
        <div className="cj-view">

          {/* KPI strip */}
          <div className="cj-kpi-bar">
            <div className="cj-kpi">
              <div className="cj-kpi-num" style={{ color: pending.length > 0 ? '#D97706' : '#0F172A' }}>
                {pending.length}
              </div>
              <div className="cj-kpi-label">Pendientes</div>
            </div>
            <div className="cj-kpi">
              <div className="cj-kpi-num">{withProof.filter(o => o.payment_status === 'approved').length}</div>
              <div className="cj-kpi-label">Aprobados</div>
            </div>
            <div className="cj-kpi">
              <div className="cj-kpi-num">${approvedTotal.toFixed(2)}</div>
              <div className="cj-kpi-label">Monto aprobado</div>
            </div>
            <div className="cj-kpi">
              <div className="cj-kpi-num">{withProof.length}</div>
              <div className="cj-kpi-label">Con comprobante</div>
            </div>
          </div>

          {/* Filter pills */}
          <div className="cj-filter-bar">
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                className={`cj-filter-pill${proofFilter === f ? ' active' : ''}`}
                onClick={() => setProofFilter(f)}
              >
                {f === 'pending'  ? `Pendientes · ${pending.length}`
                 : f === 'approved' ? `Aprobados · ${withProof.filter(o => o.payment_status === 'approved').length}`
                 : `Rechazados · ${withProof.filter(o => o.payment_status === 'rejected').length}`}
              </button>
            ))}
          </div>

          {filteredProofs.length === 0 ? (
            <div className="cj-empty">
              <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="44" height="44">
                <rect x="6" y="10" width="36" height="28" rx="3"/>
                <path strokeLinecap="round" d="M14 20h20M14 26h12"/>
              </svg>
              <p>{proofFilter === 'pending' ? 'Sin comprobantes pendientes' : 'Sin registros'}</p>
            </div>
          ) : (
            <div className="cj-proof-list">
              {filteredProofs.map(order => {
                const isPending  = order.payment_status === 'pending'
                const isApproved = order.payment_status === 'approved'
                return (
                  <div key={order.id} className={`cj-proof-card${isApproved ? ' approved' : order.payment_status === 'rejected' ? ' rejected' : ''}`}>

                    {/* Left: proof photo */}
                    <div className="cj-proof-thumb-wrap" onClick={() => setLightbox(order.payment_proof_url!)}>
                      <img src={order.payment_proof_url!} alt="Comprobante" className="cj-proof-thumb" />
                      <div className="cj-proof-zoom">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path d="M5 8a3 3 0 116 0A3 3 0 015 8zm-2 8a7 7 0 0114 0H3z"/>
                        </svg>
                      </div>
                    </div>

                    {/* Right: info + actions */}
                    <div className="cj-proof-body">
                      <div className="cj-proof-name">{order.customer_name}</div>
                      <div className="cj-proof-detail">
                        <span className="cj-method-tag">{order.payment_method ?? '—'}</span>
                        <span className="cj-proof-amount">${Number(order.total).toFixed(2)}</span>
                      </div>
                      <div className="cj-proof-time">{fmtTime(order.created_at)} · {order.customer_phone}</div>

                      {isPending ? (
                        <div className="cj-proof-btns">
                          <button
                            className="cj-btn-approve"
                            disabled={verifying === order.id}
                            onClick={() => setPaymentStatus(order.id, 'approved')}
                          >
                            {verifying === order.id ? '...' : 'Aprobar'}
                          </button>
                          <button
                            className="cj-btn-reject"
                            disabled={verifying === order.id}
                            onClick={() => setPaymentStatus(order.id, 'rejected')}
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <div className="cj-proof-btns">
                          <span className={`cj-status-badge ${order.payment_status}`}>
                            {isApproved ? 'Aprobado' : 'Rechazado'}
                          </span>
                          <button
                            className="cj-btn-undo"
                            onClick={() => setPaymentStatus(order.id, 'pending')}
                          >
                            Revertir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          CIERRE DEL DIA
      ══════════════════════════════════ */}
      {tab === 'cierre' && (
        <div className="cj-view">

          <div className="cj-cierre-date">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {/* Currency summary cards */}
          <div className="cj-currency-grid">
            {currencyTotals.length === 0 ? (
              <div className="cj-empty" style={{ gridColumn: '1/-1' }}>
                <p>Sin movimientos hoy</p>
              </div>
            ) : currencyTotals.map(c => (
              <div key={c.currency} className="cj-currency-card">
                <div className="cj-currency-code">{c.currency}</div>
                <div className="cj-currency-amount">{c.symbol}{c.total.toFixed(2)}</div>
                <div className="cj-currency-sub">total del dia</div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="cj-stats-row">
            <div className="cj-stat">
              <div className="cj-stat-num">{todayOrders.filter(o => o.status !== 'cancelled').length}</div>
              <div className="cj-stat-lbl">Pedidos</div>
            </div>
            <div className="cj-stat">
              <div className="cj-stat-num">{todayOrders.filter(o => o.payment_status === 'approved').length}</div>
              <div className="cj-stat-lbl">Pagos verificados</div>
            </div>
            <div className="cj-stat">
              <div className="cj-stat-num">{pending.length}</div>
              <div className="cj-stat-lbl">Pendientes</div>
            </div>
          </div>

          {/* Method breakdown */}
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

          {/* Order list */}
          {todayOrders.length > 0 && (
            <div className="cj-breakdown">
              <div className="cj-breakdown-title">Pedidos del dia</div>
              {todayOrders.map(o => (
                <div key={o.id} className={`cj-order-row${o.status === 'cancelled' ? ' cancelled' : ''}`}>
                  <div className="cj-order-left">
                    <div className="cj-order-name">{o.customer_name}</div>
                    <div className="cj-order-meta">{fmtTime(o.created_at)} · {o.payment_method ?? '—'}</div>
                  </div>
                  <div className="cj-order-right">
                    {o.payment_proof_url && (
                      <button className="cj-thumb-btn" onClick={() => setLightbox(o.payment_proof_url!)}>
                        <img src={o.payment_proof_url} alt="" className="cj-thumb-img" />
                      </button>
                    )}
                    {o.payment_status && (
                      <span className={`cj-status-badge ${o.payment_status}`}>
                        {o.payment_status === 'approved' ? 'OK' : o.payment_status === 'rejected' ? '✕' : '...'}
                      </span>
                    )}
                    <span className="cj-order-total">${Number(o.total).toFixed(2)}</span>
                  </div>
                </div>
              ))}
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
          <img src={lightbox} alt="Comprobante" className="cj-lightbox-img" onClick={e => e.stopPropagation()} />
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
