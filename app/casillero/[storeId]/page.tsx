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
}

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
  const [confirming, setConfirming] = useState<LockerOrder | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState('')

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
      const isActive = row.status === 'ready' && row.locker_number != null
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
      .select('id, order_number, customer_name, locker_number, status')
      .eq('store_id', storeId)
      .eq('status', 'ready')
      .not('locker_number', 'is', null)
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

  async function confirmRelease() {
    if (!confirming) return
    setReleasing(true); setReleaseError('')
    try {
      const res = await fetch('/api/casillero/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: confirming.id, storeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setReleaseError(data.error ?? 'No se pudo liberar el casillero'); return }
      setOrders(prev => prev.filter(o => o.id !== confirming.id))
      setConfirming(null)
    } catch {
      setReleaseError('No se pudo conectar con el servidor')
    } finally {
      setReleasing(false)
    }
  }

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

  const byLocker = new Map(orders.map(o => [o.locker_number, o]))

  return (
    <div className="lk-wrap" style={{ ['--lk-accent' as string]: store.accentColor }}>
      <div className="lk-header">
        {store.logo_url
          ? <img src={store.logo_url} alt={store.name} className="lk-logo" />
          : <div className="lk-logo-fallback">{store.name.slice(0, 2).toUpperCase()}</div>
        }
        <div className="lk-title">Casilleros</div>
        <div className="lk-subtitle">Toca un casillero ocupado para confirmar el retiro</div>
      </div>

      <div className="lk-grid">
        {Array.from({ length: store.lockerCount }, (_, i) => i + 1).map(n => {
          const order = byLocker.get(n)
          return (
            <button
              key={n}
              className={`lk-locker${order ? ' lk-locker-occupied' : ''}`}
              onClick={() => { if (order) { setConfirming(order); setReleaseError('') } }}
            >
              <span className="lk-locker-num">{n}</span>
              {order ? (
                <span className="lk-locker-name">{order.customer_name.trim().split(/\s+/)[0]}</span>
              ) : (
                <span className="lk-locker-free">Libre</span>
              )}
            </button>
          )
        })}
      </div>

      {confirming && (
        <div className="lk-modal-overlay" onClick={() => !releasing && setConfirming(null)}>
          <div className="lk-modal" onClick={e => e.stopPropagation()}>
            <div className="lk-modal-title">Casillero {confirming.locker_number}</div>
            <div className="lk-modal-sub">
              Confirmar que <strong>{confirming.customer_name}</strong> retiro su pedido
              {confirming.order_number != null ? ` #${confirming.order_number}` : ''}?
            </div>
            {releaseError && <div className="lk-modal-error">{releaseError}</div>}
            <div className="lk-modal-actions">
              <button className="lk-modal-btn lk-modal-cancel" disabled={releasing} onClick={() => setConfirming(null)}>
                Cancelar
              </button>
              <button className="lk-modal-btn lk-modal-confirm" disabled={releasing} onClick={confirmRelease}>
                {releasing ? '...' : 'Confirmar retiro'}
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
