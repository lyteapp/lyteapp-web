'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import './casillero.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'completed' | 'cancelled'

type LockerOrder = {
  id: string
  order_number: number | null
  customer_name: string
  locker_number: number | null
  status: OrderStatus
  /** when its locker was last announced again (from this screen or another) */
  locker_notified_at?: string | null
}

// How long an announcement takes on the queue board (its 9s, plus a beat):
// "Volver a anunciar" waits that long before it can be pressed again
const ANNOUNCE_WINDOW_MS = 10000

type StoreInfo = {
  id: string
  name: string
  logo_url: string | null
  accentColor: string
  lockerCount: number
}

export default function CasilleroPage() {
  const params = useParams()
  const storeId = params.storeId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [orders, setOrders] = useState<LockerOrder[]>([])
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<LockerOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  // "Volver a anunciar" went out at this moment, per order (on top of what
  // the order itself says, which also covers another locker screen)
  const [sentAt, setSentAt] = useState<Record<string, number>>({})
  // ticks once a second while an announcement is going, for its countdown
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    supabase
      .from('stores')
      .select('id, name, logo_url, template_config, checkout_settings')
      .eq('id', storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) { setNotFound(true); setLoading(false); return }
        const tc = (data.template_config as Record<string, unknown>) ?? {}
        const cs = (data.checkout_settings as Record<string, unknown>) ?? {}
        const lm = (cs.lockerMode as { enabled?: boolean; count?: number } | undefined) ?? {}
        const tracking = (tc.trackingConfig as Record<string, unknown>) ?? {}
        setStore({
          id: data.id,
          name: data.name,
          logo_url: data.logo_url,
          accentColor: (tracking.accentColor as string) || '#7C3AED',
          lockerCount: lm.enabled ? (lm.count ?? 0) : 0,
        })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [storeId])

  const applyRow = useCallback((row: LockerOrder) => {
    setOrders(prev => {
      const isActive = row.status === 'ready'
      if (!isActive) return prev.filter(o => o.id !== row.id)
      const exists = prev.some(o => o.id === row.id)
      return exists ? prev.map(o => (o.id === row.id ? row : o)) : [...prev, row]
    })
  }, [])

  useEffect(() => {
    if (!store || store.lockerCount === 0) return
    let cancelled = false

    supabase
      .from('orders')
      .select('id, order_number, customer_name, locker_number, status, locker_notified_at')
      .eq('store_id', storeId)
      .eq('status', 'ready')
      .then(({ data }) => { if (!cancelled && data) setOrders(data as LockerOrder[]) })

    const channel = supabase
      .channel(`casillero-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setOrders(prev => prev.filter(o => o.id !== old.id))
            return
          }
          applyRow(payload.new as LockerOrder)
        }
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [store, storeId, applyRow])

  async function assignLocker(lockerNumber: number) {
    if (!selectedPendingId || busy) return
    setBusy(true); setActionError('')
    try {
      const res = await fetch('/api/casillero/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedPendingId, storeId, lockerNumber }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setActionError(data.error ?? 'No se pudo asignar el casillero'); return }
      setOrders(prev => prev.map(o => o.id === selectedPendingId ? { ...o, locker_number: lockerNumber } : o))
      setSelectedPendingId(null)
    } catch {
      setActionError('No se pudo conectar con el servidor')
    } finally {
      setBusy(false)
    }
  }

  // Announces the order's locker again: the queue board shows it big and
  // says it out loud once more, and the customer's tracking page reminds them
  async function renotify() {
    if (!confirming || busy) return
    setBusy(true); setActionError('')
    try {
      const res = await fetch('/api/casillero/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: confirming.id, storeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setActionError(data.error ?? 'No se pudo volver a anunciar'); return }
      const at = Date.now()
      setSentAt(m => ({ ...m, [confirming.id]: at }))
      setNow(at)
    } catch {
      setActionError('No se pudo conectar con el servidor')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRelease() {
    if (!confirming) return
    setBusy(true); setActionError('')
    try {
      const res = await fetch('/api/casillero/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: confirming.id, storeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setActionError(data.error ?? 'No se pudo liberar el casillero'); return }
      setOrders(prev => prev.filter(o => o.id !== confirming.id))
      setConfirming(null)
    } catch {
      setActionError('No se pudo conectar con el servidor')
    } finally {
      setBusy(false)
    }
  }

  // The order in the dialog is announcing until its window is over: no
  // second "Volver a anunciar" until the first one has finished
  const openOrder = confirming ? (orders.find(o => o.id === confirming.id) ?? confirming) : null
  const announcedAt = openOrder
    ? Math.max(sentAt[openOrder.id] ?? 0, openOrder.locker_notified_at ? new Date(openOrder.locker_notified_at).getTime() : 0)
    : 0
  const announcingLeft = Math.max(0, announcedAt + ANNOUNCE_WINDOW_MS - now)
  const announcing = announcingLeft > 0
  useEffect(() => {
    if (!announcing) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [announcing])

  if (loading) {
    return <div className="lk-state"><div className="lk-spinner" /></div>
  }

  if (notFound || !store) {
    return (
      <div className="lk-state">
        <div className="lk-title">Tienda no encontrada</div>
        <div className="lk-subtitle">Este enlace no corresponde a ninguna tienda activa.</div>
      </div>
    )
  }

  if (store.lockerCount === 0) {
    return (
      <div className="lk-state">
        <div className="lk-title">No disponible</div>
        <div className="lk-subtitle">El modo casillero no esta activado para esta tienda.</div>
      </div>
    )
  }

  const pending = orders.filter(o => o.locker_number == null)
  const byLocker = new Map(orders.filter(o => o.locker_number != null).map(o => [o.locker_number, o]))
  const selectedPending = pending.find(o => o.id === selectedPendingId) ?? null

  return (
    <div className="lk-wrap" style={{ ['--lk-accent' as string]: store.accentColor }}>
      <div className="lk-header">
        {store.logo_url
          ? <img src={store.logo_url} alt={store.name} className="lk-logo" />
          : <div className="lk-logo-fallback">{store.name.slice(0, 2).toUpperCase()}</div>
        }
        <div className="lk-title">Casilleros</div>
        <div className="lk-subtitle">
          {selectedPending
            ? `Elige el casillero para ${selectedPending.customer_name.trim().split(/\s+/)[0]}`
            : 'Toca un pedido listo y luego el casillero que le toca'}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="lk-pending">
          {pending.map(o => (
            <button
              key={o.id}
              className={`lk-pending-chip${selectedPendingId === o.id ? ' lk-pending-chip-active' : ''}`}
              onClick={() => setSelectedPendingId(prev => prev === o.id ? null : o.id)}
            >
              {o.customer_name.trim().split(/\s+/)[0]}
              {o.order_number != null && <span className="lk-pending-chip-num">#{o.order_number}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="lk-grid">
        {Array.from({ length: store.lockerCount }, (_, i) => i + 1).map(n => {
          const order = byLocker.get(n)
          const assignable = !order && !!selectedPending
          return (
            <button
              key={n}
              className={`lk-locker${order ? ' lk-locker-occupied' : ''}${assignable ? ' lk-locker-assignable' : ''}`}
              onClick={() => {
                if (order) { setConfirming(order); setActionError(''); setNow(Date.now()) }
                else if (assignable) assignLocker(n)
              }}
            >
              <span className="lk-locker-num">{n}</span>
              {order ? (
                <span className="lk-locker-name">{order.customer_name.trim().split(/\s+/)[0]}</span>
              ) : (
                <span className="lk-locker-free">{assignable ? 'Tocar' : 'Libre'}</span>
              )}
            </button>
          )
        })}
      </div>

      {actionError && !confirming && <div className="lk-inline-error">{actionError}</div>}

      {confirming && (
        <div className="lk-modal-overlay" onClick={() => !busy && setConfirming(null)}>
          <div className="lk-modal" onClick={e => e.stopPropagation()}>
            <div className="lk-modal-title">Casillero {confirming.locker_number}</div>
            <div className="lk-modal-sub">
              Pedido de <strong>{confirming.customer_name}</strong>
              {confirming.order_number != null ? ` #${confirming.order_number}` : ''}
            </div>
            {actionError && <div className="lk-modal-error">{actionError}</div>}
            <button className={`lk-renotify${announcing ? ' done' : ''}`} disabled={busy || announcing} onClick={renotify}
              style={announcing ? { ['--lk-left' as string]: `${(announcingLeft / ANNOUNCE_WINDOW_MS) * 100}%` } : undefined}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />
              </svg>
              {announcing ? `Anunciando… ${Math.ceil(announcingLeft / 1000)} s` : 'Volver a anunciar'}
            </button>
            <div className="lk-modal-ask">¿Ya retiró su pedido?</div>
            <div className="lk-modal-actions">
              <button className="lk-modal-btn lk-modal-cancel" disabled={busy} onClick={() => setConfirming(null)}>
                Cancelar
              </button>
              <button className="lk-modal-btn lk-modal-confirm" disabled={busy} onClick={confirmRelease}>
                {busy ? '...' : 'Confirmar retiro'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lk-footer">
        Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a>
      </div>
    </div>
  )
}
