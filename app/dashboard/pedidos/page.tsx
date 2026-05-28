'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/LocaleProvider'
import type { TranslationKey } from '../../lib/i18n'
import './pedidos.css'

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'

interface OrderItem {
  id: string
  product_name: string
  product_price: number
  quantity: number
  subtotal: number
}

interface Order {
  id: string
  customer_name: string
  customer_phone: string
  customer_notes: string | null
  payment_method: string | null
  status: OrderStatus
  total: number
  created_at: string
  delivery_type?: string | null
  items?: OrderItem[]
}

interface DisplayOrder {
  id: string
  created_at: string
  ready_at?: string | null
  delivery_type?: string | null
  customer_name: string
  customer_phone: string
  customer_notes: string | null
  payment_method: string | null
  total: number
  status: string
  order_items: {
    product_name: string; quantity: number; subtotal: number
    selected_options?: {
      variables?: Record<string, string>
      color?: string
      additionals?: { name: string; price: number }[]
      notes?: string
    } | null
  }[]
}

const DISPLAY_STATUS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En proceso',
  ready: 'Listo', completed: 'Completado',
}

const STATUS_KEYS: Record<OrderStatus, TranslationKey> = {
  pending:    'orders.status.pending',
  confirmed:  'orders.status.confirmed',
  processing: 'orders.status.processing',
  ready:      'orders.status.ready',
  delivered:  'orders.status.delivered',
  cancelled:  'orders.status.cancelled',
}

const FILTER_KEYS: { key: 'all' | OrderStatus; tKey: TranslationKey }[] = [
  { key: 'all',       tKey: 'orders.filter.all' },
  { key: 'pending',   tKey: 'orders.filter.pending' },
  { key: 'confirmed', tKey: 'orders.filter.confirmed' },
  { key: 'ready',     tKey: 'orders.filter.ready' },
  { key: 'delivered', tKey: 'orders.filter.delivered' },
  { key: 'cancelled', tKey: 'orders.filter.cancelled' },
]

const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; tKey?: TranslationKey; label?: string; cls: string }>> = {
  pending:    { status: 'confirmed',  label: 'Recibido',   cls: 'confirm' },
  confirmed:  { status: 'processing', label: 'En proceso', cls: 'process' },
  processing: { status: 'ready',      label: 'Listo',      cls: 'ready'   },
}

const DELIVERY_STATUS_MAP: Partial<Record<string, string>> = {
  confirmed: 'preparing', processing: 'preparing',
  ready: 'ready', delivered: 'picked_up', cancelled: 'cancelled',
}

function fmt(n: number) {
  return '$' + n.toFixed(2)
}

function elapsedLabel(createdAt: string, now: number, warnMins: number, alertMins: number): { label: string; level: 'ok' | 'warn' | 'alert' } {
  const mins = Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  const label = mins < 1 ? '< 1 min' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  const level = mins >= alertMins ? 'alert' : mins >= warnMins ? 'warn' : 'ok'
  return { label, level }
}

