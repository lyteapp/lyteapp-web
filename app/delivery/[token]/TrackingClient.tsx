'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@supabase/supabase-js'
import './tracking.css'

const TrackingMap = dynamic(() => import('./TrackingMap'), { ssr: false })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Status = 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled'

interface Delivery {
  id: string; customer_name: string; customer_phone: string
  delivery_address: string; status: Status; notes: string | null
  picked_up_at: string | null; delivered_at: string | null; created_at: string
  driver_lat: number | null; driver_lng: number | null
  customer_lat: number | null; customer_lng: number | null
}

interface TrackingConfig {
  accentColor?: string
  bgColor?: string
  fontFamily?: string
  fontSize?: string
}

const FONT_STACKS: Record<string, string> = {
  system:           'system-ui, -apple-system, sans-serif',
  Inter:            "'Inter', system-ui, sans-serif",
  Roboto:           "'Roboto', system-ui, sans-serif",
  Poppins:          "'Poppins', system-ui, sans-serif",
  Montserrat:       "'Montserrat', system-ui, sans-serif",
  Lato:             "'Lato', system-ui, sans-serif",
  'DM Sans':        "'DM Sans', system-ui, sans-serif",
  Nunito:           "'Nunito', system-ui, sans-serif",
  Raleway:          "'Raleway', system-ui, sans-serif",
  Oswald:           "'Oswald', system-ui, sans-serif",
  'Playfair Display':"'Playfair Display', Georgia, serif",
  Ubuntu:           "'Ubuntu', system-ui, sans-serif",
}

const GOOGLE_FONT_URLS: Record<string, string> = {
  Inter:            'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
  Roboto:           'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap',
  Poppins:          'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap',
  Montserrat:       'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap',
  Lato:             'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  'DM Sans':        'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300..900&display=swap',
  Nunito:           'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  Raleway:          'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&display=swap',
  Oswald:           'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap',
  'Playfair Display':'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&display=swap',
  Ubuntu:           'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;700&display=swap',
}

const FONT_SCALES: Record<string, string> = { sm: '0.875', md: '1', lg: '1.125' }

type Step = {
  key: Status
  label: string
  desc: string
}

const STEPS: Step[] = [
  { key: 'pending',   label: 'Pedido recibido',       desc: 'Tu pedido fue registrado. La cocina lo tiene y comenzara a prepararlo pronto.' },
  { key: 'preparing', label: 'En preparacion',         desc: 'Tu pedido esta en cocina, lo estan preparando con mucho cuidado.' },
  { key: 'ready',     label: 'Siendo empacado',        desc: 'Tu pedido ya esta listo y lo estan empacando para que llegue perfecto.' },
  { key: 'picked_up', label: 'Tu pedido esta saliendo', desc: 'El despachador ya tiene tu pedido y va en camino hacia ti.' },
  { key: 'delivered', label: 'Pedido entregado',       desc: 'Tu pedido llego exitosamente. Que lo disfrutes.' },
]

const STATUS_ORDER: Record<string, number> = { pending: 0, preparing: 1, ready: 2, picked_up: 3, delivered: 4 }

