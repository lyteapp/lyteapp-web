'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import './order-track.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'completed' | 'cancelled'

type StoreInfo = {
  name: string
  logo_url: string | null
  store_address: string | null
  store_lat: number | null
  store_lng: number | null
  map_url: string | null
}

function mapsUrl(store: StoreInfo): string | null {
  if (store.map_url) return store.map_url
  if (store.store_lat && store.store_lng)
    return `https://www.google.com/maps?q=${store.store_lat},${store.store_lng}`
  if (store.store_address)
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.store_address)}`
  return null
}

function statusStage(status: OrderStatus): number {
  if (status === 'pending' || status === 'confirmed') return 0
  if (status === 'processing') return 1
  if (status === 'ready') return 2
  return 2
}

const STAGE_LABELS = ['Pedido recibido', 'En preparacion', 'Listo para recoger']

export default function OrderTrackPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)

  const [status, setStatus]         = useState<OrderStatus | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [store, setStore]           = useState<StoreInfo | null>(null)
  const [error, setError]           = useState(false)

  useEffect(() => {
    async function load() {
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('customer_name, status, store_id, delivery_type')
        .eq('id', orderId)
        .maybeSingle()

      if (oErr || !order || order.delivery_type !== 'pickup') { setError(true); return }

      setCustomerName(order.customer_name)
      setStatus(order.status as OrderStatus)

      const { data: st } = await supabase
        .from('stores')
        .select('name, logo_url, store_address, store_lat, store_lng, map_url')
        .eq('id', order.store_id)
        .maybeSingle()

      if (st) setStore(st as StoreInfo)
    }
    load()
  }, [orderId])

  useEffect(() => {
    const ch = supabase
      .channel(`order-track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => setStatus((payload.new as { status: OrderStatus }).status))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [orderId])

  if (error) return (
    <div className="ot-wrap">
      <div className="ot-card">
        <div className="ot-icon ot-icon--error">
          <svg viewBox="0 0 20 20" fill="currentColor" width="26" height="26">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
          </svg>
        </div>
        <div className="ot-title">Pedido no encontrado</div>
        <div className="ot-sub">Este link no corresponde a ningun pedido activo.</div>
      </div>
    </div>
  )

  if (!status || !store) return (
    <div className="ot-wrap">
      <div className="ot-spinner" />
    </div>
  )

  const isCancelled = status === 'cancelled'
  const isDone      = status === 'delivered' || status === 'completed'
  const isReady     = status === 'ready' || isDone
  const stage       = isCancelled ? -1 : statusStage(status)
  const url         = mapsUrl(store)

  return (
    <div className="ot-wrap">
      <div className="ot-card">

        {/* Store header */}
        <div className="ot-store-header">
          {store.logo_url
            ? <img src={store.logo_url} alt={store.name} className="ot-store-logo" />
            : <div className="ot-store-initials">{store.name.slice(0, 2).toUpperCase()}</div>
          }
          <div className="ot-store-name">{store.name}</div>
        </div>

        <div className="ot-order-id">#{orderId.slice(0, 8).toUpperCase()}</div>
        <div className="ot-customer">{customerName}</div>

        {isCancelled ? (
          <div className="ot-cancelled-badge">Pedido cancelado</div>
        ) : (
          <>
            {/* Progress steps */}
            <div className="ot-steps">
              {STAGE_LABELS.map((label, i) => (
                <div key={i} className={`ot-step${i <= stage ? ' ot-step--done' : ''}${i === stage && !isReady ? ' ot-step--active' : ''}`}>
                  <div className="ot-step-dot">
                    {i < stage || isDone ? (
                      <svg viewBox="0 0 12 12" fill="currentColor" width="10" height="10">
                        <path d="M10.28 2.28L4.5 8.06 1.72 5.28a.75.75 0 00-1.06 1.06l3.35 3.35a.75.75 0 001.06 0l6.28-6.28a.75.75 0 00-1.06-1.06z"/>
                      </svg>
                    ) : i === stage ? (
                      <div className="ot-dot-pulse" />
                    ) : null}
                  </div>
                  {i < STAGE_LABELS.length - 1 && <div className="ot-step-line" />}
                  <div className="ot-step-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Ready state CTA */}
            {isReady && (
              <div className="ot-ready-block">
                <div className="ot-ready-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="32" height="32">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div className="ot-ready-title">Tu pedido esta listo</div>
                <div className="ot-ready-sub">Puedes pasar a recogerlo en tienda cuando quieras.</div>
              </div>
            )}

            {/* Address button — always visible */}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="ot-map-btn">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                </svg>
                DIRECCION DE LA TIENDA
              </a>
            )}
          </>
        )}
      </div>

      <div className="ot-footer">
        Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a>
      </div>
    </div>
  )
}
