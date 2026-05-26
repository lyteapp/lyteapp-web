'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import './pickup.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type PageStatus = 'loading' | 'confirmed' | 'already_picked' | 'delivered' | 'error'

export default function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [status, setStatus] = useState<PageStatus>('loading')
  const [customerName, setCustomerName] = useState('')
  const [delivering, setDelivering] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const lastGpsRef = useRef<number>(0)

  useEffect(() => {
    if (status !== 'confirmed' && status !== 'already_picked') return
    if (!navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        if (now - lastGpsRef.current < 8000) return
        lastGpsRef.current = now
        await supabase
          .from('deliveries')
          .update({ driver_lat: pos.coords.latitude, driver_lng: pos.coords.longitude })
          .eq('id', token)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [status, token])

  useEffect(() => {
    async function confirmPickup() {
      const { data, error } = await supabase
        .from('deliveries')
        .select('status, customer_name')
        .eq('id', token)
        .maybeSingle()

      if (error || !data) { setStatus('error'); return }

      setCustomerName(data.customer_name)

      if (data.status === 'delivered') { setStatus('delivered'); return }
      if (data.status === 'picked_up') { setStatus('already_picked'); return }
      if (data.status === 'cancelled') { setStatus('error'); return }

      const { error: upErr } = await supabase
        .from('deliveries')
        .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
        .eq('id', token)
        .eq('status', 'ready')

      if (upErr) { setStatus('error'); return }
      setStatus('confirmed')
    }

    confirmPickup()
  }, [token])

  async function markDelivered() {
    setDelivering(true)
    await supabase
      .from('deliveries')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', token)
    setStatus('delivered')
    setDelivering(false)
  }

  if (status === 'loading') return (
    <div className="pk-wrap">
      <div className="pk-spinner-lg" />
    </div>
  )

  if (status === 'error') return (
    <div className="pk-wrap">
      <div className="pk-card">
        <div className="pk-icon error">
          <svg viewBox="0 0 20 20" fill="#EF4444" width="28" height="28">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="pk-title">Link invalido</h2>
        <p className="pk-sub">Este QR no corresponde a ningun pedido activo.</p>
      </div>
    </div>
  )

  if (status === 'delivered') return (
    <div className="pk-wrap">
      <div className="pk-card">
        <div className="pk-icon success">
          <svg viewBox="0 0 20 20" fill="#10B981" width="28" height="28">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="pk-title">Entrega completada</h2>
        <p className="pk-sub">El pedido de <strong>{customerName}</strong> fue entregado exitosamente.</p>
      </div>
      <div className="pk-footer">Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a></div>
    </div>
  )

  if (status === 'already_picked') return (
    <div className="pk-wrap">
      <div className="pk-card">
        <div className="pk-icon already">
          <svg viewBox="0 0 20 20" fill="#3B82F6" width="28" height="28">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
          </svg>
        </div>
        <h2 className="pk-title">Ya en camino</h2>
        <div className="pk-name">{customerName}</div>
        <p className="pk-sub">Este pedido ya fue recogido. Marca como entregado cuando llegues.</p>
        <button className="pk-deliver-btn" onClick={markDelivered} disabled={delivering}>
          {delivering ? <span className="pk-spinner" /> : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Marcar como entregado
            </>
          )}
        </button>
      </div>
      <div className="pk-footer">Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a></div>
    </div>
  )

  // status === 'confirmed'
  return (
    <div className="pk-wrap">
      <div className="pk-card">
        <div className="pk-icon success">
          <svg viewBox="0 0 20 20" fill="#10B981" width="28" height="28">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
          </svg>
        </div>
        <h2 className="pk-title">Pedido recogido</h2>
        <div className="pk-name">{customerName}</div>
        <p className="pk-sub">El cliente ya sabe que su pedido viene en camino. Marca como entregado cuando llegues.</p>
        <button className="pk-deliver-btn" onClick={markDelivered} disabled={delivering}>
          {delivering ? <span className="pk-spinner" /> : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Marcar como entregado
            </>
          )}
        </button>
      </div>
      <div className="pk-footer">Powered by <a href="https://lyte-app.com" target="_blank" rel="noreferrer">LyteApp</a></div>
    </div>
  )
}
