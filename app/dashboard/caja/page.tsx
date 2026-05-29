'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './caja.css'

type PaymentStatus = 'pending' | 'approved' | 'rejected'
type Tab = 'comprobantes' | 'config'
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function isToday(iso: string) {
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function CajaPage() {
  const { user } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [storeId, setStoreId]     = useState<string | null>(null)
  const [orders, setOrders]       = useState<Order[]>([])
  const [tab, setTab]             = useState<Tab>('comprobantes')
  const [proofFilter, setProofFilter] = useState<ProofFilter>('pending')
  const [lightbox, setLightbox]   = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [toast, setToast]         = useState<string | null>(null)
  // Config state
  const [checkoutSettings, setCheckoutSettings] = useState<Record<string, unknown>>({})
  const [cajeras, setCajeras]     = useState<{ id: string; name: string; pin: string }[]>([])
  const [newName, setNewName]     = useState('')
  const [newPin, setNewPin]       = useState('')
  const [cajerasSaving, setCajerasSaving] = useState(false)
  const [copied, setCopied]       = useState(false)
  const [showQr, setShowQr]       = useState(false)
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
        setCajeras((cs.cajeros as { id: string; name: string; pin: string }[]) ?? [])
      }
      setLoading(false)
    })
  }, [user, loadOrders])

  useEffect(() => {
    if (!storeId) return
    const ch = supabase.channel(`caja-dash-${storeId}`)
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
    showToast(status === 'approved' ? 'Pago aprobado' : status === 'rejected' ? 'Pago rechazado' : 'Revertido')
  }

  async function addCajera() {
    if (!storeId || !newName.trim() || !newPin.trim()) return
    setCajerasSaving(true)
    const next = [...cajeras, { id: crypto.randomUUID(), name: newName.trim(), pin: newPin.trim() }]
    const newCs = { ...checkoutSettings, cajeros: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setCajeras(next)
    setNewName('')
    setNewPin('')
    setCajerasSaving(false)
    showToast('Cajera agregada')
  }

  async function removeCajera(id: string) {
    if (!storeId) return
    const next = cajeras.filter(c => c.id !== id)
    const newCs = { ...checkoutSettings, cajeros: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setCajeras(next)
    showToast('Cajera eliminada')
  }

  function copyCajeroLink() {
    if (!cajeroUrl) return
    navigator.clipboard.writeText(cajeroUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
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

  const approvedTotal = todayOrders.filter(o => o.payment_status === 'approved').reduce((s, o) => s + Number(o.total), 0)
  const cajeroUrl     = storeId ? `https://lyte-app.com/cajero/${storeId}` : ''

  if (loading) return <div className="cx-spinner-wrap"><div className="cx-spinner" /></div>

  return (
    <div className="cx-root">

      {/* ── TABS ── */}
      <nav className="cx-tabs">
        <button className={`cx-tab${tab === 'comprobantes' ? ' active' : ''}`} onClick={() => setTab('comprobantes')}>
          Comprobantes
          {pending.length > 0 && <span className="cx-tab-badge">{pending.length}</span>}
        </button>
        <button className={`cx-tab${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>
          Configuracion
        </button>
      </nav>

      {/* ══ COMPROBANTES ══ */}
      {tab === 'comprobantes' && (
        <div className="cx-view">
          <div className="cx-kpi-bar">
            <div className="cx-kpi">
              <div className="cx-kpi-label">Pendientes</div>
              <div className="cx-kpi-num" style={{ color: pending.length > 0 ? '#D97706' : undefined }}>{pending.length}</div>
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
              <div className="cx-kpi-label">Con comprobante</div>
              <div className="cx-kpi-num">{withProof.length}</div>
            </div>
          </div>

          <div className="cx-filter-bar">
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} className={`cx-filter-pill${proofFilter === f ? ' active' : ''}`} onClick={() => setProofFilter(f)}>
                {f === 'pending'   ? `Pendientes · ${pending.length}`
                 : f === 'approved' ? `Aprobados · ${withProof.filter(o => o.payment_status === 'approved').length}`
                 : `Rechazados · ${withProof.filter(o => o.payment_status === 'rejected').length}`}
              </button>
            ))}
          </div>

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
                    {!isPending && (
                      <div className={`cx-ribbon ${order.payment_status}`}>
                        {isApproved ? 'Aprobado' : 'Rechazado'}
                      </div>
                    )}
                    <div className="cx-proof-img-wrap" onClick={() => setLightbox(order.payment_proof_url!)}>
                      <img src={order.payment_proof_url!} alt="Comprobante" className="cx-proof-img" />
                      <div className="cx-proof-zoom-hint">Ver</div>
                    </div>
                    <div className="cx-proof-info">
                      <div className="cx-proof-name">{order.customer_name}</div>
                      <div className="cx-proof-meta">
                        <span className="cx-method-chip">{order.payment_method ?? '—'}</span>
                        <span className="cx-proof-amount">${Number(order.total).toFixed(2)}</span>
                      </div>
                      <div className="cx-proof-time">{fmtTime(order.created_at)} · {order.customer_phone}</div>
                    </div>
                    {isPending ? (
                      <div className="cx-proof-actions">
                        <button className="cx-btn-approve" disabled={verifying === order.id} onClick={() => setPaymentStatus(order.id, 'approved')}>
                          {verifying === order.id ? '...' : 'Aprobar'}
                        </button>
                        <button className="cx-btn-reject" disabled={verifying === order.id} onClick={() => setPaymentStatus(order.id, 'rejected')}>
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <button className="cx-btn-undo" onClick={() => setPaymentStatus(order.id, 'pending')}>
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

      {/* ══ CONFIGURACION ══ */}
      {tab === 'config' && (
        <div className="cx-view cx-cierre-view">

          {/* Link */}
          <div className="cx-breakdown-section">
            <div className="cx-breakdown-title">Link de acceso para cajeros</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              Comparte este link con tus cajeros o escanea el QR desde el dispositivo de caja.
            </div>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {cajeroUrl}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copyCajeroLink}
                style={{
                  flex: 1, background: copied ? '#10B981' : '#7C3AED', color: 'white',
                  border: 'none', borderRadius: 8, padding: '9px 14px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
              >
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button
                onClick={() => setShowQr(true)}
                title="Ver QR"
                style={{
                  background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0',
                  borderRadius: 8, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
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
                  background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0',
                  borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 500,
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

          {/* Cajeras */}
          <div className="cx-breakdown-section">
            <div className="cx-breakdown-title">Cajeras</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              Cada cajera tiene su propio PIN. Al ingresar, la app muestra su nombre en el encabezado.
            </div>

            {/* Lista */}
            {cajeras.length > 0 && (
              <table className="cx-breakdown-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>PIN</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cajeras.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td style={{ fontFamily: 'monospace', letterSpacing: '0.1em', color: '#64748B' }}>{'•'.repeat(c.pin.length)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => removeCajera(c.id)}
                          style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: '2px 6px' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Agregar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>NOMBRE</div>
                <input
                  type="text"
                  placeholder="Ej: Maria"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>PIN</div>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="1234"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCajera()}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }}
                />
              </div>
              <button
                onClick={addCajera}
                disabled={cajerasSaving || !newName.trim() || !newPin.trim()}
                style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: cajerasSaving ? 0.6 : 1, flexShrink: 0 }}
              >
                Agregar
              </button>
            </div>
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

      {/* ── QR MODAL ── */}
      {showQr && cajeroUrl && (
        <div onClick={() => setShowQr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>App de cajero</div>
            <QRCodeSVG value={cajeroUrl} size={220} bgColor="#ffffff" fgColor="#0F172A" />
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', wordBreak: 'break-all' }}>{cajeroUrl}</div>
            <button onClick={() => setShowQr(false)} style={{ width: '100%', background: '#F1F5F9', color: '#0F172A', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cerrar
            </button>
          </div>
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
