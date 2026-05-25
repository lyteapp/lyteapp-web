'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './delivery.css'

type Status = 'ready' | 'picked_up' | 'delivered' | 'cancelled'

type Driver = {
  id: string; name: string; phone: string | null
  is_active: boolean; notes: string | null; created_at: string
}

type Delivery = {
  id: string; store_id: string; order_ref: string | null
  driver_id: string | null; customer_name: string
  customer_phone: string; delivery_address: string
  status: Status; driver_fee: number; fee_paid: boolean
  notes: string | null; picked_up_at: string | null
  delivered_at: string | null; created_at: string
  driver?: Driver | null
}

const STATUS_LABEL: Record<string, string> = {
  ready: 'Listo', picked_up: 'En camino',
  delivered: 'Entregado', cancelled: 'Cancelado',
}
const STATUS_CLS: Record<string, string> = {
  ready: 'dl-badge-ready', picked_up: 'dl-badge-transit',
  delivered: 'dl-badge-done', cancelled: 'dl-badge-cancelled',
}
const BASE_URL = 'https://lyte-app.com'

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Ahora'
  if (m < 60) return `Hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

export default function DeliveryPage() {
  const { user } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [storeId, setStoreId]   = useState<string | null>(null)
  const [tab, setTab]           = useState<'deliveries' | 'drivers' | 'payments'>('deliveries')
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [filter, setFilter]     = useState<'active' | 'all' | Status>('active')

  // new delivery form
  const [showForm, setShowForm] = useState(false)
  const [fCustomer, setFCustomer] = useState('')
  const [fPhone, setFPhone]       = useState('')
  const [fAddress, setFAddress]   = useState('')
  const [fDriverId, setFDriverId] = useState('')
  const [fFee, setFFee]           = useState('')
  const [fNotes, setFNotes]       = useState('')
  const [fRef, setFRef]           = useState('')
  const [fSaving, setFSaving]     = useState(false)

  // driver form
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [editDriver, setEditDriver]         = useState<Driver | null>(null)
  const [dName, setDName]   = useState('')
  const [dPhone, setDPhone] = useState('')
  const [dSaving, setDSaving] = useState(false)

  // QR modal
  const [qrDel, setQrDel]   = useState<Delivery | null>(null)
  const [copied, setCopied] = useState(false)

  // action state
  const [updatingId, setUpdatingId]   = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const trackUrl = (id: string) => `${BASE_URL}/delivery/${id}`

  const loadData = useCallback(async (sid: string) => {
    const [{ data: dels }, { data: drvs }] = await Promise.all([
      supabase
        .from('deliveries')
        .select('*, driver:driver_id(id,name,phone,is_active)')
        .eq('store_id', sid)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('delivery_drivers')
        .select('*')
        .eq('store_id', sid)
        .order('name'),
    ])
    setDeliveries((dels as Delivery[]) ?? [])
    setDrivers(drvs ?? [])
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
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, loadData])

  function resetForm() {
    setFCustomer(''); setFPhone(''); setFAddress('')
    setFDriverId(''); setFFee(''); setFNotes(''); setFRef('')
  }

  async function createDelivery() {
    if (!storeId || !fCustomer.trim() || !fAddress.trim()) return
    setFSaving(true)
    await supabase.from('deliveries').insert({
      store_id: storeId,
      customer_name: fCustomer.trim(),
      customer_phone: fPhone.trim(),
      delivery_address: fAddress.trim(),
      driver_id: fDriverId || null,
      driver_fee: parseFloat(fFee) || 0,
      notes: fNotes.trim() || null,
      order_ref: fRef.trim() || null,
      status: 'ready',
    })
    resetForm(); setShowForm(false); setFSaving(false)
    await loadData(storeId)
  }

  async function updateStatus(del: Delivery, status: Status) {
    setUpdatingId(del.id)
    const patch: Record<string, unknown> = { status }
    if (status === 'picked_up') patch.picked_up_at = new Date().toISOString()
    if (status === 'delivered') patch.delivered_at = new Date().toISOString()
    await supabase.from('deliveries').update(patch).eq('id', del.id)
    setDeliveries(p => p.map(d => d.id === del.id ? { ...d, ...patch } as Delivery : d))
    setUpdatingId(null)
  }

  async function assignDriver(delId: string, drvId: string) {
    setAssigningId(delId)
    await supabase.from('deliveries').update({ driver_id: drvId || null }).eq('id', delId)
    await loadData(storeId!)
    setAssigningId(null)
  }

  async function saveDriver() {
    if (!storeId || !dName.trim()) return
    setDSaving(true)
    if (editDriver) {
      await supabase.from('delivery_drivers').update({ name: dName.trim(), phone: dPhone.trim() || null }).eq('id', editDriver.id)
    } else {
      await supabase.from('delivery_drivers').insert({ store_id: storeId, name: dName.trim(), phone: dPhone.trim() || null })
    }
    setDName(''); setDPhone(''); setEditDriver(null); setShowDriverForm(false); setDSaving(false)
    await loadData(storeId)
  }

  async function toggleDriver(drv: Driver) {
    await supabase.from('delivery_drivers').update({ is_active: !drv.is_active }).eq('id', drv.id)
    setDrivers(p => p.map(d => d.id === drv.id ? { ...d, is_active: !drv.is_active } : d))
  }

  async function deleteDriver(id: string) {
    if (!confirm('Eliminar motorista?')) return
    await supabase.from('delivery_drivers').delete().eq('id', id)
    setDrivers(p => p.filter(d => d.id !== id))
  }

  async function markPaid(delId: string, paid: boolean) {
    await supabase.from('deliveries').update({ fee_paid: paid }).eq('id', delId)
    setDeliveries(p => p.map(d => d.id === delId ? { ...d, fee_paid: paid } : d))
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function sendWhatsApp(del: Delivery) {
    const url = trackUrl(del.id)
    const msg = `Hola ${del.customer_name}, tu pedido ya va en camino! Puedes seguirlo aqui: ${url}`
    window.open(`https://wa.me/${(del.customer_phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const filtered = deliveries.filter(d =>
    filter === 'active' ? ['ready', 'picked_up'].includes(d.status)
    : filter === 'all' ? true
    : d.status === filter
  )

  const paymentByDriver = drivers.map(drv => {
    const dDels = deliveries.filter(d => d.driver_id === drv.id && d.status !== 'cancelled')
    const total   = dDels.reduce((s, d) => s + Number(d.driver_fee), 0)
    const paid    = dDels.filter(d => d.fee_paid).reduce((s, d) => s + Number(d.driver_fee), 0)
    return { drv, dDels, total, paid, pending: total - paid }
  }).filter(p => p.total > 0 || p.dDels.length > 0)

  const activeCount = deliveries.filter(d => ['ready', 'picked_up'].includes(d.status)).length
  const readyCount  = deliveries.filter(d => d.status === 'ready').length
  const hasPendingPayments = paymentByDriver.some(p => p.pending > 0)

  if (loading) return <div className="dl-spinner-wrap"><div className="dl-spinner" /></div>
  if (!storeId) return (
    <div className="db-panel" style={{ maxWidth: 480 }}>
      <div className="db-empty">
        <div className="db-empty-title">No tienes una tienda aun</div>
        <a href="/dashboard/tienda" className="db-empty-btn">Crear tienda</a>
      </div>
    </div>
  )

  return (
    <div className="dl-wrap">
      {/* Header */}
      <div className="dl-header">
        <div>
          <h1 className="dl-title">Delivery</h1>
          <div className="dl-sub">
            {activeCount > 0 ? `${activeCount} activa${activeCount !== 1 ? 's' : ''}` : 'Sin entregas activas'}
            {deliveries.filter(d => d.status === 'delivered').length > 0 && ` · ${deliveries.filter(d => d.status === 'delivered').length} entregadas`}
          </div>
        </div>
        <button className="dl-btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
          + Nueva entrega
        </button>
      </div>

      {/* Tabs */}
      <div className="dl-tabs">
        <button className={`dl-tab${tab === 'deliveries' ? ' active' : ''}`} onClick={() => setTab('deliveries')}>
          Entregas
          {readyCount > 0 && <span className="dl-tab-badge">{readyCount}</span>}
        </button>
        <button className={`dl-tab${tab === 'drivers' ? ' active' : ''}`} onClick={() => setTab('drivers')}>
          Motoristas
        </button>
        <button className={`dl-tab${tab === 'payments' ? ' active' : ''}`} onClick={() => setTab('payments')}>
          Pagos
          {hasPendingPayments && <span className="dl-tab-dot" />}
        </button>
      </div>

      {/* ── ENTREGAS ── */}
      {tab === 'deliveries' && (
        <div>
          <div className="dl-filters">
            {(['active', 'ready', 'picked_up', 'delivered', 'all'] as const).map(f => (
              <button key={f} className={`dl-filter${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'active' ? 'Activas' : f === 'all' ? 'Todas' : STATUS_LABEL[f]}
                {f === 'active' && activeCount > 0 && <span className="dl-filter-count">{activeCount}</span>}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="dl-empty">
              <div className="dl-empty-icon">
                <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="32" cy="32" r="26" strokeDasharray="4 3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 32l8 8 16-16" />
                </svg>
              </div>
              <div className="dl-empty-title">No hay entregas {filter === 'active' ? 'activas' : ''}</div>
              <div className="dl-empty-sub">Crea una nueva entrega para empezar</div>
              <button className="dl-btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
                + Nueva entrega
              </button>
            </div>
          ) : (
            <div className="dl-list">
              {filtered.map(del => (
                <div key={del.id} className={`dl-card dl-card-${del.status}`}>
                  {/* Left: status + time */}
                  <div className="dl-card-left">
                    <span className={`dl-badge ${STATUS_CLS[del.status]}`}>{STATUS_LABEL[del.status]}</span>
                    <div className="dl-card-time">{timeAgo(del.created_at)}</div>
                    {del.order_ref && <div className="dl-card-ref">{del.order_ref}</div>}
                  </div>

                  {/* Center: customer info */}
                  <div className="dl-card-center">
                    <div className="dl-card-customer">{del.customer_name}</div>
                    {del.customer_phone && (
                      <a className="dl-card-phone" href={`tel:${del.customer_phone}`}>{del.customer_phone}</a>
                    )}
                    {del.delivery_address && (
                      <div className="dl-card-address">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style={{ flexShrink: 0, marginTop: 2 }}>
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {del.delivery_address}
                      </div>
                    )}
                    {del.notes && <div className="dl-card-notes">{del.notes}</div>}
                  </div>

                  {/* Right: driver + actions */}
                  <div className="dl-card-right">
                    <div className="dl-card-driver-info">
                      {del.driver ? (
                        <div className="dl-driver-chip">
                          <div className="dl-driver-avatar">{(del.driver as Driver).name[0]}</div>
                          {(del.driver as Driver).name}
                        </div>
                      ) : (
                        <div className="dl-unassigned">Sin motorista</div>
                      )}
                      {del.driver_fee > 0 && (
                        <div className={`dl-fee${del.fee_paid ? ' paid' : ''}`}>
                          ${Number(del.driver_fee).toFixed(2)}{del.fee_paid ? ' ✓' : ''}
                        </div>
                      )}
                    </div>

                    <div className="dl-card-actions">
                      {del.status === 'ready' && (
                        <button className="dl-btn-qr" onClick={() => setQrDel(del)}>
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1zM11 13a1 1 0 011-1h1v1h1v-1h1a1 1 0 110 2h-1v1h-1v-1h-1a1 1 0 01-1-1zm3 2v-1h1v1h-1z" clipRule="evenodd" />
                          </svg>
                          QR
                        </button>
                      )}
                      {del.status !== 'delivered' && del.status !== 'cancelled' && (
                        <select
                          className="dl-driver-select"
                          value={del.driver_id ?? ''}
                          onChange={e => assignDriver(del.id, e.target.value)}
                          disabled={assigningId === del.id}
                        >
                          <option value="">Sin motorista</option>
                          {drivers.filter(d => d.is_active).map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      )}
                      {del.status === 'ready' && (
                        <button className="dl-btn-action" onClick={() => updateStatus(del, 'picked_up')} disabled={updatingId === del.id}>
                          Recogido
                        </button>
                      )}
                      {del.status === 'picked_up' && (
                        <>
                          <button className="dl-btn-wa" onClick={() => sendWhatsApp(del)} title="Enviar tracking por WhatsApp">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </button>
                          <button className="dl-btn-action dl-btn-deliver" onClick={() => updateStatus(del, 'delivered')} disabled={updatingId === del.id}>
                            Entregado
                          </button>
                        </>
                      )}
                      {del.status === 'delivered' && !del.fee_paid && del.driver_fee > 0 && (
                        <button className="dl-btn-pay" onClick={() => markPaid(del.id, true)}>Pagar fee</button>
                      )}
                      {(del.status === 'ready' || del.status === 'picked_up') && (
                        <button className="dl-btn-x" onClick={() => updateStatus(del, 'cancelled')} disabled={updatingId === del.id} title="Cancelar">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MOTORISTAS ── */}
      {tab === 'drivers' && (
        <div>
          <div className="dl-section-head">
            <div>
              <div className="dl-section-title">Motoristas</div>
              <div className="dl-section-sub">{drivers.filter(d => d.is_active).length} activos</div>
            </div>
            <button className="dl-btn-primary" onClick={() => { setDName(''); setDPhone(''); setEditDriver(null); setShowDriverForm(true) }}>
              + Agregar motorista
            </button>
          </div>

          {showDriverForm && (
            <div className="dl-driver-form-card">
              <div className="dl-form-title">{editDriver ? 'Editar motorista' : 'Nuevo motorista'}</div>
              <div className="dl-form-row2">
                <div className="dl-form-field">
                  <label className="dl-form-label">Nombre *</label>
                  <input className="dl-input" value={dName} onChange={e => setDName(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="dl-form-field">
                  <label className="dl-form-label">Telefono</label>
                  <input className="dl-input" value={dPhone} onChange={e => setDPhone(e.target.value)} placeholder="+58 412 000 0000" type="tel" />
                </div>
              </div>
              <div className="dl-form-actions">
                <button className="dl-btn-ghost" onClick={() => setShowDriverForm(false)}>Cancelar</button>
                <button className="dl-btn-primary" onClick={saveDriver} disabled={dSaving || !dName.trim()}>
                  {dSaving ? 'Guardando...' : editDriver ? 'Guardar cambios' : 'Agregar motorista'}
                </button>
              </div>
            </div>
          )}

          {drivers.length === 0 ? (
            <div className="dl-empty">
              <div className="dl-empty-title">No hay motoristas registrados</div>
              <div className="dl-empty-sub">Agrega tu equipo de delivery para asignar entregas</div>
            </div>
          ) : (
            <div className="dl-driver-list">
              {drivers.map(drv => {
                const dDels = deliveries.filter(d => d.driver_id === drv.id && d.status !== 'cancelled')
                const pending = dDels.filter(d => !d.fee_paid).reduce((s, d) => s + Number(d.driver_fee), 0)
                return (
                  <div key={drv.id} className={`dl-driver-card${!drv.is_active ? ' inactive' : ''}`}>
                    <div className="dl-driver-avatar-lg">{drv.name[0].toUpperCase()}</div>
                    <div className="dl-driver-info">
                      <div className="dl-driver-name">{drv.name}</div>
                      {drv.phone && <div className="dl-driver-phone">{drv.phone}</div>}
                      <div className="dl-driver-stats">
                        <span>{dDels.length} entrega{dDels.length !== 1 ? 's' : ''}</span>
                        {pending > 0 && <span className="dl-stat-pending">${pending.toFixed(2)} pendiente</span>}
                      </div>
                    </div>
                    <div className="dl-driver-actions">
                      <div className={`dl-toggle${drv.is_active ? ' on' : ''}`} onClick={() => toggleDriver(drv)} title={drv.is_active ? 'Activo' : 'Inactivo'}>
                        <div className="dl-toggle-knob" />
                      </div>
                      <button className="dl-btn-edit" onClick={() => { setEditDriver(drv); setDName(drv.name); setDPhone(drv.phone ?? ''); setShowDriverForm(true) }}>
                        Editar
                      </button>
                      <button className="dl-btn-x" onClick={() => deleteDriver(drv.id)}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PAGOS ── */}
      {tab === 'payments' && (
        <div>
          <div className="dl-section-head">
            <div>
              <div className="dl-section-title">Control de pagos</div>
              <div className="dl-section-sub">Fees de delivery por motorista</div>
            </div>
          </div>

          {paymentByDriver.length === 0 ? (
            <div className="dl-empty">
              <div className="dl-empty-title">Sin datos de pagos</div>
              <div className="dl-empty-sub">Asigna motoristas a tus entregas para ver los fees aqui</div>
            </div>
          ) : (
            <div className="dl-payment-list">
              {paymentByDriver.map(({ drv, dDels, total, paid, pending }) => (
                <div key={drv.id} className="dl-payment-card">
                  <div className="dl-payment-head">
                    <div className="dl-driver-chip">
                      <div className="dl-driver-avatar">{drv.name[0]}</div>
                      {drv.name}
                    </div>
                    <div className="dl-payment-stats">
                      <div className="dl-pstat">
                        <div className="dl-pstat-label">Total acumulado</div>
                        <div className="dl-pstat-val">${total.toFixed(2)}</div>
                      </div>
                      <div className="dl-pstat">
                        <div className="dl-pstat-label">Pagado</div>
                        <div className="dl-pstat-val dl-green">${paid.toFixed(2)}</div>
                      </div>
                      <div className="dl-pstat">
                        <div className="dl-pstat-label">Pendiente</div>
                        <div className={`dl-pstat-val ${pending > 0 ? 'dl-amber' : 'dl-green'}`}>${pending.toFixed(2)}</div>
                      </div>
                    </div>
                    {pending > 0 && (
                      <button className="dl-btn-liquidar" onClick={async () => {
                        for (const d of dDels.filter(d => !d.fee_paid && d.driver_fee > 0)) await markPaid(d.id, true)
                      }}>
                        Liquidar todo
                      </button>
                    )}
                  </div>

                  <div className="dl-payment-rows">
                    {dDels.filter(d => d.driver_fee > 0).map(d => (
                      <div key={d.id} className="dl-payment-row">
                        <div className="dl-payment-row-info">
                          <span className="dl-payment-row-name">{d.customer_name}</span>
                          <span className="dl-payment-row-meta">{timeAgo(d.created_at)} · <span className={`dl-badge ${STATUS_CLS[d.status]}`} style={{ fontSize: 10, padding: '2px 7px' }}>{STATUS_LABEL[d.status]}</span></span>
                        </div>
                        <div className="dl-payment-row-fee">${Number(d.driver_fee).toFixed(2)}</div>
                        <button className={`dl-payment-row-btn${d.fee_paid ? ' paid' : ''}`} onClick={() => markPaid(d.id, !d.fee_paid)}>
                          {d.fee_paid ? 'Pagado ✓' : 'Pagar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Nueva entrega ── */}
      {showForm && (
        <div className="dl-overlay" onClick={() => setShowForm(false)}>
          <div className="dl-panel" onClick={e => e.stopPropagation()}>
            <div className="dl-panel-head">
              <h3 className="dl-panel-title">Nueva entrega</h3>
              <button className="dl-close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="dl-panel-body">
              <div className="dl-form-field">
                <label className="dl-form-label">Cliente *</label>
                <input className="dl-input" value={fCustomer} onChange={e => setFCustomer(e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="dl-form-field">
                <label className="dl-form-label">Telefono (WhatsApp)</label>
                <input className="dl-input" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="+58 412 000 0000" type="tel" />
              </div>
              <div className="dl-form-field">
                <label className="dl-form-label">Direccion de entrega *</label>
                <textarea className="dl-textarea" value={fAddress} onChange={e => setFAddress(e.target.value)} placeholder="Urb. Las Mercedes, Torre A, Apt 3B..." rows={2} />
              </div>
              <div className="dl-form-row2">
                <div className="dl-form-field">
                  <label className="dl-form-label">Motorista</label>
                  <select className="dl-select" value={fDriverId} onChange={e => setFDriverId(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {drivers.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="dl-form-field">
                  <label className="dl-form-label">Fee del motorista ($)</label>
                  <input className="dl-input" value={fFee} onChange={e => setFFee(e.target.value)} type="number" min="0" step="0.50" placeholder="0.00" />
                </div>
              </div>
              <div className="dl-form-field">
                <label className="dl-form-label">Referencia de pedido</label>
                <input className="dl-input" value={fRef} onChange={e => setFRef(e.target.value)} placeholder="#001, pedido WA..." />
              </div>
              <div className="dl-form-field">
                <label className="dl-form-label">Notas</label>
                <textarea className="dl-textarea" value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Instrucciones especiales para el motorista..." rows={2} />
              </div>
            </div>
            <div className="dl-panel-foot">
              <button className="dl-btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="dl-btn-primary" onClick={createDelivery} disabled={fSaving || !fCustomer.trim() || !fAddress.trim()}>
                {fSaving ? 'Creando...' : 'Crear entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR MODAL ── */}
      {qrDel && (
        <div className="dl-qr-overlay" onClick={() => setQrDel(null)}>
          <div className="dl-qr-modal" onClick={e => e.stopPropagation()}>
            <div className="dl-qr-modal-head">
              <div className="dl-qr-modal-title">QR de entrega</div>
              <button className="dl-close-btn" onClick={() => setQrDel(null)}>✕</button>
            </div>
            <div className="dl-qr-customer-name">{qrDel.customer_name}</div>
            {qrDel.delivery_address && <div className="dl-qr-address">{qrDel.delivery_address}</div>}
            <div className="dl-qr-img-wrap">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(trackUrl(qrDel.id))}&margin=10&color=0F172A&bgcolor=FFFFFF`}
                alt="QR Code"
                className="dl-qr-img"
              />
            </div>
            <div className="dl-qr-hint">El motorista escanea esto para confirmar la recogida y notificar al cliente</div>
            <div className="dl-qr-url">{trackUrl(qrDel.id)}</div>
            <div className="dl-qr-actions">
              <button className="dl-btn-copy" onClick={() => copyLink(trackUrl(qrDel.id))}>
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button className="dl-btn-wa-lg" onClick={() => sendWhatsApp(qrDel)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
