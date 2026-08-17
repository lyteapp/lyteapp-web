'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import './estado.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'completed' | 'cancelled'

type QueueOrder = {
  id: string
  status: OrderStatus
  customer_name: string
  created_at: string
}

type CustomerDisplay = 'firstName' | 'fullName' | 'code'

type QueueBoardConfig = {
  enabled: boolean
  title: string
  subtitle: string
  preparingLabel: string
  readyLabel: string
  customerDisplay: CustomerDisplay
  showLogo: boolean
}

type StoreInfo = {
  id: string
  name: string
  logo_url: string | null
  accentColor: string
  fontFamily: string
  queueBoard: QueueBoardConfig
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

function displayName(name: string, mode: CustomerDisplay): string {
  if (mode === 'firstName') return name.trim().split(/\s+/)[0] || name
  return name
}

function shortCode(id: string): string {
  return `#${id.slice(-4).toUpperCase()}`
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

  useEffect(() => {
    let cancelled = false
    supabase
      .from('stores')
      .select('id, name, logo_url, template_config')
      .eq('slug', storeSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) { setNotFound(true); setLoading(false); return }
        const tc = (data.template_config as Record<string, unknown>) ?? {}
        const tracking = (tc.trackingConfig as Record<string, unknown>) ?? {}
        const qb = (tracking.queueBoard as Partial<QueueBoardConfig> | undefined) ?? {}
        setStore({
          id: data.id,
          name: data.name,
          logo_url: data.logo_url,
          accentColor: (tracking.accentColor as string) || '#7C3AED',
          fontFamily: (tracking.fontFamily as string) || 'system',
          queueBoard: {
            enabled: qb.enabled === true,
            title: qb.title || 'Estado de pedidos',
            subtitle: qb.subtitle || 'Actualizado en tiempo real',
            preparingLabel: qb.preparingLabel || 'En preparación',
            readyLabel: qb.readyLabel || 'Listo',
            customerDisplay: qb.customerDisplay ?? 'firstName',
            showLogo: qb.showLogo !== false,
          },
        })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [storeSlug])

  const storeId = store?.id
  const enabled = store?.queueBoard.enabled ?? false

  const applyRow = useCallback((row: QueueOrder) => {
    setOrders(prev => {
      const isActive = ACTIVE_STATUSES.includes(row.status) && isWithinWindow(row.created_at)
      if (!isActive) return prev.filter(o => o.id !== row.id)
      const exists = prev.some(o => o.id === row.id)
      const next = exists ? prev.map(o => (o.id === row.id ? row : o)) : [...prev, row]
      return next.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
    })
  }, [])

  useEffect(() => {
    if (!storeId || !enabled) return
    let cancelled = false

    const cutoff = new Date(Date.now() - QUEUE_WINDOW_MS).toISOString()
    supabase
      .from('orders')
      .select('id, status, customer_name, created_at')
      .eq('store_id', storeId)
      .not('status', 'in', '(delivered,cancelled,completed)')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled && data) setOrders(data as QueueOrder[]) })

    const channel = supabase
      .channel(`queue-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setOrders(prev => prev.filter(o => o.id !== old.id))
            return
          }
          applyRow(payload.new as QueueOrder)
        }
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [storeId, enabled, applyRow])

  if (loading) {
    return <div className="oq-state"><div className="oq-spinner" /></div>
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

  const preparing = orders.filter(o => o.status !== 'ready')
  const ready = orders.filter(o => o.status === 'ready')
  const font = FONT_STACKS[store.fontFamily] ?? FONT_STACKS.system

  return (
    <div
      className="oq-wrap"
      style={{ ['--oq-accent' as string]: store.accentColor, fontFamily: font }}
    >
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
        />
        <QueueColumn
          label={store.queueBoard.readyLabel}
          dotColor="#10B981"
          orders={ready}
          customerDisplay={store.queueBoard.customerDisplay}
          accentColor={store.accentColor}
        />
      </div>

      <div className="oq-footer">
        Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a>
      </div>
    </div>
  )
}

function QueueColumn({
  label, dotColor, orders, customerDisplay, accentColor, showTime,
}: {
  label: string
  dotColor: string
  orders: QueueOrder[]
  customerDisplay: CustomerDisplay
  accentColor: string
  showTime?: boolean
}) {
  return (
    <div className="oq-column">
      <div className="oq-column-head">
        <div className="oq-column-dot" style={{ background: dotColor }} />
        <span className="oq-column-label">{label}</span>
        <span className="oq-column-count">{orders.length}</span>
      </div>
      {orders.length === 0 && <div className="oq-empty">Sin pedidos</div>}
      {orders.map(o => (
        <div key={o.id} className="oq-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span className="oq-card-code" style={{ color: accentColor, background: accentColor + '14' }}>
              {shortCode(o.id)}
            </span>
            {customerDisplay !== 'code' && (
              <span className="oq-card-name">{displayName(o.customer_name, customerDisplay)}</span>
            )}
          </div>
          {showTime && <span className="oq-card-time">{minutesAgo(o.created_at)}</span>}
        </div>
      ))}
    </div>
  )
}
