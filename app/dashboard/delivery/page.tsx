'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './delivery.css'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Cargando mapa...</span>
    </div>
  ),
})

type Tab = 'tray' | 'live' | 'today' | 'couriers' | 'zones' | 'settlements'
type DeliveryStatus = 'ready' | 'picked_up' | 'delivered' | 'cancelled'
type TodayFilter = 'all' | 'ongoing' | 'delivered' | 'cancelled'

type Driver = { id: string; name: string; phone: string | null; is_active: boolean; created_at: string }
type Order = { id: string; customer_name: string; customer_phone: string; customer_notes: string | null; payment_method: string | null; total: number; status: string; created_at: string }
type Delivery = {
  id: string; store_id: string; order_id: string | null; driver_id: string | null
  customer_name: string; customer_phone: string; delivery_address: string
  status: DeliveryStatus; driver_fee: number; fee_paid: boolean
  notes: string | null; picked_up_at: string | null; delivered_at: string | null; created_at: string
  customer_lat: number | null; customer_lng: number | null; is_customer_order: boolean | null
  driver?: Driver | null
}

const BASE_URL = 'https://lyte-app.com'
const pickupUrl = (id: string) => `${BASE_URL}/pickup/${id}`
const STATIC_ZONES = [
  { id: 'z1', name: 'Las Mercedes', fee: 4.00, color: '#7C3AED', type: 'Tarifa plana' },
  { id: 'z2', name: 'Chacao',       fee: 5.00, color: '#1D9E75', type: 'Tarifa plana' },
  { id: 'z3', name: 'El Rosal',     fee: 4.50, color: '#EF9F27', type: 'Solo pick-up' },
  { id: 'z4', name: 'El Hatillo',   fee: 5.50, color: '#D85A30', type: 'Por distancia' },
  { id: 'z5', name: 'Altamira',     fee: 5.00, color: '#534AB7', type: 'Tarifa plana' },
]

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function deliveryMinutes(del: Delivery) {
  if (!del.picked_up_at || !del.delivered_at) return null
  return Math.round((new Date(del.delivered_at).getTime() - new Date(del.picked_up_at).getTime()) / 60000)
}