const HERO: Record<string, { title: string; sub: string }> = {
  pending:   { title: 'Pedido recibido',          sub: 'Tu pedido fue registrado. La cocina lo tiene y comenzara a prepararlo pronto.' },
  preparing: { title: 'En preparacion en cocina', sub: 'Estamos preparando tu pedido con mucho cuidado. Te avisamos cuando salga.' },
  ready:     { title: 'Siendo empacado',           sub: 'Tu pedido ya esta listo y lo estan empacando. El despachador viene pronto.' },
  picked_up: { title: 'Tu pedido esta saliendo',  sub: 'El despachador ya tiene tu pedido y va en camino hacia ti.' },
  delivered: { title: 'Tu pedido fue entregado',  sub: 'Que lo disfrutes. Gracias por tu compra.' },
  cancelled: { title: 'Entrega cancelada',         sub: 'Esta entrega fue cancelada. Contacta a la tienda para mas informacion.' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function HeroIcon({ status }: { status: Status }) {
  const isPulse = status !== 'delivered' && status !== 'cancelled'
  if (status === 'pending') return (
    <div className={`tr-hero-icon preparing${isPulse ? ' tr-hero-pulse' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" width="36" height="36">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    </div>
  )
  if (status === 'preparing') return (
    <div className={`tr-hero-icon preparing${isPulse ? ' tr-hero-pulse' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" width="36" height="36">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    </div>
  )
  if (status === 'ready') return (
    <div className={`tr-hero-icon ready${isPulse ? ' tr-hero-pulse' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" width="36" height="36">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-9 5.25-9-5.25v-2.25" />
      </svg>
    </div>
  )
  if (status === 'picked_up') return (
    <div className={`tr-hero-icon picked_up${isPulse ? ' tr-hero-pulse' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" width="36" height="36">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    </div>
  )
  if (status === 'delivered') return (
    <div className="tr-hero-icon delivered">
      <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="36" height="36">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
  return (
    <div className="tr-hero-icon cancelled">
      <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" width="36" height="36">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

export default function TrackingClient({
  initialDelivery,
  token,
  trackingConfig,
}: {
  initialDelivery: Delivery | null
  token: string
  trackingConfig?: TrackingConfig | null
}) {
  const [delivery, setDelivery] = useState<Delivery | null>(initialDelivery)

  useEffect(() => {
    const fontName = trackingConfig?.fontFamily
    if (!fontName || fontName === 'system' || !GOOGLE_FONT_URLS[fontName]) return
    const url = GOOGLE_FONT_URLS[fontName]
    if (document.querySelector(`link[href="${url}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }, [trackingConfig?.fontFamily])

  const cssVars = {
    '--tr-accent': trackingConfig?.accentColor ?? '#7C3AED',
    '--tr-bg':     trackingConfig?.bgColor     ?? '#F1EFE9',
    '--tr-font':   FONT_STACKS[trackingConfig?.fontFamily ?? 'system'] ?? FONT_STACKS.system,
    '--tr-scale':  FONT_SCALES[trackingConfig?.fontSize   ?? 'md']     ?? '1',
  } as React.CSSProperties

  const fetchDelivery = useCallback(async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', token)
      .maybeSingle()
    if (error) return
    setDelivery((data as Delivery) ?? null)
  }, [token])

  useEffect(() => {
    if (!token) return

    const ch = supabase.channel(`track-${token}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `id=eq.${token}` },
        (payload) => {
          const updated = payload.new as Delivery
          if (updated.customer_name) setDelivery(updated)
          else fetchDelivery()
        }
      )
      .subscribe()

    const bcCh = supabase.channel('kitchen-updates')
      .on('broadcast', { event: 'delivery-status' }, ({ payload }) => {
        if (payload?.deliveryId === token) fetchDelivery()
      })
      .subscribe()

    const poll = setInterval(fetchDelivery, 3000)
    return () => {
      supabase.removeChannel(ch)
      supabase.removeChannel(bcCh)
      clearInterval(poll)
    }
  }, [token, fetchDelivery])

  if (!delivery) return (
    <div className="tr-wrap" style={cssVars}>
      <div className="tr-brand-bar">
        <span className="tr-brand">Lyte<span>app</span></span>
      </div>
      <div className="tr-notfound">
        <div className="tr-nf-icon">404</div>
        <h2 className="tr-nf-title">Entrega no encontrada</h2>
        <p className="tr-nf-sub">Este link puede ser invalido o haber expirado.</p>
      </div>
    </div>
  )

  const currentIdx = STATUS_ORDER[delivery.status] ?? 0
  const isCancelled = delivery.status === 'cancelled'
  const hero = HERO[delivery.status] ?? HERO.preparing
  const isDone = delivery.status === 'delivered'

  return (
    <div className="tr-wrap" style={cssVars}>
      <div className="tr-brand-bar">
        <a className="tr-brand" href="https://lyte-app.com" target="_blank" rel="noreferrer">
          Lyte<span>app</span>
        </a>
        <div className="tr-brand-label">Rastreo de pedido</div>
      </div>

      <div className={`tr-hero${isDone ? ' done' : delivery.status === 'picked_up' ? ' route' : ''}`}>
        <HeroIcon status={delivery.status} />
        <div className="tr-hero-status">{hero.title}</div>
        <div className="tr-hero-sub">{hero.sub}</div>
        {delivery.picked_up_at && delivery.status === 'picked_up' && (
          <div className="tr-hero-time">Salio a las {fmtTime(delivery.picked_up_at)}</div>
        )}
        {delivery.delivered_at && isDone && (
          <div className="tr-hero-time">Entregado a las {fmtTime(delivery.delivered_at)}</div>
        )}
      </div>

      {(delivery.delivery_address || delivery.notes) && (
        <div className="tr-info-card">
          <div className="tr-info-name">{delivery.customer_name}</div>
          {delivery.delivery_address && (
            <div className="tr-info-row">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" style={{ flexShrink: 0, marginTop: 2, color: '#94A3B8' }}>
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {delivery.delivery_address}
            </div>
          )}
          {delivery.notes && <div className="tr-info-note">"{delivery.notes}"</div>}
        </div>
      )}

      {delivery.status === 'picked_up' && (
        <div className="tr-map-card">
          <TrackingMap
            driverLat={delivery.driver_lat}
            driverLng={delivery.driver_lng}
            customerLat={delivery.customer_lat}
            customerLng={delivery.customer_lng}
          />
        </div>
      )}

      {isCancelled && (
        <div className="tr-cancelled-card">
          <svg viewBox="0 0 20 20" fill="#DC2626" width="20" height="20" style={{ flexShrink: 0 }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <div className="tr-cancelled-text">Esta entrega fue cancelada</div>
        </div>
      )}

      {!isCancelled && (
        <div className="tr-steps-card">
          <div className="tr-steps-title">Progreso de tu pedido</div>
          {STEPS.map((step, i) => {
            const done    = i < currentIdx
            const current = i === currentIdx
            return (
              <div key={step.key} className={`tr-step${done ? ' done' : current ? ' current' : ' future'}`}>
                <div className="tr-step-left">
                  <div className={`tr-dot${done ? ' done' : current ? ' current' : ' future'}`}>
                    {done && (
                      <svg viewBox="0 0 16 16" fill="white" width="10" height="10" className="tr-dot-check">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
                      </svg>
                    )}
                    {current && <div className="tr-dot-pulse-ring" />}
                    {!done && !current && <span className="tr-dot-num">{i + 1}</span>}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`tr-connector${done ? ' done' : ''}`} />
                  )}
                </div>
                <div className="tr-step-body">
                  <div className="tr-step-label">{step.label}</div>
                  {current && <div className="tr-step-desc">{step.desc}</div>}
                  {step.key === 'picked_up' && delivery.picked_up_at && done && (
                    <div className="tr-step-timestamp">{fmtTime(delivery.picked_up_at)}</div>
                  )}
                  {step.key === 'delivered' && delivery.delivered_at && done && (
                    <div className="tr-step-timestamp">{fmtTime(delivery.delivered_at)}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="tr-footer">
        <a href="https://lyte-app.com" target="_blank" rel="noreferrer">
          Powered by <strong>LyteApp</strong> · Crea tu tienda gratis
        </a>
      </div>
    </div>
  )
}
