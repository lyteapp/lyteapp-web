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
  driver_id: string | null
  driver_lat: number | null; driver_lng: number | null
  customer_lat: number | null; customer_lng: number | null
}

interface DriverInfo {
  name: string
  phone: string | null
  vehicle: string | null
  rating: number | null
  avatar_url: string | null
}

interface TrackingConfig {
  mode?: 'status' | 'location'
  accentColor?: string
  bgColor?: string
  fontFamily?: string
  fontSize?: string
  mapStyle?: string
  statusConnectorSize?:   'sm' | 'md' | 'lg'
  locationConnectorSize?: 'sm' | 'md' | 'lg'
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
const CONNECTOR_PX: Record<string, string> = { sm: '2px', md: '4px', lg: '7px' }

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
  mapboxToken = '',
  driver,
  storeLat = null,
  storeLng = null,
  storeLogo = null,
}: {
  initialDelivery: Delivery | null
  token: string
  trackingConfig?: TrackingConfig | null
  mapboxToken?: string
  driver?: DriverInfo | null
  storeLat?: number | null
  storeLng?: number | null
  storeLogo?: string | null
}) {
  const [delivery, setDelivery] = useState<Delivery | null>(initialDelivery)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null)

  // Subscribe to live driver GPS from driver_locations
  useEffect(() => {
    const driverId = delivery?.driver_id
    if (!driverId) return

    const fetchLoc = async () => {
      const { data } = await supabase.from('driver_locations')
        .select('lat,lng,is_sharing,updated_at')
        .eq('driver_id', driverId)
        .maybeSingle()
      if (data?.is_sharing && (Date.now() - new Date(data.updated_at).getTime()) < 600_000) {
        setDriverLoc({ lat: data.lat, lng: data.lng })
      }
    }

    fetchLoc()

    const ch = supabase.channel(`driver-loc-${driverId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        const row = payload.new as { lat: number; lng: number; is_sharing: boolean }
        if (row?.is_sharing) setDriverLoc({ lat: row.lat, lng: row.lng })
        else setDriverLoc(null)
      })
      .subscribe()

    // Poll every 8 s as fallback in case realtime misses an event
    const poll = setInterval(fetchLoc, 8000)

    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [delivery?.driver_id])

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
    '--tr-accent':       trackingConfig?.accentColor ?? '#7C3AED',
    '--tr-bg':           trackingConfig?.bgColor     ?? '#F1EFE9',
    '--tr-font':         FONT_STACKS[trackingConfig?.fontFamily ?? 'system'] ?? FONT_STACKS.system,
    '--tr-scale':        FONT_SCALES[trackingConfig?.fontSize   ?? 'md']     ?? '1',
    '--tr-connector-w':  CONNECTOR_PX[trackingConfig?.statusConnectorSize   ?? 'sm'] ?? '2px',
    '--tr-connector-h':  CONNECTOR_PX[trackingConfig?.locationConnectorSize ?? 'sm'] ?? '2px',
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

    // Fetch immediately in case SSR delivery was null (server error or cold start)
    fetchDelivery()

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
  const accent = trackingConfig?.accentColor ?? '#7C3AED'

  if (trackingConfig?.mode === 'location') {
    const tlSteps = [
      { label: 'Recibido',   idx: 0 },
      { label: 'Preparando', idx: 1 },
      { label: 'Listo',      idx: 2 },
      { label: 'En camino',  idx: 3 },
      { label: 'Entregado',  idx: 4 },
    ]
    const hasGps = driverLoc != null || (delivery.driver_lat != null && delivery.driver_lng != null)
    const STATUS_LABELS: Record<string, string> = {
      pending:   'recibido',
      preparing: 'en preparacion',
      ready:     'siendo empacado',
      picked_up: 'en camino',
      delivered: 'entregado',
      cancelled: 'cancelado',
    }
    const STATUS_DOTS: Record<string, string> = {
      pending:   '#94A3B8',
      preparing: '#F59E0B',
      ready:     '#7C3AED',
      picked_up: '#1D9E75',
      delivered: '#10B981',
      cancelled: '#EF4444',
    }
    const statusDot   = STATUS_DOTS[delivery.status]  ?? '#1D9E75'
    const statusLabel = STATUS_LABELS[delivery.status] ?? 'en camino'
    const font = FONT_STACKS[trackingConfig.fontFamily ?? 'system'] ?? FONT_STACKS.system

    return (
      <div style={{ ...cssVars, position: 'relative', height: '100dvh', overflow: 'hidden', background: '#E4EAF1', fontFamily: font }}>

        {/* Map area */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '56%' }}>
          <TrackingMap
            driverLat={delivery.status === 'picked_up' ? (driverLoc?.lat ?? delivery.driver_lat) : null}
            driverLng={delivery.status === 'picked_up' ? (driverLoc?.lng ?? delivery.driver_lng) : null}
            storeLat={delivery.status !== 'picked_up' ? storeLat : null}
            storeLng={delivery.status !== 'picked_up' ? storeLng : null}
            storeLogo={storeLogo}
            customerLat={delivery.customer_lat}
            customerLng={delivery.customer_lng}
            height="100%"
            mapboxToken={mapboxToken}
            mapStyle={trackingConfig?.mapStyle}
            accent={accent}
          />
        </div>

        {/* Header gradient */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '48px 20px 40px', background: `linear-gradient(180deg, ${accent}F2 0%, ${accent}B3 60%, transparent 100%)`, zIndex: 5 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 400, marginBottom: 4 }}>Tu pedido</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 1 }}>
            <span style={{ fontSize: 12, color: 'white', fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em', flexShrink: 0 }}>
              #{delivery.id.slice(0, 4).toUpperCase()}
            </span>
            <span style={{ fontSize: 18, color: 'white', fontWeight: 700 }}>{delivery.customer_name}</span>
          </div>
          {delivery.delivery_address && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{delivery.delivery_address}</div>
          )}
        </div>

        {/* GPS badge */}
        {hasGps && (
          <div style={{ position: 'absolute', top: 160, right: 16, zIndex: 6, background: 'white', padding: '6px 10px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
            Ubicacion en vivo
          </div>
        )}

        {/* Map bottom fade */}
        <div style={{ position: 'absolute', top: 'calc(56% - 60px)', left: 0, right: 0, height: 70, background: 'linear-gradient(transparent, #F5F3EF)', zIndex: 4 }} />

        {/* Bottom sheet */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '47%', background: '#F5F3EF', borderRadius: '24px 24px 0 0', zIndex: 10, overflowY: 'auto', scrollbarWidth: 'none' as const }}>
          <div style={{ width: 36, height: 4, background: 'rgba(15,23,42,0.15)', borderRadius: 100, margin: '12px auto 0' }} />

          {/* Status */}
          <div style={{ padding: '14px 20px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: statusDot, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{statusLabel}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 4 }}>{hero.title}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{hero.sub}</div>
          </div>

          {/* Horizontal timeline */}
          <div style={{ padding: '8px 20px 14px', display: 'flex', alignItems: 'flex-start' }}>
            {tlSteps.map(({ label, idx }, i, arr) => {
              const done   = idx < currentIdx
              const active = idx === currentIdx
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                    {i > 0 && (
                      <div className="tr-h-connector">
                        <div
                          className={`tr-h-connector-fill${done ? ' done' : ''}`}
                          style={done ? { animationDelay: `${(i - 1) * 0.07}s` } : undefined}
                        />
                      </div>
                    )}
                    <div style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: (done || active) ? accent : '#CBD5E1', boxShadow: active ? `0 0 0 3px ${accent}33` : 'none', transition: 'background 0.35s, box-shadow 0.35s' }} />
                    {i < arr.length - 1 && (
                      <div className="tr-h-connector">
                        <div
                          className={`tr-h-connector-fill${done ? ' done' : ''}`}
                          style={done ? { animationDelay: `${i * 0.07}s` } : undefined}
                        />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 9, marginTop: 4, textAlign: 'center' as const, lineHeight: 1.2, color: active ? accent : done ? '#475569' : '#94A3B8', fontWeight: active ? 700 : 400 }}>{label}</span>
                </div>
              )
            })}
          </div>

          {/* Driver card — visible once order is en camino */}
          {driver && (delivery.status === 'picked_up' || delivery.status === 'delivered') && (
            <div style={{ margin: '0 16px 10px', background: 'white', borderRadius: 14, padding: '12px 16px', border: '0.5px solid rgba(15,23,42,0.08)' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Tu despachador</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {driver.avatar_url
                    ? <img src={driver.avatar_url} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 18, fontWeight: 700, color: accent }}>{driver.name.charAt(0).toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{driver.name}</div>
                  {driver.vehicle && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{driver.vehicle}</div>}
                  {driver.rating != null && (
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>{Number(driver.rating).toFixed(1)}</span> / 5.0
                    </div>
                  )}
                </div>
                {driver.phone && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`tel:${driver.phone}`} style={{ width: 36, height: 36, borderRadius: '50%', background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                      <svg viewBox="0 0 20 20" fill={accent} width="16" height="16">
                        <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
                      </svg>
                    </a>
                    <a href={`https://wa.me/${driver.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D36615', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                      <svg viewBox="0 0 24 24" fill="#25D366" width="18" height="18">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Address card */}
          {delivery.delivery_address && (
            <div style={{ margin: '0 16px 10px', background: 'white', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, border: '0.5px solid rgba(15,23,42,0.08)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 20 20" fill={accent} width="14" height="14">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Direccion de entrega</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>{delivery.delivery_address}</div>
              </div>
            </div>
          )}

          {/* Notes */}
          {delivery.notes && (
            <div style={{ margin: '0 16px 10px', background: 'white', borderRadius: 14, padding: '12px 16px', border: '0.5px solid rgba(15,23,42,0.08)' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Nota del pedido</div>
              <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.4 }}>"{delivery.notes}"</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '8px 0 24px', fontSize: 11, color: '#94A3B8' }}>
            <a href="https://lyte-app.com" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              Powered by <strong style={{ color: '#64748B' }}>LyteApp</strong>
            </a>
          </div>
        </div>
      </div>
    )
  }

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

      {/* Map card: store while preparing → driver when picked up, hidden once delivered */}
      {!isCancelled && !isDone && (delivery.status === 'picked_up' || storeLat != null) && (
        <div className="tr-map-card">
          <TrackingMap
            driverLat={delivery.status === 'picked_up' ? (driverLoc?.lat ?? delivery.driver_lat) : null}
            driverLng={delivery.status === 'picked_up' ? (driverLoc?.lng ?? delivery.driver_lng) : null}
            storeLat={delivery.status !== 'picked_up' ? storeLat : null}
            storeLng={delivery.status !== 'picked_up' ? storeLng : null}
            storeLogo={storeLogo}
            customerLat={delivery.customer_lat}
            customerLng={delivery.customer_lng}
            mapboxToken={mapboxToken}
            mapStyle={trackingConfig?.mapStyle}
            accent={accent}
          />
        </div>
      )}

      {driver && delivery.status === 'picked_up' && (
        <div style={{ margin: '0 16px 12px', background: 'white', borderRadius: 14, padding: '12px 16px', border: '0.5px solid rgba(15,23,42,0.08)' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Tu despachador</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {driver.avatar_url
                ? <img src={driver.avatar_url} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 18, fontWeight: 700, color: accent }}>{driver.name.charAt(0).toUpperCase()}</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{driver.name}</div>
              {driver.vehicle && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{driver.vehicle}</div>}
              {driver.rating != null && (
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>{Number(driver.rating).toFixed(1)}</span> / 5.0
                </div>
              )}
            </div>
            {driver.phone && (
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`tel:${driver.phone}`} style={{ width: 36, height: 36, borderRadius: '50%', background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                  <svg viewBox="0 0 20 20" fill={accent} width="16" height="16">
                    <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href={`https://wa.me/${driver.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D36615', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                  <svg viewBox="0 0 24 24" fill="#25D366" width="18" height="18">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            )}
          </div>
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
                    <div className="tr-connector">
                      <div
                        className={`tr-connector-fill${done ? ' done' : ''}`}
                        style={done ? { animationDelay: `${i * 0.09}s` } : undefined}
                      />
                    </div>
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
