'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './caja.css'

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
  'pago movil': { label: 'Pago Movil', currency: 'VES', symbol: 'Bs' },
  'pago móvil': { label: 'Pago Movil', currency: 'VES', symbol: 'Bs' },
  'transferencia': { label: 'Transferencia', currency: 'VES', symbol: 'Bs' },
  'transferencia bs': { label: 'Transferencia Bs', currency: 'VES', symbol: 'Bs' },
  'zelle': { label: 'Zelle', currency: 'USD', symbol: '$' },
  'efectivo usd': { label: 'Efectivo USD', currency: 'USD', symbol: '$' },
  'efectivo': { label: 'Efectivo USD', currency: 'USD', symbol: '$' },
  'cash': { label: 'Efectivo USD', currency: 'USD', symbol: '$' },
  'usdt': { label: 'USDT', currency: 'USDT', symbol: '₮' },
  'binance': { label: 'Binance Pay', currency: 'USDT', symbol: '₮' },
}

function getCurrencyInfo(method: string | null) {
  if (!method) return { label: method ?? 'Otro', currency: 'USD', symbol: '$' }
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

export default function CajaPage() {
  const { user } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [storeId, setStoreId]   = useState<string | null>(null)
  const [orders, setOrders]     = useState<Order[]>([])
  const [tab, setTab]           = useState<Tab>('comprobantes')
  const [proofFilter, setProofFilter] = useState<ProofFilter>('pending')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [toast, setToast]       = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const [showQr, setShowQr]     = useState(false)
  const [checkoutSettings, setCheckoutSettings] = useState<Record<string, unknown>>({})
  const [pinInput, setPinInput] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  const loadOrders = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_status,total,status,created_at,delivery_type')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(500)
    setOrders((data as Order[]) ?? [])
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id, checkout_settings').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setStoreId(data.id)
        loadOrders(data.id)
        const cs = (data.checkout_settings as Record<string, unknown>) ?? {}
        setCheckoutSettings(cs)
        setPinInput((cs.cajeroPIN as string) ?? '')
      }
      setLoading(false)
    })
  }, [user, loadOrders])

  useEffect(() => {
    if (!storeId) return
    const ch = supabase.channel(`caja-orders-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => loadOrders(storeId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, loadOrders])

  async function setPaymentStatus(orderId: string, status: PaymentStatus) {
    setVerifying(orderId)
    await supabase.from('orders').update({ payment_status: status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: status } : o))
    setVerifying(null)
    showToast(status === 'approved' ? 'Pago aprobado' : 'Pago rechazado')
  }

  // Derived data
  const todayOrders = orders.filter(o => isToday(o.created_at))
  const withProof   = todayOrders.filter(o => o.payment_proof_url)
  const pendingVerification = withProof.filter(o => o.payment_status === 'pending')

  const filteredProofs = withProof.filter(o => {
    if (proofFilter === 'pending')   return o.payment_status === 'pending'
    if (proofFilter === 'approved')  return o.payment_status === 'approved'
    if (proofFilter === 'rejected')  return o.payment_status === 'rejected'
    return true
  })

  // Cierre de caja — group by payment method
  const methodTotals = (() => {
    const map: Record<string, { label: string; currency: string; symbol: string; total: number; count: number }> = {}
    for (const o of todayOrders) {
      if (o.status === 'cancelled') continue
      const info = getCurrencyInfo(o.payment_method)
      const key  = info.label
      if (!map[key]) map[key] = { ...info, total: 0, count: 0 }
      map[key].total += Number(o.total)
      map[key].count += 1
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

  const todayTotal   = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
  const approvedTotal = todayOrders.filter(o => o.payment_status === 'approved').reduce((s, o) => s + Number(o.total), 0)

  const cajeroUrl = storeId ? `https://lyte-app.com/cajero/${storeId}` : ''

  async function savePin() {
    if (!storeId) return
    setPinSaving(true)
    const newCs = { ...checkoutSettings, cajeroPIN: pinInput.trim() }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setPinSaving(false)
    showToast(pinInput.trim() ? 'PIN guardado' : 'PIN eliminado')
  }

  function copyCajeroLink() {
    if (!cajeroUrl) return
    navigator.clipboard.writeText(cajeroUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
  }

  if (loading) return <div className="cx-spinner-wrap"><div className="cx-spinner" /></div>

  return (
    <div className="cx-root">

      {/* ── ACCESO CAJERO ── */}
      {storeId && (
        <div style={{
          margin: '14px 14px 0',
          background: 'white',
          border: '1.5px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            App de cajero
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>
            Comparte este link con tus cajeros. No requiere contrasena — guardalo solo con tu equipo.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '8px 10px',
              fontSize: 12, color: '#475569', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cajeroUrl}
            </div>
            <button
              onClick={copyCajeroLink}
              style={{
                flexShrink: 0, background: copied ? '#10B981' : '#7C3AED',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
              }}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={() => setShowQr(true)}
              title="Ver QR"
              style={{
                flexShrink: 0, background: '#F1F5F9', color: '#0F172A',
                border: '1px solid #E2E8F0', borderRadius: 8,
                padding: '8px 10px', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center',
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd"/>
                <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM15 13a1 1 0 10-2 0v3a1 1 0 102 0v-3zM11 19a1 1 0 110-2h2a1 1 0 110 2h-2z"/>
              </svg>
            </button>
            <a
              href={cajeroUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flexShrink: 0, background: '#F1F5F9', color: '#0F172A',
                border: '1px solid #E2E8F0', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, fontWeight: 500,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
              </svg>
              Abrir
            </a>
          </div>
        </div>
      )}

      {/* ── QR MODAL ── */}
      {showQr && cajeroUrl && (
        <div
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: '28px 28px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              maxWidth: 320, width: '100%',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>App de cajero</div>
            <QRCodeSVG value={cajeroUrl} size={220} bgColor="#ffffff" fgColor="#0F172A" />
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', wordBreak: 'break-all' }}>
              {cajeroUrl}
            </div>
            <button
              onClick={() => setShowQr(false)}
              style={{
                width: '100%', background: '#F1F5F9', color: '#0F172A', border: 'none',
                borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── PIN DE ACCESO ── */}
      {storeId && (
        <div style={{
          margin: '10px 14px 0',
          background: 'white',
          border: '1.5px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            PIN de acceso a caja
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>
            Protege la app de cajero con un PIN numerico. Dejalo en blanco para acceso sin PIN.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Sin PIN (acceso libre)"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              style={{
                flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 8,
                padding: '8px 12px', fontSize: 14, outline: 'none',
                fontFamily: 'inherit', color: '#0F172A', background: '#F8FAFC',
              }}
            />
            <button
              onClick={savePin}
              disabled={pinSaving}
              style={{
                flexShrink: 0, background: '#7C3AED', color: 'white',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', opacity: pinSaving ? 0.6 : 1,
              }}
            >
              {pinSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <nav className="cx-tabs">
        <button className={`cx-tab${tab === 'comprobantes' ? ' active' : ''}`} onClick={() => setTab('comprobantes')}>
          Comprobantes
          {pendingVerification.length > 0 && (
            <span className="cx-tab-badge">{pendingVerification.length}</span>
          )}
        </button>
        <button className={`cx-tab${tab === 'cierre' ? ' active' : ''}`} onClick={() => setTab('cierre')}>
          Cierre de caja
        </button>
      </nav>

      {/* ══════════════════════════════════
          COMPROBANTES
      ══════════════════════════════════ */}
      {tab === 'comprobantes' && (
        <div className="cx-view">

          {/* KPI strip */}
          <div className="cx-kpi-bar">
            <div className="cx-kpi">
              <div className="cx-kpi-label">Pendientes</div>
              <div className="cx-kpi-num" style={{ color: pendingVerification.length > 0 ? '#D97706' : undefined }}>
                {pendingVerification.length}
              </div>
            </div>
            <div className="cx-kpi">
              <div className="cx-kpi-label">Verificados hoy</div>
              <div className="cx-kpi-num">{withProof.filter(o => o.payment_status === 'approved').length}</div>
            </div>
            <div className="cx-kpi">
              <div className="cx-kpi-label">Monto aprobado</div>
              <div className="cx-kpi-num">${approvedTotal.toFixed(2)}</div>
            </div>
            <div className="cx-kpi">
              <div className="cx-kpi-label">Con comprobante hoy</div>
              <div className="cx-kpi-num">{withProof.length}</div>
            </div>
          </div>

          {/* Filter pills */}
          <div className="cx-filter-bar">
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                className={`cx-filter-pill${proofFilter === f ? ' active' : ''}`}
                onClick={() => setProofFilter(f)}
              >
                {f === 'pending' ? `Pendientes · ${pendingVerification.length}`
                 : f === 'approved' ? `Aprobados · ${withProof.filter(o => o.payment_status === 'approved').length}`
                 : `Rechazados · ${withProof.filter(o => o.payment_status === 'rejected').length}`}
              </button>
            ))}
          </div>

          {/* Cards */}
          {filteredProofs.length === 0 ? (
            <div className="cx-empty">
              <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="44" height="44">
                <rect x="6" y="10" width="36" height="28" rx="3"/>
                <path strokeLinecap="round" d="M14 20h20M14 26h12"/>
              </svg>
              <p>{proofFilter === 'pending' ? 'Sin comprobantes pendientes' : 'Sin registros'}</p>
            </div>
          ) : (
            <div className="cx-proof-grid">
              {filteredProofs.map(order => {
                const isPending  = order.payment_status === 'pending'
                const isApproved = order.payment_status === 'approved'
                return (
                  <div key={order.id} className={`cx-proof-card${isApproved ? ' approved' : order.payment_status === 'rejected' ? ' rejected' : ''}`}>
                    {/* Status ribbon */}
                    {!isPending && (
                      <div className={`cx-ribbon ${order.payment_status}`}>
                        {isApproved ? 'Aprobado' : 'Rechazado'}
                      </div>
                    )}

                    {/* Proof photo */}
                    <div className="cx-proof-img-wrap" onClick={() => setLightbox(order.payment_proof_url!)}>
                      <img src={order.payment_proof_url!} alt="Comprobante" className="cx-proof-img" />
                      <div className="cx-proof-zoom-hint">Ver</div>
                    </div>

                    {/* Info */}
                    <div className="cx-proof-info">
                      <div className="cx-proof-name">{order.customer_name}</div>
                      <div className="cx-proof-meta">
                        <span className="cx-method-chip">{order.payment_method ?? '—'}</span>
                        <span className="cx-proof-amount">${Number(order.total).toFixed(2)}</span>
                      </div>
                      <div className="cx-proof-time">{fmtTime(order.created_at)} · {order.customer_phone}</div>
                    </div>

                    {/* Actions */}
                    {isPending && (
                      <div className="cx-proof-actions">
                        <button
                          className="cx-btn-approve"
                          disabled={verifying === order.id}
                          onClick={() => setPaymentStatus(order.id, 'approved')}
                        >
                          {verifying === order.id ? '...' : 'Aprobar'}
                        </button>
                        <button
                          className="cx-btn-reject"
                          disabled={verifying === order.id}
                          onClick={() => setPaymentStatus(order.id, 'rejected')}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                    {!isPending && (
                      <button
                        className="cx-btn-undo"
                        onClick={() => setPaymentStatus(order.id, 'pending')}
                      >
                        Revertir
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          CIERRE DE CAJA
      ══════════════════════════════════ */}
      {tab === 'cierre' && (
        <div className="cx-view cx-cierre-view">

          <div className="cx-cierre-date">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Currency summary cards */}
          <div className="cx-currency-grid">
            {currencyTotals.length === 0 ? (
              <div className="cx-empty" style={{ gridColumn: '1/-1' }}>
                <p>Sin movimientos hoy</p>
              </div>
            ) : currencyTotals.map(c => (
              <div key={c.currency} className="cx-currency-card">
                <div className="cx-currency-label">{c.currency}</div>
                <div className="cx-currency-amount">{c.symbol}{c.total.toFixed(2)}</div>
                <div className="cx-currency-sub">total del dia</div>
              </div>
            ))}
          </div>

          {/* Method breakdown */}
          <div className="cx-breakdown-section">
            <div className="cx-breakdown-title">Desglose por metodo</div>
            {methodTotals.length === 0 ? (
              <div className="cx-empty"><p>Sin pedidos hoy</p></div>
            ) : (
              <table className="cx-breakdown-table">
                <thead>
                  <tr>
                    <th>Metodo</th>
                    <th>Moneda</th>
                    <th>Pedidos</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {methodTotals.map(m => (
                    <tr key={m.label}>
                      <td style={{ fontWeight: 500 }}>{m.label}</td>
                      <td><span className="cx-currency-chip">{m.currency}</span></td>
                      <td>{m.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.symbol}{m.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 700, paddingTop: 12 }}>Total general</td>
                    <td style={{ fontWeight: 700, paddingTop: 12 }}>{todayOrders.filter(o => o.status !== 'cancelled').length}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: 12, fontSize: 15 }}>${todayTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Order list */}
          <div className="cx-breakdown-section">
            <div className="cx-breakdown-title">Pedidos del dia</div>
            {todayOrders.length === 0 ? (
              <div className="cx-empty"><p>Sin pedidos hoy</p></div>
            ) : (
              <table className="cx-breakdown-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Metodo</th>
                    <th>Comprobante</th>
                    <th>Estado pago</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {todayOrders.map(o => (
                    <tr key={o.id} style={{ opacity: o.status === 'cancelled' ? 0.45 : 1 }}>
                      <td style={{ fontWeight: 500 }}>{o.customer_name}</td>
                      <td>{o.payment_method ?? '—'}</td>
                      <td>
                        {o.payment_proof_url
                          ? <button className="cx-proof-thumb-btn" onClick={() => setLightbox(o.payment_proof_url!)}>
                              <img src={o.payment_proof_url} alt="" className="cx-proof-thumb" />
                            </button>
                          : <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        {o.payment_status === 'approved'
                          ? <span className="cx-status-chip approved">Aprobado</span>
                          : o.payment_status === 'rejected'
                          ? <span className="cx-status-chip rejected">Rechazado</span>
                          : o.payment_status === 'pending'
                          ? <span className="cx-status-chip pending">Pendiente</span>
                          : <span className="cx-status-chip none">—</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(o.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="cx-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Comprobante" className="cx-lightbox-img" onClick={e => e.stopPropagation()} />
          <button className="cx-lightbox-close" onClick={() => setLightbox(null)}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="cx-toast">
          <span className="cx-toast-check">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </span>
          {toast}
        </div>
      )}
    </div>
  )
}