function isToday(iso: string) {
  const d = new Date(iso); const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function DeliveryPage() {
  const { user } = useAuth()
  const [loading, setLoading]       = useState(true)
  const [storeId, setStoreId]       = useState<string | null>(null)
  const [tab, setTab]               = useState<Tab>('tray')
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers]       = useState<Driver[]>([])
  const [readyOrders, setReadyOrders] = useState<Order[]>([])

  // Live tab
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [dAddress, setDAddress] = useState('')
  const [dDriverId, setDDriverId] = useState('')
  const [dFee, setDFee]         = useState('')
  const [dNotes, setDNotes]     = useState('')
  const [dSaving, setDSaving]   = useState(false)

  // Today tab
  const [todayFilter, setTodayFilter] = useState<TodayFilter>('all')

  // Couriers tab
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [editDriver, setEditDriver]         = useState<Driver | null>(null)
  const [drName, setDrName]   = useState('')
  const [drPhone, setDrPhone] = useState('')
  const [drSaving, setDrSaving] = useState(false)

  // QR modal
  const [qrDel, setQrDel]       = useState<Delivery | null>(null)
  const [qrSeconds, setQrSeconds] = useState(272)
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Toast
  const [toast, setToast]   = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Copy state
  const [copied, setCopied] = useState(false)

  const trackUrl = (id: string) => `${BASE_URL}/delivery/${id}`

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  const loadData = useCallback(async (sid: string) => {
    const [{ data: dels }, { data: drvs }, { data: orders }, { data: dispatched }] = await Promise.all([
      supabase.from('deliveries').select('*, driver:driver_id(id,name,phone,is_active)').eq('store_id', sid).order('created_at', { ascending: false }).limit(300),
      supabase.from('delivery_drivers').select('*').eq('store_id', sid).order('name'),
      supabase.from('orders').select('id,customer_name,customer_phone,customer_notes,payment_method,total,status,created_at').eq('store_id', sid).eq('status', 'ready').order('created_at', { ascending: false }),
      supabase.from('deliveries').select('order_id').eq('store_id', sid).not('order_id', 'is', null),
    ])
    const dispatchedIds = new Set((dispatched ?? []).map((d: { order_id: string }) => d.order_id))
    setDeliveries((dels as Delivery[]) ?? [])
    setDrivers(drvs ?? [])
    setReadyOrders((orders ?? []).filter((o: Order) => !dispatchedIds.has(o.id)))
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) { setStoreId(data.id); loadData(data.id) }
      setLoading(false)
    })
  }, [user, loadData])

  useEffect(() => {
    if (!storeId) return
    const ch = supabase.channel(`delivery-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `store_id=eq.${storeId}` }, () => loadData(storeId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => loadData(storeId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, loadData])

  // QR timer
  useEffect(() => {
    if (!qrDel) {
      if (qrTimer.current) clearInterval(qrTimer.current)
      return
    }
    setQrSeconds(272)
    qrTimer.current = setInterval(() => {
      setQrSeconds(s => { if (s <= 1) { clearInterval(qrTimer.current!); return 0 } return s - 1 })
    }, 1000)
    return () => { if (qrTimer.current) clearInterval(qrTimer.current) }
  }, [qrDel])

  function selectOrder(order: Order) {
    setSelectedOrderId(order.id)
    setDAddress(''); setDDriverId(''); setDFee(order.total > 0 ? '' : ''); setDNotes('')
  }

  async function createDelivery() {
    if (!storeId || !selectedOrderId) return
    const order = readyOrders.find(o => o.id === selectedOrderId)
    if (!order) return
    setDSaving(true)
    await supabase.from('deliveries').insert({
      store_id: storeId, order_id: order.id,
      customer_name: order.customer_name, customer_phone: order.customer_phone,
      delivery_address: dAddress.trim(), driver_id: dDriverId || null,
      driver_fee: parseFloat(dFee) || 0, notes: dNotes.trim() || null, status: 'ready',
    })
    setSelectedOrderId(null); setDSaving(false)
    showToast('Entrega despachada')
    await loadData(storeId)
  }

  async function updateStatus(del: Delivery, status: DeliveryStatus) {
    const patch: Record<string, unknown> = { status }
    if (status === 'picked_up') patch.picked_up_at = new Date().toISOString()
    if (status === 'delivered') patch.delivered_at = new Date().toISOString()
    await supabase.from('deliveries').update(patch).eq('id', del.id)
    setDeliveries(p => p.map(d => d.id === del.id ? { ...d, ...patch } as Delivery : d))
    showToast(status === 'delivered' ? 'Entrega confirmada' : 'Estado actualizado')
  }

  async function markFeePaid(delId: string, paid: boolean) {
    await supabase.from('deliveries').update({ fee_paid: paid }).eq('id', delId)
    setDeliveries(p => p.map(d => d.id === delId ? { ...d, fee_paid: paid } : d))
    if (paid) showToast('Fee marcado como pagado')
  }

  async function saveDriver() {
    if (!storeId || !drName.trim()) return
    setDrSaving(true)
    if (editDriver) {
      const { error } = await supabase.from('delivery_drivers').update({ name: drName.trim(), phone: drPhone.trim() || null }).eq('id', editDriver.id)
      if (error) { showToast('Error al guardar: ' + error.message); setDrSaving(false); return }
    } else {
      const { error } = await supabase.from('delivery_drivers').insert({ store_id: storeId, name: drName.trim(), phone: drPhone.trim() || null, is_active: true })
      if (error) { showToast('Error al guardar: ' + error.message); setDrSaving(false); return }
    }
    setDrName(''); setDrPhone(''); setEditDriver(null); setShowDriverForm(false); setDrSaving(false)
    showToast(editDriver ? 'Despachador actualizado' : 'Despachador agregado')
    await loadData(storeId)
  }

  async function toggleDriver(drv: Driver) {
    await supabase.from('delivery_drivers').update({ is_active: !drv.is_active }).eq('id', drv.id)
    setDrivers(p => p.map(d => d.id === drv.id ? { ...d, is_active: !drv.is_active } : d))
  }

  async function deleteDriver(id: string) {
    if (!confirm('Eliminar despachador?')) return
    await supabase.from('delivery_drivers').delete().eq('id', id)
    setDrivers(p => p.filter(d => d.id !== id))
  }

  function sendWhatsApp(del: Delivery) {
    const url = trackUrl(del.id)
    const msg = `Hola ${del.customer_name}, tu pedido ya va en camino. Puedes seguirlo aqui: ${url}`
    window.open(`https://wa.me/${(del.customer_phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
  }

  // Derived data
  const inRoute   = deliveries.filter(d => d.status === 'picked_up')
  const waiting   = deliveries.filter(d => d.status === 'ready')
  const activeDrivers = drivers.filter(d => d.is_active !== false)
  const todayDels = deliveries.filter(d => isToday(d.created_at))

  const avgMinutes = (() => {
    const completed = todayDels.filter(d => d.picked_up_at && d.delivered_at)
    if (!completed.length) return null
    const total = completed.reduce((s, d) => s + (deliveryMinutes(d) ?? 0), 0)
    return Math.round(total / completed.length)
  })()

  const todayRevenue = todayDels.filter(d => d.status === 'delivered').reduce((s, d) => s + Number(d.driver_fee), 0)

  const todayFiltered = todayDels.filter(d =>
    todayFilter === 'all' ? true
    : todayFilter === 'ongoing' ? ['ready', 'picked_up'].includes(d.status)
    : d.status === todayFilter
  )

  const settlements = drivers.map(drv => {
    const dDels = deliveries.filter(d => d.driver_id === drv.id && d.status !== 'cancelled')
    const base    = dDels.reduce((s, d) => s + Number(d.driver_fee), 0)
    const paid    = dDels.filter(d => d.fee_paid).reduce((s, d) => s + Number(d.driver_fee), 0)
    return { drv, dDels, base, paid, pending: base - paid }
  }).filter(s => s.base > 0 || s.dDels.length > 0)

  const totalToPay   = settlements.reduce((s, x) => s + x.pending, 0)
  const totalRevenue = deliveries.filter(d => d.status !== 'cancelled').reduce((s, d) => s + Number(d.driver_fee), 0)

  const selectedOrder = readyOrders.find(o => o.id === selectedOrderId) ?? null

  if (loading) return <div className="dv-spinner-wrap"><div className="dv-spinner" /></div>

  if (!storeId) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#0F172A' }}>No tienes una tienda aun</div>
      <a href="/dashboard/tienda" style={{ color: '#7C3AED' }}>Crear tienda</a>
    </div>
  )

  return (
    <div className="dv-root">

      {/* ── TABS ── */}
      <nav className="dv-tabs">
        <button className={`dv-tab${tab === 'tray' ? ' active' : ''}`} onClick={() => setTab('tray')}>
          Bandeja
          {deliveries.filter(d => d.is_customer_order && d.status === 'ready').length > 0 && (
            <span className="dv-tab-count">{deliveries.filter(d => d.is_customer_order && d.status === 'ready').length}</span>
          )}
        </button>
        <button className={`dv-tab${tab === 'live' ? ' active' : ''}`} onClick={() => setTab('live')}>
          En vivo
          {(inRoute.length + waiting.length) > 0 && (
            <span className="dv-tab-count">{inRoute.length + waiting.length}</span>
          )}
        </button>
        <button className={`dv-tab${tab === 'today' ? ' active' : ''}`} onClick={() => setTab('today')}>
          Hoy
        </button>
        <button className={`dv-tab${tab === 'couriers' ? ' active' : ''}`} onClick={() => setTab('couriers')}>
          Motorizados
        </button>
        <button className={`dv-tab${tab === 'zones' ? ' active' : ''}`} onClick={() => setTab('zones')}>
          Zonas
        </button>
        <button className={`dv-tab${tab === 'settlements' ? ' active' : ''}`} onClick={() => setTab('settlements')}>
          Liquidaciones
        </button>
      </nav>

      {/* ══════════════════════════════════════════════
          VISTA: BANDEJA (pedidos del cliente con ubicacion)
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'tray' ? ' active' : ''}`}>
        <div className="dv-tray-wrap">
          <div className="dv-tray-header">
            <div>
              <h3>Bandeja de pedidos</h3>
              <p>Pedidos entrantes con rastreo activado</p>
            </div>
            <span style={{ fontSize: 12, color: 'var(--dv-ink-muted)' }}>
              {deliveries.filter(d => d.is_customer_order && d.status === 'ready').length} pendientes
            </span>
          </div>

          {deliveries.filter(d => d.is_customer_order).length === 0 ? (
            <div className="dv-tray-empty">
              <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="40" height="40">
                <rect x="6" y="10" width="36" height="28" rx="6" />
                <path strokeLinecap="round" d="M14 18h20M14 24h14M14 30h8" />
              </svg>
              <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 14, marginTop: 12 }}>Sin pedidos en bandeja</div>
              <div style={{ color: 'var(--dv-ink-muted)', fontSize: 12, marginTop: 4 }}>
                Los pedidos con rastreo del cliente apareceran aqui
              </div>
            </div>
          ) : (
            <div className="dv-tray-grid">
              {deliveries
                .filter(d => d.is_customer_order)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(del => {
                  const mins = Math.floor((Date.now() - new Date(del.created_at).getTime()) / 60000)
                  const timeStr = mins < 1 ? 'Ahora' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`
                  const statusColor = del.status === 'delivered' ? '#1D9E75' : del.status === 'picked_up' ? '#3B82F6' : del.status === 'cancelled' ? '#94A3B8' : '#BA7517'
                  const statusLabel = del.status === 'delivered' ? 'Entregado' : del.status === 'picked_up' ? 'En camino' : del.status === 'cancelled' ? 'Cancelado' : 'Esperando'
                  const hasLocation = del.customer_lat !== null && del.customer_lng !== null
                  const drv = del.driver as Driver | null

                  return (
                    <div
                      key={del.id}
                      className={`dv-tray-card${del.status === 'delivered' || del.status === 'cancelled' ? ' done' : ''}`}
                      onClick={() => del.status === 'ready' || del.status === 'picked_up' ? setQrDel(del) : undefined}
                      style={{ cursor: del.status === 'ready' || del.status === 'picked_up' ? 'pointer' : 'default' }}
                    >
                      <div className="dv-tray-card-top">
                        <div className="dv-tray-avatar">{del.customer_name[0].toUpperCase()}</div>
                        <div className="dv-tray-info">
                          <div className="dv-tray-name">{del.customer_name}</div>
                          <div className="dv-tray-meta">
                            <span>{timeStr}</span>
                            {del.customer_phone && <span> · {del.customer_phone}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusColor + '18', borderRadius: 100, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                            {statusLabel}
                          </span>
                          {hasLocation && (
                            <span style={{ fontSize: 10, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <svg viewBox="0 0 12 12" fill="#7C3AED" width="10" height="10">
                                <path fillRule="evenodd" d="M3.03 2.53a4.2 4.2 0 115.94 5.94L6 11.34 3.03 8.47a4.2 4.2 0 010-5.94zM6 6.6a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z" clipRule="evenodd" />
                              </svg>
                              Con ubicacion
                            </span>
                          )}
                        </div>
                      </div>

                      {drv && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 0', borderTop: '1px solid #F1F5F9', marginTop: 10, fontSize: 12, color: 'var(--dv-ink-soft)' }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#7C3AED' }}>
                            {drv.name[0]}
                          </div>
                          {drv.name}
                        </div>
                      )}

                      {(del.status === 'ready' || del.status === 'picked_up') && (
                        <div className="dv-tray-card-footer">
                          <button
                            className="dv-tray-qr-btn"
                            onClick={e => { e.stopPropagation(); setQrDel(del) }}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                              <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM7 11a1 1 0 100-2H4a1 1 0 100 2h3zM17 13a1 1 0 01-1 1h-2a1 1 0 110-2h2a1 1 0 011 1zM16 17a1 1 0 100-2h-3a1 1 0 100 2h3z" />
                            </svg>
                            Ver QR
                          </button>
                          <a
                            href={`/delivery/${del.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 11, color: 'var(--dv-ink-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
                              <path fillRule="evenodd" d="M8.914 6.025a.75.75 0 011.06 0 3.5 3.5 0 010 4.95l-2 2a3.5 3.5 0 01-4.95-4.95l1.25-1.25a.75.75 0 011.06 1.06L4.085 9.08a2 2 0 102.83 2.83l2-2a2 2 0 000-2.83.75.75 0 010-1.06zM7.086 9.975a.75.75 0 01-1.06 0 3.5 3.5 0 010-4.95l2-2a3.5 3.5 0 014.95 4.95l-1.25 1.25a.75.75 0 11-1.06-1.06l1.249-1.25a2 2 0 10-2.83-2.83l-2 2a2 2 0 000 2.83.75.75 0 010 1.06z" clipRule="evenodd" />
                            </svg>
                            Link cliente
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })
              }
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: EN VIVO
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'live' ? ' active' : ''}`}>

        {/* KPI bar */}
        <div className="dv-kpi-bar">
          <div className="dv-kpi">
            <div className="dv-kpi-label">En ruta ahora</div>
            <div className="dv-kpi-value">
              <span className="dv-kpi-num">{inRoute.length}</span>
              <span className="dv-kpi-sub" style={{ color: 'var(--dv-violet)' }}>pedidos</span>
            </div>
          </div>
          <div className={`dv-kpi${waiting.length > 0 ? ' warn' : ''}`}>
            <div className="dv-kpi-label">Esperando despachador</div>
            <div className="dv-kpi-value">
              <span className="dv-kpi-num">{waiting.length + readyOrders.length}</span>
              <span className="dv-kpi-sub">{waiting.length + readyOrders.length > 0 ? 'pendientes' : 'ninguno'}</span>
            </div>
          </div>
          <div className="dv-kpi">
            <div className="dv-kpi-label">Despachadores activos</div>
            <div className="dv-kpi-value">
              <span className="dv-kpi-num">{activeDrivers.length}</span>
              <span className="dv-kpi-sub">de {drivers.length}</span>
            </div>
          </div>
          <div className="dv-kpi">
            <div className="dv-kpi-label">Tiempo prom. entrega</div>
            <div className="dv-kpi-value">
              <span className="dv-kpi-num">{avgMinutes ?? '—'}</span>
              <span className="dv-kpi-sub">{avgMinutes ? 'min' : 'sin datos'}</span>
            </div>
          </div>
          <div className="dv-kpi featured">
            <div className="dv-kpi-label">Delivery facturado hoy</div>
            <div className="dv-kpi-value">
              <span className="dv-kpi-num">${todayRevenue.toFixed(0)}</span>
              <span className="dv-kpi-sub">· {todayDels.filter(d => d.status === 'delivered').length} entregas</span>
            </div>
          </div>
        </div>

        {/* Three-column grid */}
        <div className="dv-live-grid">

          {/* ── QUEUE PANEL ── */}
          <div className="dv-panel">
            <div className="dv-panel-header">
              <div>
                <h3>Cola de despacho</h3>
                <p>Pedidos listos esperando despachador</p>
              </div>
              {readyOrders.length > 0 && (
                <span className="dv-header-badge warn">{readyOrders.length}</span>
              )}
            </div>
            <div className="dv-panel-body">
              {readyOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--dv-ink-soft)', fontSize: 12 }}>
                  Sin pedidos en cola
                </div>
              ) : (
                readyOrders.map(order => (
                  <div
                    key={order.id}
                    className={`dv-order-card${selectedOrderId === order.id ? ' selected' : ''}`}
                    onClick={() => selectOrder(order)}
                  >
                    <div className="dv-order-row">
                      <span className="dv-order-name">{order.customer_name}</span>
                      <span className="dv-order-pill ready">listo · {timeAgo(order.created_at)}</span>
                    </div>
                    <div className="dv-order-meta">
                      {order.customer_phone && <span>{order.customer_phone}</span>}
                      {order.total > 0 && <span> · ${Number(order.total).toFixed(2)}</span>}
                      {order.payment_method && <span> · {order.payment_method}</span>}
                    </div>
                    {order.customer_notes && (
                      <div className="dv-order-meta" style={{ fontStyle: 'italic', marginBottom: 0 }}>
                        {order.customer_notes}
                      </div>
                    )}
                    <div className="dv-order-actions">
                      <button className="dv-btn-assign" onClick={e => { e.stopPropagation(); selectOrder(order) }}>
                        Asignar
                      </button>
                      <button className="dv-btn-outline-sm" onClick={e => { e.stopPropagation(); const d = deliveries.find(x => x.order_id === order.id); if (d) setQrDel(d) }}>
                        QR
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* In-route active deliveries */}
              {waiting.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--dv-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 4px' }}>
                    Despachados · en espera de recogida
                  </div>
                  {waiting.map(del => (
                    <div key={del.id} className="dv-order-card" style={{ borderColor: '#FDE68A' }}>
                      <div className="dv-order-row">
                        <span className="dv-order-name">{del.customer_name}</span>
                        <span className="dv-order-pill urgent">esperando</span>
                      </div>
                      <div className="dv-order-meta">{del.delivery_address || 'Sin dirección'}</div>
                      <div className="dv-order-actions">
                        <button className="dv-btn-assign" style={{ background: '#7C3AED' }} onClick={() => updateStatus(del, 'picked_up')}>
                          Marcar recogido
                        </button>
                        <button className="dv-btn-outline-sm" onClick={() => setQrDel(del)}>QR</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* In-route strip */}
            {inRoute.length > 0 && (
              <div className="dv-route-strip">
                <div className="dv-route-title">En ruta ahora</div>
                {inRoute.map(del => {
                  const mins = del.picked_up_at ? Math.floor((Date.now() - new Date(del.picked_up_at).getTime()) / 60000) : null
                  const late = mins !== null && mins > 30
                  return (
                    <div key={del.id} className="dv-route-row">
                      <div className="dv-route-left">
                        <span className={`dv-route-dot ${late ? 'late' : 'ok'}`} />
                        <span className="dv-route-name">{del.customer_name}</span>
                        {del.driver && <span className="dv-route-courier">→ {(del.driver as Driver).name}</span>}
                      </div>
                      <span className={`dv-route-eta${late ? ' late' : ''}`}>{mins !== null ? `${mins} min` : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── MAP PANEL ── */}
          <div className="dv-panel dv-map-panel" style={{ position: 'relative' }}>
            <MapView
              inRoute={inRoute.map(del => ({
                id: del.id,
                customer_name: del.customer_name,
                driver_name: (del.driver as Driver | null)?.name ?? null,
                picked_up_at: del.picked_up_at,
              }))}
            />
          </div>

          {/* ── DETAIL PANEL ── */}
          <div className="dv-panel" style={{ overflowY: 'auto' }}>
            {!selectedOrder ? (
              <div className="dv-empty-detail">
                <svg viewBox="0 0 64 64" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: 12 }}>
                  <circle cx="32" cy="32" r="26" strokeDasharray="4 3"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M22 32h20M32 22v20"/>
                </svg>
                <h4>Sin pedido seleccionado</h4>
                <p>Elige un pedido de la cola para asignar un despachador.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="dv-detail-section">
                  <div className="dv-detail-id-row">
                    <div>
                      <div className="dv-detail-label accent">Pedido seleccionado</div>
                      <div className="dv-detail-num">{selectedOrder.customer_name}</div>
                    </div>
                    <button className="dv-close-btn" onClick={() => setSelectedOrderId(null)}>✕</button>
                  </div>
                  <div className="dv-customer-row">
                    <div className="dv-customer-avatar">{selectedOrder.customer_name[0].toUpperCase()}</div>
                    <div className="dv-customer-info">
                      <h4>{selectedOrder.customer_name}</h4>
                      <p>{selectedOrder.customer_phone}</p>
                    </div>
                    <button className="dv-wa-btn" onClick={() => window.open(`https://wa.me/${selectedOrder.customer_phone.replace(/\D/g, '')}`, '_blank')}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  </div>
                </div>

                {/* Suggested drivers */}
                <div className="dv-detail-section">
                  <div className="dv-detail-label">Despachadores disponibles</div>
                  <div className="dv-driver-suggest">
                    {activeDrivers.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--dv-ink-muted)' }}>Sin despachadores activos</div>
                    ) : (
                      activeDrivers.map((drv, i) => {
                        const busyWithDelivery = inRoute.find(d => d.driver_id === drv.id)
                        return (
                          <div
                            key={drv.id}
                            className={`dv-driver-row${i === 0 && !busyWithDelivery ? ' recommended' : ''}`}
                            onClick={() => setDDriverId(drv.id)}
                            style={{ outline: dDriverId === drv.id ? '2px solid #7C3AED' : undefined }}
                          >
                            <div className="dv-driver-row-av">{drv.name[0]}</div>
                            <div className="dv-driver-row-info">
                              <div className="dv-driver-row-name">{drv.name}</div>
                              <div className="dv-driver-row-meta">{busyWithDelivery ? 'en ruta' : 'disponible'}{drv.phone ? ` · ${drv.phone}` : ''}</div>
                            </div>
                            <button
                              className={`dv-driver-action${i === 0 && !busyWithDelivery ? '' : ' outline'}`}
                              onClick={e => { e.stopPropagation(); setDDriverId(drv.id) }}
                            >
                              {dDriverId === drv.id ? 'Seleccionado' : 'Seleccionar'}
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Dispatch form */}
                <div className="dv-detail-section">
                  <div className="dv-detail-label">Detalles de entrega</div>
                  <div className="dv-dispatch-form">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Direccion</label>
                      <input className="dv-input" value={dAddress} onChange={e => setDAddress(e.target.value)} placeholder="Calle, Edificio, Apto..." />
                    </div>
                    <div className="dv-form-row2">
                      <div className="dv-form-field">
                        <label className="dv-form-label">Despachador</label>
                        <select className="dv-select" value={dDriverId} onChange={e => setDDriverId(e.target.value)}>
                          <option value="">Sin asignar</option>
                          {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="dv-form-field">
                        <label className="dv-form-label">Fee ($)</label>
                        <input className="dv-input" value={dFee} onChange={e => setDFee(e.target.value)} type="number" min="0" step="0.50" placeholder="0.00" />
                      </div>
                    </div>
                    <button className="dv-dispatch-btn" onClick={createDelivery} disabled={dSaving}>
                      {dSaving ? 'Despachando...' : 'Despachar pedido'}
                    </button>
                  </div>
                </div>

                {/* Money summary */}
                <div className="dv-detail-section">
                  <div className="dv-money-box">
                    <div className="dv-money-row"><span>Total del pedido</span><span>${Number(selectedOrder.total).toFixed(2)}</span></div>
                    <div className="dv-money-row"><span>Fee al despachador</span><span>${parseFloat(dFee) > 0 ? parseFloat(dFee).toFixed(2) : '—'}</span></div>
                    <div className="dv-money-total"><span>Total cobrado al cliente</span><span>${Number(selectedOrder.total).toFixed(2)}</span></div>
                    {selectedOrder.payment_method && (
                      <div className="dv-money-footer"><span>✓ {selectedOrder.payment_method}</span></div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: HOY
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'today' ? ' active' : ''}`}>
        <div className="dv-table-wrap">
          <div className="dv-summary-grid">
            <div className="dv-summary-card">
              <div className="dv-sc-label">Entregas hoy</div>
              <div className="dv-sc-val">{todayDels.length}</div>
            </div>
            <div className="dv-summary-card">
              <div className="dv-sc-label">Tiempo promedio</div>
              <div className="dv-sc-val">{avgMinutes ? `${avgMinutes} min` : '—'}</div>
            </div>
            <div className="dv-summary-card">
              <div className="dv-sc-label">Canceladas</div>
              <div className="dv-sc-val">{todayDels.filter(d => d.status === 'cancelled').length}</div>
            </div>
            <div className="dv-summary-card">
              <div className="dv-sc-label">Facturado en delivery</div>
              <div className="dv-sc-val">${todayRevenue.toFixed(2)}</div>
            </div>
          </div>

          <div className="dv-filter-pills">
            {(['all', 'ongoing', 'delivered', 'cancelled'] as const).map(f => (
              <button key={f} className={`dv-filter-pill${todayFilter === f ? ' active' : ''}`} onClick={() => setTodayFilter(f)}>
                {f === 'all' ? `Todos · ${todayDels.length}` : f === 'ongoing' ? `En curso · ${todayDels.filter(d => ['ready','picked_up'].includes(d.status)).length}` : f === 'delivered' ? `Entregados · ${todayDels.filter(d => d.status === 'delivered').length}` : `Cancelados · ${todayDels.filter(d => d.status === 'cancelled').length}`}
              </button>
            ))}
          </div>

          {todayFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--dv-ink-muted)', fontSize: 13 }}>
              Sin entregas para este filtro
            </div>
          ) : (
            <table className="dv-data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Direccion</th>
                  <th>Despachador</th>
                  <th>Listo</th>
                  <th>Recogido</th>
                  <th>Entregado</th>
                  <th>Tiempo</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Fee</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {todayFiltered.map(del => {
                  const drv = del.driver as Driver | null
                  const mins = deliveryMinutes(del)
                  const status = del.status === 'delivered' ? 'delivered' : del.status === 'cancelled' ? 'cancelled' : 'ongoing'
                  const statusLabel = { delivered: 'Entregado', cancelled: 'Cancelado', ongoing: 'En curso' }[status]
                  return (
                    <tr key={del.id}>
                      <td style={{ fontWeight: 500 }}>{del.customer_name}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{del.delivery_address || '—'}</td>
                      <td>
                        {drv ? <><span className="dv-mini-av">{drv.name[0]}</span>{drv.name}</> : <span style={{ color: 'var(--dv-ink-muted)' }}>—</span>}
                      </td>
                      <td>{fmtTime(del.created_at)}</td>
                      <td>{fmtTime(del.picked_up_at)}</td>
                      <td>{fmtTime(del.delivered_at)}</td>
                      <td>{mins !== null ? `${mins} min` : '—'}</td>
                      <td><span className={`dv-chip ${status}`}>{statusLabel}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>${Number(del.driver_fee).toFixed(2)}</td>
                      <td>
                        {del.status === 'ready' && (
                          <button className="dv-btn-outline-sm" onClick={() => setQrDel(del)} style={{ fontSize: 11, padding: '4px 8px' }}>QR</button>
                        )}
                        {del.status === 'picked_up' && (
                          <button className="dv-btn-outline-sm" onClick={() => updateStatus(del, 'delivered')} style={{ fontSize: 11, padding: '4px 8px', color: '#1D9E75' }}>
                            Entregado
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: MOTORIZADOS
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'couriers' ? ' active' : ''}`}>
        <div className="dv-couriers-wrap">
          <div className="dv-couriers-header">
            <div style={{ fontSize: 13, color: 'var(--dv-ink-soft)' }}>
              {activeDrivers.length} activos · {drivers.length - activeDrivers.length} offline
            </div>
            <button className="dv-btn-add" onClick={() => { setDrName(''); setDrPhone(''); setEditDriver(null); setShowDriverForm(true) }}>
              + Agregar despachador
            </button>
          </div>

          {showDriverForm && (
            <div className="dv-driver-form-card">
              <div className="dv-driver-form-title">{editDriver ? 'Editar despachador' : 'Nuevo despachador'}</div>
              <div className="dv-driver-form-row">
                <div className="dv-form-field">
                  <label className="dv-form-label">Nombre *</label>
                  <input className="dv-input" value={drName} onChange={e => setDrName(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="dv-form-field">
                  <label className="dv-form-label">Telefono</label>
                  <input className="dv-input" value={drPhone} onChange={e => setDrPhone(e.target.value)} placeholder="+58 412 000 0000" type="tel" />
                </div>
              </div>
              <div className="dv-driver-form-actions">
                <button className="dv-btn-ghost-sm" onClick={() => setShowDriverForm(false)}>Cancelar</button>
                <button className="dv-btn-primary-sm" onClick={saveDriver} disabled={drSaving || !drName.trim()}>
                  {drSaving ? 'Guardando...' : editDriver ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </div>
          )}

          {drivers.length === 0 ? (
            <div className="dv-empty-wrap">
              <h4>Sin despachadores registrados</h4>
              <p>Agrega tu equipo para asignar entregas</p>
            </div>
          ) : (
            <div className="dv-courier-grid">
              {drivers.map(drv => {
                const dDels = deliveries.filter(d => d.driver_id === drv.id && d.status !== 'cancelled')
                const todayDrv = dDels.filter(d => isToday(d.created_at) && d.status === 'delivered')
                const earnings = todayDrv.reduce((s, d) => s + Number(d.driver_fee), 0)
                const busy = inRoute.find(d => d.driver_id === drv.id)
                return (
                  <div key={drv.id} className={`dv-courier-card${!drv.is_active ? ' inactive' : ''}`}>
                    <div className="dv-courier-card-head">
                      <div className="dv-courier-card-av">{drv.name[0].toUpperCase()}</div>
                      <div className="dv-courier-card-info">
                        <h4>{drv.name}</h4>
                        <p>{drv.phone || 'Sin telefono'}</p>
                      </div>
                      {drv.is_active
                        ? busy
                          ? <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 500, marginLeft: 'auto', whiteSpace: 'nowrap' }}>en ruta</span>
                          : <span className="dv-badge-online" style={{ marginLeft: 'auto' }}>en linea</span>
                        : <span className="dv-badge-offline">offline</span>
                      }
                    </div>
                    <div className="dv-courier-stats">
                      <div className="dv-courier-stat">
                        <div className="val">{todayDrv.length}</div>
                        <div className="lbl">Entregas hoy</div>
                      </div>
                      <div className="dv-courier-stat">
                        <div className="val">{dDels.length}</div>
                        <div className="lbl">Total</div>
                      </div>
                      <div className="dv-courier-stat">
                        <div className="val">${earnings.toFixed(0)}</div>
                        <div className="lbl">Ganado hoy</div>
                      </div>
                    </div>
                    <div className="dv-courier-card-actions">
                      <button onClick={() => { setEditDriver(drv); setDrName(drv.name); setDrPhone(drv.phone ?? ''); setShowDriverForm(true) }}>
                        Editar
                      </button>
                      <button onClick={() => toggleDriver(drv)}>
                        {drv.is_active ? 'Pausar' : 'Activar'}
                      </button>
                      <button className="danger" onClick={() => deleteDriver(drv.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: ZONAS
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'zones' ? ' active' : ''}`}>
        <div className="dv-zones-wrap">
          <div className="dv-zones-list">
            <div className="dv-zones-header">
              <h3>Zonas de delivery</h3>
              <button className="dv-btn-primary-sm" onClick={() => showToast('Proximamente: creacion de zonas')}>+ Nueva</button>
            </div>
            {STATIC_ZONES.map(z => (
              <div key={z.id} className="dv-zone-item">
                <div className="dv-zone-item-head">
                  <div className="dv-zone-name-row">
                    <span className="dv-zone-color-dot" style={{ background: z.color }} />
                    <h4>{z.name}</h4>
                  </div>
                </div>
                <div className="dv-zone-meta">
                  <span>{z.type}</span>
                  <span className="dv-zone-fee">${z.fee.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="dv-zones-map">
            <div className="dv-map-bg" />
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
              <path d="M 60 80 L 220 110 L 320 220 L 460 260 L 600 380 L 720 460" stroke="#9FAFC2" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.4"/>
              <path d="M 40 320 L 200 340 L 320 420 L 480 440 L 640 480 L 760 520" stroke="#9FAFC2" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.35"/>
              <path d="M 240 30 L 260 220 L 280 360 L 320 520" stroke="#9FAFC2" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.35"/>
              <path d="M 480 30 L 500 220 L 520 360 L 540 540" stroke="#9FAFC2" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.35"/>
              <polygon points="180,180 320,160 380,260 320,340 200,320" fill="#7C3AED" fillOpacity="0.18" stroke="#4C1D95" strokeWidth="2" strokeDasharray="6 4"/>
              <text x="270" y="250" textAnchor="middle" fontFamily="system-ui" fontSize="14" fontWeight="600" fill="#4C1D95">Las Mercedes</text>
              <text x="270" y="270" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill="#4C1D95">$4</text>
              <polygon points="420,140 560,160 600,260 540,320 440,300" fill="#1D9E75" fillOpacity="0.15" stroke="#0F6E56" strokeWidth="1" strokeDasharray="6 4"/>
              <text x="510" y="230" textAnchor="middle" fontFamily="system-ui" fontSize="13" fontWeight="500" fill="#0F6E56">Chacao</text>
              <text x="510" y="248" textAnchor="middle" fontFamily="system-ui" fontSize="10" fill="#0F6E56">$5</text>
              <polygon points="200,360 360,380 400,460 320,500 220,480" fill="#EF9F27" fillOpacity="0.15" stroke="#BA7517" strokeWidth="1" strokeDasharray="6 4"/>
              <text x="300" y="440" textAnchor="middle" fontFamily="system-ui" fontSize="13" fontWeight="500" fill="#854F0B">El Rosal</text>
              <text x="300" y="458" textAnchor="middle" fontFamily="system-ui" fontSize="10" fill="#854F0B">$4,50</text>
              <polygon points="560,360 700,380 740,480 660,520 580,480" fill="#D85A30" fillOpacity="0.12" stroke="#993C1D" strokeWidth="1" strokeDasharray="6 4"/>
              <text x="650" y="440" textAnchor="middle" fontFamily="system-ui" fontSize="13" fontWeight="500" fill="#993C1D">El Hatillo</text>
              <text x="650" y="458" textAnchor="middle" fontFamily="system-ui" fontSize="10" fill="#993C1D">$5,50</text>
              <g>
                <rect x="276" y="220" width="34" height="34" rx="9" fill="#4C1D95"/>
                <polygon points="286,229 304,237 286,245" fill="white"/>
              </g>
            </svg>
            <div className="dv-map-badge">
              <svg viewBox="0 0 20 20" fill="#7C3AED" width="14" height="14"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
              <span>Zonas de cobertura</span>
            </div>
            <div className="dv-map-legend">
              <div className="dv-legend-title">Tipo de zona</div>
              <div className="dv-legend-row"><span className="dv-legend-dot" style={{ background: '#4C1D95' }}/><span>Tarifa plana</span></div>
              <div className="dv-legend-row"><span className="dv-legend-dot" style={{ background: '#EF9F27' }}/><span>Solo pick-up</span></div>
              <div className="dv-legend-row"><span className="dv-legend-dot" style={{ background: '#D85A30' }}/><span>Por distancia</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: LIQUIDACIONES
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'settlements' ? ' active' : ''}`}>
        <div className="dv-settle-wrap">
          <div className="dv-settle-summary">
            <div className="dv-settle-card">
              <div className="dv-sc-label">Periodo</div>
              <div className="dv-sc-val" style={{ fontSize: 14 }}>Hoy · {new Date().toLocaleDateString('es', { day: 'numeric', month: 'short' })}</div>
            </div>
            <div className="dv-settle-card">
              <div className="dv-sc-label">Entregas totales</div>
              <div className="dv-sc-val">{deliveries.filter(d => d.status !== 'cancelled').length}</div>
            </div>
            <div className="dv-settle-card">
              <div className="dv-sc-label">Total a pagar</div>
              <div className="dv-sc-val">${totalToPay.toFixed(2)}</div>
            </div>
            <div className="dv-settle-card featured">
              <div className="dv-sc-label">Total facturado (fees)</div>
              <div className="dv-sc-val">${totalRevenue.toFixed(2)}</div>
            </div>
          </div>

          {settlements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--dv-ink-muted)', fontSize: 13 }}>
              Sin datos de liquidacion. Asigna despachadores a las entregas para ver sus fees.
            </div>
          ) : (
            <table className="dv-data-table">
              <thead>
                <tr>
                  <th>Despachador</th>
                  <th>Entregas</th>
                  <th>Comision base</th>
                  <th style={{ textAlign: 'right' }}>Total a pagar</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {settlements.map(({ drv, dDels, base, paid, pending }) => (
                  <tr key={drv.id}>
                    <td>
                      <span className="dv-mini-av">{drv.name[0]}</span>
                      <span style={{ fontWeight: 500 }}>{drv.name}</span>
                    </td>
                    <td>{dDels.length}</td>
                    <td>${base.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 14 }}>${pending.toFixed(2)}</td>
                    <td>
                      {pending === 0
                        ? <span className="dv-paid-chip">Pagado</span>
                        : <span className="dv-pending-chip">Pendiente</span>
                      }
                    </td>
                    <td>
                      {pending > 0 && (
                        <button className="dv-btn-mark-paid" onClick={async () => {
                          for (const d of dDels.filter(x => !x.fee_paid && x.driver_fee > 0)) {
                            await markFeePaid(d.id, true)
                          }
                          showToast(`Liquidacion de ${drv.name} marcada como pagada`)
                        }}>
                          Marcar pagado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── QR MODAL ── */}
      {qrDel && (
        <div className="dv-qr-overlay" onClick={() => setQrDel(null)}>
          <div className="dv-qr-modal" onClick={e => e.stopPropagation()}>
            <div className="dv-qr-header">
              <h3>QR de entrega · {qrDel.customer_name}</h3>
              <button className="dv-close-btn" onClick={() => setQrDel(null)}>✕</button>
            </div>
            <div className="dv-qr-body">
              <div className="dv-qr-display">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pickupUrl(qrDel.id))}&margin=10&color=0F172A&bgcolor=FFFFFF`}
                  alt="QR Code"
                />
              </div>
              <div className="dv-qr-timer">
                <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                Expira en {Math.floor(qrSeconds / 60)}:{String(qrSeconds % 60).padStart(2, '0')}
              </div>
              <p className="dv-qr-hint">
                El despachador escanea esto para confirmar la recogida y notificar al cliente
              </p>
              <div className="dv-qr-url">{pickupUrl(qrDel.id)}</div>
            </div>
            <div className="dv-qr-actions">
              <button className="dv-qr-copy-btn" onClick={() => copyLink(trackUrl(qrDel.id))}>
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button className="dv-qr-wa-btn" onClick={() => { sendWhatsApp(qrDel); showToast('WhatsApp abierto') }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar por WhatsApp
              </button>
            </div>
            <div className="dv-qr-footer">
              <span>QR de un solo uso · vinculado a esta entrega</span>
              <button className="dv-btn-primary-sm" onClick={() => setQrDel(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="dv-toast">
          <span className="dv-toast-check">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}