export default function PedidosPage() {
  const { user } = useAuth()
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const [whatsapp, setWhatsapp] = useState<string>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter]     = useState<'all' | OrderStatus>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [displayMode, setDisplayMode] = useState(false)
  const [displayOrders, setDisplayOrders] = useState<DisplayOrder[]>([])
  const [displayUpdating, setDisplayUpdating] = useState<string | null>(null)
  const [displayLoading, setDisplayLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [warnMins, setWarnMins]   = useState(() => Number(typeof window !== 'undefined' ? (localStorage.getItem('pd-warn-mins') ?? '10') : '10'))
  const [alertMins, setAlertMins] = useState(() => Number(typeof window !== 'undefined' ? (localStorage.getItem('pd-alert-mins') ?? '20') : '20'))
  const [showTimerSettings, setShowTimerSettings] = useState(false)
  const displayModeRef = useRef(false)
  const displayDateRef = useRef('')
  const bcChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadOrders = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
  }, [])

  useEffect(() => {
    if (!user) return
    async function init() {
      const { data: store } = await supabase
        .from('stores')
        .select('id, name, whatsapp')
        .eq('owner_id', user!.id)
        .maybeSingle()
      if (store) {
        setStoreId(store.id)
        setStoreName(store.name ?? '')
        setWhatsapp(store.whatsapp ?? '')
        await loadOrders(store.id)
      }
      setLoading(false)
    }
    init()
  }, [user, loadOrders])

  useEffect(() => { displayModeRef.current = displayMode }, [displayMode])

  useEffect(() => {
    if (!displayMode) return
    const id = setInterval(() => {
      setNow(Date.now())
      if (new Date().toDateString() !== displayDateRef.current) {
        setDisplayOrders([])
        displayDateRef.current = new Date().toDateString()
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [displayMode])

  useEffect(() => {
    const ch = supabase.channel('kitchen-updates')
    ch.subscribe()
    bcChannelRef.current = ch
    return () => { supabase.removeChannel(ch); bcChannelRef.current = null }
  }, [])

  useEffect(() => {
    if (!storeId) return
    const channel = supabase
      .channel(`pedidos-live-${storeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        async (payload) => {
          const newOrder = payload.new as Order
          setOrders(prev => [newOrder, ...prev])
          if (displayModeRef.current) {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
            if (new Date(newOrder.created_at) >= todayStart) {
              await new Promise(r => setTimeout(r, 700))
              const { data: items } = await supabase
                .from('order_items')
                .select('product_name, quantity, subtotal, selected_options')
                .eq('order_id', newOrder.id)
              setDisplayOrders(prev => [
                { ...newOrder, order_items: items ?? [] } as DisplayOrder,
                ...prev,
              ])
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          const updated = payload.new as Order
          setOrders(prev =>
            prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o)
          )
          if (['delivered', 'cancelled', 'completed'].includes(updated.status)) {
            setDisplayOrders(prev => prev.filter(o => o.id !== updated.id))
          } else {
            setDisplayOrders(prev =>
              prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o)
            )
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId])

  async function loadItems(orderId: string) {
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, items: data ?? [] } : o)
    )
  }

  async function toggleExpand(orderId: string) {
    if (expanded === orderId) { setExpanded(null); return }
    setExpanded(orderId)
    const order = orders.find(o => o.id === orderId)
    if (!order?.items) await loadItems(orderId)
  }

  async function syncDelivery(orderId: string, toStatus: string) {
    const { data: del } = await supabase
      .from('deliveries')
      .select('id')
      .eq('order_id', orderId)
      .eq('is_customer_order', true)
      .maybeSingle()
    if (!del) return
    await supabase.from('deliveries').update({ status: toStatus }).eq('id', del.id)
    bcChannelRef.current?.send({
      type: 'broadcast',
      event: 'delivery-status',
      payload: { deliveryId: del.id, status: toStatus },
    })
  }

  function broadcastDrivers(customerName: string | null | undefined) {
    if (!storeId) return
    const body = customerName ? `Pedido de ${customerName}` : 'Nuevo pedido disponible'
    fetch('/api/push-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, title: 'Pedido listo para recoger', body, url: '/driver' }),
    }).catch(() => {})
    fetch('/api/sms-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, customerName, businessName: storeName }),
    }).catch(() => {})
  }

  function notifyDrivers(customerName: string | null | undefined) {
    broadcastDrivers(customerName)
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdating(orderId)
    const order = orders.find(o => o.id === orderId)
    const isPickupOrder = order?.delivery_type === 'pickup'
    const deliveryStatus = isPickupOrder ? undefined : DELIVERY_STATUS_MAP[status]
    const readyAt = status === 'ready' ? new Date().toISOString() : undefined
    await supabase.from('orders').update({ status, ...(readyAt ? { ready_at: readyAt } : {}) }).eq('id', orderId)
    if (deliveryStatus) await syncDelivery(orderId, deliveryStatus).catch(() => {})
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    if (['delivered', 'cancelled', 'completed'].includes(status)) {
      setDisplayOrders(prev => prev.filter(o => o.id !== orderId))
    } else {
      setDisplayOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, ...(readyAt ? { ready_at: readyAt } : {}) } : o))
    }
    if (status === 'ready') {
      const order = orders.find(o => o.id === orderId)
      if (order?.delivery_type !== 'pickup') await notifyDrivers(order?.customer_name)
    }
    setUpdating(null)
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteOrders(ids: string[]) {
    if (!ids.length) return
    const label = ids.length === 1 ? 'este pedido' : `estos ${ids.length} pedidos`
    if (!confirm(`Eliminar ${label}?`)) return
    await supabase.from('order_items').delete().in('order_id', ids)
    await supabase.from('deliveries').delete().in('order_id', ids)
    await supabase.from('orders').delete().in('id', ids)
    setOrders(prev => prev.filter(o => !ids.includes(o.id)))
    setSelectedOrders(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedOrders.size === filtered.length && filtered.length > 0) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filtered.map(o => o.id)))
    }
  }

  async function bulkSetStatus(status: OrderStatus) {
    const ids = Array.from(selectedOrders)
    if (!ids.length) return
    const statusLabel = t(STATUS_KEYS[status])
    const label = ids.length === 1 ? 'este pedido' : `estos ${ids.length} pedidos`
    if (!confirm(`Cambiar ${label} a "${statusLabel}"?`)) return
    const deliveryStatus = DELIVERY_STATUS_MAP[status]
    await Promise.all(
      ids.map(id =>
        Promise.all([
          supabase.from('orders').update({ status }).eq('id', id),
          deliveryStatus ? syncDelivery(id, deliveryStatus).catch(() => {}) : Promise.resolve(),
        ])
      )
    )
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o))
    setSelectedOrders(new Set())
  }

  async function openDisplay() {
    if (!storeId) return
    displayDateRef.current = new Date().toDateString()
    setDisplayMode(true)
    setDisplayLoading(true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, ready_at, delivery_type, customer_name, customer_phone, customer_notes, payment_method, total, status, order_items(product_name, quantity, subtotal, selected_options)')
      .eq('store_id', storeId)
      .not('status', 'in', '(delivered,cancelled,completed)')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: true })
    setDisplayOrders((data ?? []) as DisplayOrder[])
    setDisplayLoading(false)
  }

  async function updateDisplayStatus(orderId: string, status: string) {
    setDisplayUpdating(orderId)
    try {
      const displayOrder = displayOrders.find(o => o.id === orderId)
      const isPickupOrder = displayOrder?.delivery_type === 'pickup'
      const deliveryStatus = isPickupOrder ? undefined : DELIVERY_STATUS_MAP[status]
      const readyAt = status === 'ready' ? new Date().toISOString() : undefined
      await supabase.from('orders').update({ status, ...(readyAt ? { ready_at: readyAt } : {}) }).eq('id', orderId)
      if (deliveryStatus) await syncDelivery(orderId, deliveryStatus).catch(() => {})
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as OrderStatus } : o))
      if (['completed', 'cancelled', 'delivered'].includes(status)) {
        setDisplayOrders(prev => prev.filter(o => o.id !== orderId))
      } else {
        setDisplayOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, ...(readyAt ? { ready_at: readyAt } : {}) } : o))
      }
      if (status === 'ready') {
        const order = orders.find(o => o.id === orderId)
        const displayOrder = displayOrders.find(o => o.id === orderId)
        const isPickup = (displayOrder?.delivery_type ?? order?.delivery_type) === 'pickup'
        if (!isPickup) await notifyDrivers(displayOrder?.customer_name ?? order?.customer_name)
      }
    } finally {
      setDisplayUpdating(null)
    }
  }

  function sendComanda(order: DisplayOrder) {
    const date = new Date(order.created_at)
    const dateStr = date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
    const timeStr = date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    const lines = [
      `*Comanda #${order.id.slice(0, 8).toUpperCase()}*`,
      `${dateStr}, ${timeStr}`, '',
      `*Nombre:* ${order.customer_name}`,
      `*Telefono:* ${order.customer_phone}`,
      ...(order.payment_method ? [`*Pago:* ${order.payment_method}`] : []),
      '', '*Productos:*',
      ...order.order_items.map(i => `  - ${i.quantity}x ${i.product_name}  $${Number(i.subtotal).toFixed(2)}`),
      '', `*Total: $${Number(order.total).toFixed(2)}*`,
      ...(order.customer_notes ? ['', `*Notas:* ${order.customer_notes}`] : []),
    ]
    const num = whatsapp.replace(/\D/g, '')
    const url = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`
      : `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
    window.open(url, '_blank')
  }

  function openWhatsApp(order: Order) {
    const phone = (order.customer_phone ?? '').replace(/\D/g, '')
    const items = order.items?.map(i => `  • ${i.quantity}x ${i.product_name} — ${fmt(i.subtotal)}`).join('\n') ?? ''
    const msg = [
      `Hola ${order.customer_name},`,
      `Te escribimos sobre tu pedido *#${order.id.slice(0, 8).toUpperCase()}*`,
      '',
      items,
      '',
      `*Total: ${fmt(order.total)}*`,
      order.payment_method ? `Pago: ${order.payment_method}` : '',
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function toLocalDate(iso: string): string {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return t('orders.time.now')
    if (m < 60) return t('orders.time.min', { n: String(m) })
    const h = Math.floor(m / 60)
    if (h < 24) return t('orders.time.hour', { n: String(h) })
    const d = Math.floor(h / 24)
    return t('orders.time.day', { n: String(d) })
  }

  const todayStr     = toLocalDate(new Date().toISOString())
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return toLocalDate(d.toISOString()) })()

  const hasDateFilter = !!(dateFrom || dateTo)
  const dateFiltered = hasDateFilter
    ? orders.filter(o => {
        const d = toLocalDate(o.created_at)
        if (dateFrom && d < dateFrom) return false
        if (dateTo   && d > dateTo)   return false
        return true
      })
    : orders
  const filtered = filter === 'all' ? dateFiltered : dateFiltered.filter(o => o.status === filter)

  if (loading) {
    return (
      <div className="pd-spinner-wrap">
        <div className="pd-spinner" />
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="pd-empty">
        <div className="pd-empty-icon"></div>
        <div className="pd-empty-title">{t('orders.noStore.title')}</div>
        <div className="pd-empty-sub">{t('orders.noStore.sub')}</div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ── DATE FILTER BAR ── */}
      <div className="pd-date-bar">
        <button
          className={`pd-date-quick${dateFrom === todayStr && dateTo === todayStr ? ' active' : ''}`}
          onClick={() => {
            if (dateFrom === todayStr && dateTo === todayStr) { setDateFrom(''); setDateTo('') }
            else { setDateFrom(todayStr); setDateTo(todayStr) }
          }}
        >
          Hoy
        </button>
        <button
          className={`pd-date-quick${dateFrom === yesterdayStr && dateTo === yesterdayStr ? ' active' : ''}`}
          onClick={() => {
            if (dateFrom === yesterdayStr && dateTo === yesterdayStr) { setDateFrom(''); setDateTo('') }
            else { setDateFrom(yesterdayStr); setDateTo(yesterdayStr) }
          }}
        >
          Ayer
        </button>
        <div className="pd-date-input-wrap">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="pd-date-icon">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          <input
            type="date"
            className="pd-date-input"
            value={dateFrom}
            max={dateTo || todayStr}
            placeholder="Desde"
            onChange={e => setDateFrom(e.target.value)}
          />
          <span className="pd-date-sep">—</span>
          <input
            type="date"
            className="pd-date-input"
            value={dateTo}
            min={dateFrom || undefined}
            max={todayStr}
            placeholder="Hasta"
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
        {hasDateFilter && (
          <>
            <span className="pd-date-count">{dateFiltered.length} pedido{dateFiltered.length !== 1 ? 's' : ''}</span>
            <button className="pd-date-clear" onClick={() => { setDateFrom(''); setDateTo('') }} title="Quitar filtro">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="pd-header">
        <div className="pd-header-left">
          <div className="pd-count">{filtered.length} {filtered.length === 1 ? t('orders.status.pending').toLowerCase() : t('orders.filter.all').toLowerCase()}</div>
          <div className="pd-hint">{t('orders.hint')}</div>
        </div>
        <div className="pd-filters">
          {FILTER_KEYS.map(f => (
            <button
              key={f.key}
              className={`pd-filter-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {t(f.tKey)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pd-timer-settings-btn" onClick={() => setShowTimerSettings(true)} title="Ajustes de tiempos">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
            </svg>
          </button>
          <button className="pd-display-btn" onClick={openDisplay}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            Display
          </button>
        </div>
      </div>

      {displayMode && (
        <div className="pd-display">
          <div className="pd-display-header">
            <div className="pd-display-title">
              Comandas
              {displayOrders.length > 0 && <span className="pd-display-count">{displayOrders.length}</span>}
            </div>
            <button className="pd-display-close" onClick={() => setDisplayMode(false)}>Cerrar</button>
          </div>
          {displayLoading ? (
            <div className="pd-display-loading"><div className="pd-spinner" /></div>
          ) : displayOrders.length === 0 ? (
            <div className="pd-display-empty">Sin comandas activas</div>
          ) : (() => {
            const inProgress = displayOrders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status))
            const ready = displayOrders.filter(o => o.status === 'ready')
            const renderCard = (order: DisplayOrder) => {
              const timeStr = new Date(order.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
              const { label: elapsed, level: rawLevel } = elapsedLabel(order.created_at, now, warnMins, alertMins)
              const level = order.status === 'ready' ? 'ok' : rawLevel
              const kitchenMins = order.status === 'ready' && order.ready_at
                ? Math.round((new Date(order.ready_at).getTime() - new Date(order.created_at).getTime()) / 60_000)
                : null
              return (
                <div key={order.id} className={`pd-comanda pd-cs-${order.status} pd-comanda-${level}`}>
                  <div className="pd-comanda-head">
                    <div className="pd-comanda-id">#{order.id.slice(0, 8).toUpperCase()}</div>
                    <div className="pd-comanda-time">{timeStr}</div>
                    {kitchenMins !== null
                      ? <span className="pd-comanda-elapsed pd-elapsed-ok pd-kitchen-time">Cocina: {kitchenMins} min</span>
                      : <span className={`pd-comanda-elapsed pd-elapsed-${level}`}>{elapsed}</span>
                    }
                    <span className="pd-comanda-badge">{DISPLAY_STATUS[order.status] ?? order.status}</span>
                  </div>
                  <div className="pd-comanda-customer">
                    <div className="pd-comanda-name">{order.customer_name}</div>
                    <div className="pd-comanda-phone">{order.customer_phone}</div>
                  </div>
                  <div className="pd-comanda-items">
                    {order.order_items.map((item, i) => {
                      const opts = item.selected_options
                      return (
                        <div key={i} className="pd-comanda-item">
                          <span className="pd-comanda-qty">{item.quantity}x</span>
                          <div className="pd-comanda-item-body">
                            <div className="pd-comanda-item-row">
                              <span className="pd-comanda-pname">{item.product_name}</span>
                              <span className="pd-comanda-price">${Number(item.subtotal).toFixed(2)}</span>
                            </div>
                            {opts && (
                              <div className="pd-comanda-item-opts">
                                {opts.variables && Object.entries(opts.variables).map(([k, v], idx) => (
                                  <span key={k} className={`pd-comanda-opt-tag pd-comanda-opt-c${idx % 6}`}>
                                    <span className="pd-comanda-opt-tag-key">{k}:</span>{v}
                                  </span>
                                ))}
                                {opts.color && (
                                  <span className={`pd-comanda-opt-tag pd-comanda-opt-c${Object.keys(opts.variables ?? {}).length % 6}`}>
                                    <span className="pd-comanda-opt-tag-key">Color:</span>{opts.color}
                                  </span>
                                )}
                                {opts.additionals?.map((a, j) => (
                                  <span key={j} className="pd-comanda-opt-add">+ {a.name} ${Number(a.price).toFixed(2)}</span>
                                ))}
                                {opts.notes && <span className="pd-comanda-opt-note">{opts.notes}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="pd-comanda-total">${Number(order.total).toFixed(2)}</div>
                  {order.customer_notes && (
                    <div className="pd-comanda-notes">{order.customer_notes}</div>
                  )}
                  <div className="pd-comanda-actions">
                    {order.status === 'pending' && (
                      <button className="pd-comanda-btn confirm" disabled={displayUpdating === order.id} onClick={() => updateDisplayStatus(order.id, 'confirmed')}>
                        {displayUpdating === order.id ? '...' : (<>Marcar recibido <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg></>)}
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button className="pd-comanda-btn process" disabled={displayUpdating === order.id} onClick={() => updateDisplayStatus(order.id, 'processing')}>
                        {displayUpdating === order.id ? '...' : (<>En proceso <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg></>)}
                      </button>
                    )}
                    {order.status === 'processing' && (
                      <button className="pd-comanda-btn ready" disabled={displayUpdating === order.id} onClick={() => updateDisplayStatus(order.id, 'ready')}>
                        {displayUpdating === order.id ? '...' : (<>Marcar listo <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></>)}
                      </button>
                    )}
                  </div>
                </div>
              )
            }
            return (
              <div className="pd-display-body">
                {inProgress.length > 0 && (
                  <div className="pd-display-section">
                    <div className="pd-display-section-title">En preparacion</div>
                    <div className="pd-display-grid">{inProgress.map(renderCard)}</div>
                  </div>
                )}
                {ready.length > 0 && (
                  <div className="pd-display-section pd-display-section--ready">
                    <div className="pd-display-section-title">Listos</div>
                    <div className="pd-display-grid">{ready.map(renderCard)}</div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      <div className="pd-bulk-bar">
        <button
          className={`pd-bulk-select-all${selectedOrders.size > 0 && selectedOrders.size === filtered.length ? ' active' : ''}`}
          onClick={toggleSelectAll}
        >
          {selectedOrders.size > 0 && selectedOrders.size === filtered.length ? 'Deseleccionar' : 'Seleccionar todos'}
        </button>
        {selectedOrders.size > 0 && (
          <>
            <span className="pd-bulk-count">{selectedOrders.size} seleccionado{selectedOrders.size !== 1 ? 's' : ''}</span>
            <select
              className="pd-bulk-select"
              defaultValue=""
              onChange={e => {
                const val = e.target.value as OrderStatus
                if (val) { bulkSetStatus(val); e.target.value = '' }
              }}
            >
              <option value="" disabled>Cambiar estado...</option>
              <option value="confirmed">Recibido</option>
              <option value="processing">En proceso</option>
              <option value="ready">Listo</option>
              <option value="cancelled">Cancelar</option>
            </select>
            <button className="pd-bulk-btn delete" onClick={() => deleteOrders(Array.from(selectedOrders))}>
              Eliminar
            </button>
            <button className="pd-bulk-clear" onClick={() => setSelectedOrders(new Set())}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="pd-empty">
          <div className="pd-empty-icon"></div>
          <div className="pd-empty-title">
            {filter !== 'all' ? t('orders.empty.titleFiltered') : t('orders.empty.title')}
          </div>
          <div className="pd-empty-sub">
            {filter === 'all' ? t('orders.empty.subAll') : t('orders.empty.subFiltered')}
          </div>
        </div>
      ) : (
        <div className="pd-list">
          {filtered.map(order => {
            const isExpanded = expanded === order.id
            const advance = NEXT_STATUS[order.status]
            const isBusy = updating === order.id

            return (
              <div key={order.id} className={`pd-card${selectedOrders.has(order.id) ? ' selected' : ''}`}>
                <div className="pd-card-header" onClick={() => toggleExpand(order.id)}>
                  <div
                    className={`pd-checkbox${selectedOrders.has(order.id) ? ' checked' : ''}`}
                    onClick={e => toggleSelect(order.id, e)}
                    role="checkbox"
                    aria-checked={selectedOrders.has(order.id)}
                  />
                  <div className="pd-order-id">#{order.id.slice(0, 8).toUpperCase()}</div>
                  <div className="pd-customer">
                    <div className="pd-customer-name">{order.customer_name}</div>
                    <div className="pd-customer-phone">{order.customer_phone}</div>
                  </div>
                  <div className="pd-total">{fmt(order.total)}</div>
                  <div className={`pd-status ${order.status}`}>{t(STATUS_KEYS[order.status])}</div>
                  <svg className={`pd-chevron${isExpanded ? ' open' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="pd-card-body">
                    {order.items === undefined ? (
                      <div className="pd-spinner-wrap" style={{ minHeight: 60 }}>
                        <div className="pd-spinner" />
                      </div>
                    ) : (
                      <>
                        <div className="pd-items-title">{t('orders.items')}</div>
                        <div className="pd-items">
                          {order.items.map(item => (
                            <div key={item.id} className="pd-item">
                              <div className="pd-item-qty">{item.quantity}</div>
                              <div className="pd-item-name">{item.product_name}</div>
                              <div className="pd-item-price">{fmt(item.subtotal)}</div>
                            </div>
                          ))}
                        </div>

                        <div className="pd-meta">
                          {order.payment_method && (
                            <div className="pd-meta-chip">
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                              </svg>
                              {order.payment_method}
                            </div>
                          )}
                          {order.customer_notes && (
                            <div className="pd-meta-chip notes">
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                              </svg>
                              {order.customer_notes}
                            </div>
                          )}
                        </div>

                        <div className="pd-actions">
                          {advance && (
                            <button
                              className={`pd-action-btn ${advance.cls}`}
                              disabled={isBusy}
                              onClick={() => updateStatus(order.id, advance.status)}
                            >
                              {isBusy ? '...' : (advance.label ?? t(advance.tKey!))}
                            </button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <button
                              className="pd-action-btn cancel"
                              disabled={isBusy}
                              onClick={() => {
                                if (confirm(t('orders.action.cancelConfirm'))) updateStatus(order.id, 'cancelled')
                              }}
                            >
                              {t('orders.action.cancel')}
                            </button>
                          )}
                          <button
                            className="pd-action-btn wa"
                            onClick={() => {
                              if (!order.items) loadItems(order.id).then(() => openWhatsApp(order))
                              else openWhatsApp(order)
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                              <path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.522 3.66 1.432 5.168L2 22l4.975-1.395A9.944 9.944 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                            </svg>
                            WhatsApp
                          </button>
                          <button
                            className="pd-action-btn delete"
                            disabled={isBusy}
                            onClick={() => deleteOrders([order.id])}
                          >
                            Eliminar
                          </button>
                          <span className="pd-date">{timeAgo(order.created_at)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showTimerSettings && createPortal(
        <div className="pd-modal-overlay" onClick={() => setShowTimerSettings(false)}>
          <div className="pd-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-title">Tiempos del display</div>
                <div className="pd-modal-desc">Minutos para cambiar el color del pedido</div>
              </div>
              <button className="pd-modal-x" onClick={() => setShowTimerSettings(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>

            {/* Threshold rows */}
            {([
              { key: 'warn',  label: 'Advertencia', color: '#F59E0B', val: warnMins,  min: 1,            max: alertMins - 1,
                set: (v: number) => { setWarnMins(v);  localStorage.setItem('pd-warn-mins',  String(v)) } },
              { key: 'alert', label: 'Alerta',       color: '#EF4444', val: alertMins, min: warnMins + 1, max: 120,
                set: (v: number) => { setAlertMins(v); localStorage.setItem('pd-alert-mins', String(v)) } },
            ] as const).map(row => (
              <div key={row.key} className="pd-modal-row">
                <div className="pd-modal-row-left">
                  <span className="pd-modal-swatch" style={{ background: row.color }} />
                  <span className="pd-modal-row-label">{row.label}</span>
                </div>
                <div className="pd-modal-stepper">
                  <button className="pd-modal-step-btn" onClick={() => row.set(Math.max(row.min, row.val - 1))}>−</button>
                  <span className="pd-modal-step-val">{row.val} min</span>
                  <button className="pd-modal-step-btn" onClick={() => row.set(Math.min(row.max, row.val + 1))}>+</button>
                </div>
              </div>
            ))}

            {/* Visual summary */}
            <div className="pd-modal-summary">
              <div className="pd-modal-summary-item ok">Verde hasta {warnMins} min</div>
              <div className="pd-modal-summary-item warn">{warnMins}–{alertMins} min amarillo</div>
              <div className="pd-modal-summary-item alert">Rojo desde {alertMins} min</div>
            </div>

          </div>
        </div>
      , document.body)}
    </div>
  )
}
