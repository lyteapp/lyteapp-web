'use client'

import { useEffect, useRef, useState } from 'react'
import MapGL, { Marker, NavigationControl } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

type InRouteDelivery = {
  id: string
  customer_name: string
  driver_name: string | null
  driver_id: string | null
  picked_up_at: string | null
}

type DriverLocation = {
  driver_id: string
  lat: number
  lng: number
  is_sharing: boolean
  updated_at: string
}

type Driver = {
  id: string
  name: string
}

type CustomerPin = {
  id: string
  customer_name: string
  delivery_address: string
  status: string
  customer_lat: number
  customer_lng: number
}

const PIN_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', preparing: 'Preparando', ready: 'Listo',
  picked_up: 'En ruta', delivered: 'Entregado', cancelled: 'Cancelado',
}
const PIN_STATUS_COLOR: Record<string, string> = {
  pending: '#94A3B8', preparing: '#F59E0B', ready: '#3B82F6',
  picked_up: '#7C3AED', delivered: '#10B981', cancelled: '#EF4444',
}

type Props = {
  inRoute: InRouteDelivery[]
  driverLocations: DriverLocation[]
  drivers: Driver[]
  customerPins: CustomerPin[]
  mapboxToken: string
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const STATUS_COLORS = {
  available: { border: '#15803D', bg: 'white', text: '#15803D', dot: '#15803D' },
  in_route:  { border: '#7C3AED', bg: 'white', text: '#7C3AED', dot: '#7C3AED' },
  late:      { border: '#B45309', bg: '#FFFBEB', text: '#B45309', dot: '#B45309' },
}

export default function MapView({ inRoute, driverLocations, drivers, customerPins, mapboxToken }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [pos, setPos]     = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [popup, setPopup] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) { setError('Geolocalización no disponible'); return }
    navigator.geolocation.getCurrentPosition(
      p => setPos([p.coords.latitude, p.coords.longitude]),
      () => setError('Permiso de ubicacion denegado. Activa la ubicacion en tu navegador.'),
      { enableHighAccuracy: true },
    )
  }, [])

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', padding: 24, textAlign: 'center' }}>
      <svg viewBox="0 0 20 20" fill="#9CA3AF" width="32" height="32" style={{ marginBottom: 12 }}>
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
      </svg>
      <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 220, lineHeight: 1.5 }}>{error}</div>
    </div>
  )

  if (!pos) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Obteniendo ubicacion...</span>
    </div>
  )

  const activeGps = driverLocations.filter(
    d => d.is_sharing && (Date.now() - new Date(d.updated_at).getTime()) < 300_000,
  )
  const inRouteByDriver: Record<string, InRouteDelivery> = {}
  for (const d of inRoute) { if (d.driver_id) inRouteByDriver[d.driver_id] = d }

  return (
    <MapGL
      ref={mapRef}
      initialViewState={{ longitude: pos[1], latitude: pos[0], zoom: 14, pitch: 0, bearing: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/standard"
      mapboxAccessToken={mapboxToken}
      attributionControl={false}
      onClick={() => setPopup(null)}
    >
      <NavigationControl position="bottom-right" showCompass={false} />

      {/* Recenter button */}
      <button
        onClick={e => { e.stopPropagation(); mapRef.current?.flyTo({ center: [pos[1], pos[0]], zoom: 14, duration: 600 }) }}
        style={{
          position: 'absolute', bottom: 80, right: 14, zIndex: 10,
          width: 32, height: 32, borderRadius: 8, background: 'white',
          border: '0.5px solid rgba(15,23,42,0.12)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <svg viewBox="0 0 20 20" fill="#4C1D95" width="14" height="14">
          <path fillRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd"/>
        </svg>
      </button>

      {/* Store marker */}
      <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#4C1D95', border: '2px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(76,29,149,0.4)',
          cursor: 'default',
        }}>
          <svg viewBox="0 0 20 20" fill="white" width="18" height="18">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
          </svg>
        </div>
      </Marker>

      {/* Drivers with active GPS */}
      {activeGps.map(loc => {
        const driver = drivers.find(d => d.id === loc.driver_id)
        const name = driver?.name ?? 'Despachador'
        const init = initials(name)
        const delivery = loc.driver_id ? inRouteByDriver[loc.driver_id] : undefined
        const mins = delivery?.picked_up_at
          ? Math.floor((Date.now() - new Date(delivery.picked_up_at).getTime()) / 60000)
          : null
        const late = mins !== null && mins > 30
        const status: keyof typeof STATUS_COLORS = !delivery ? 'available' : late ? 'late' : 'in_route'
        const c = STATUS_COLORS[status]
        const secsAgo = Math.floor((Date.now() - new Date(loc.updated_at).getTime()) / 1000)
        const freshLabel = secsAgo < 60 ? `Hace ${secsAgo}s` : `Hace ${Math.floor(secsAgo / 60)} min`

        return (
          <Marker key={loc.driver_id} longitude={loc.lng} latitude={loc.lat} anchor="center">
            <div style={{ position: 'relative' }} onClick={e => { e.stopPropagation(); setPopup(p => p === loc.driver_id ? null : loc.driver_id) }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: c.bg, border: `2.5px solid ${c.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: c.text,
                boxShadow: '0 2px 10px rgba(0,0,0,0.18)', cursor: 'pointer',
                fontFamily: 'system-ui',
              }}>{init}</div>
              <span style={{
                position: 'absolute', top: 0, right: 0,
                width: 9, height: 9, borderRadius: '50%',
                background: c.dot, border: '1.5px solid white',
              }} />
              {popup === loc.driver_id && (
                <div style={{
                  position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)',
                  background: 'white', borderRadius: 10, padding: '10px 14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.16)', minWidth: 160,
                  fontSize: 12, zIndex: 20, whiteSpace: 'nowrap',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>{name}</div>
                  {delivery ? (
                    <>
                      <div style={{ color: '#6B7280' }}>Cliente: {delivery.customer_name}</div>
                      <div style={{ color: late ? '#B45309' : '#7C3AED', marginTop: 3, fontWeight: 500 }}>
                        {mins} min en ruta{late ? ' · ATRASADO' : ''}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#15803D', fontWeight: 500 }}>Disponible</div>
                  )}
                  <div style={{ color: '#9CA3AF', marginTop: 4, fontSize: 11 }}>GPS · {freshLabel}</div>
                </div>
              )}
            </div>
          </Marker>
        )
      })}

      {/* Customer location pins (today) */}
      {customerPins.map(pin => {
        const statusColor = PIN_STATUS_COLOR[pin.status] ?? '#94A3B8'
        const statusLabel = PIN_STATUS_LABEL[pin.status] ?? pin.status
        return (
          <Marker key={pin.id} longitude={pin.customer_lng} latitude={pin.customer_lat} anchor="bottom">
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setPopup(p => p === pin.id ? null : pin.id) }}>
              <svg viewBox="0 0 24 32" width="18" height="24" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.28))', display: 'block' }}>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z" fill={statusColor}/>
                <circle cx="12" cy="11" r="5" fill="white"/>
              </svg>
              {popup === pin.id && (
                <div style={{
                  position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                  background: 'white', borderRadius: 10, padding: '10px 14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.16)', minWidth: 170,
                  fontSize: 12, zIndex: 20, whiteSpace: 'nowrap',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>{pin.customer_name}</div>
                  {pin.delivery_address && (
                    <div style={{ color: '#6B7280', maxWidth: 200, whiteSpace: 'normal', lineHeight: 1.4, marginBottom: 4 }}>{pin.delivery_address}</div>
                  )}
                  <div style={{ display: 'inline-block', background: statusColor, color: 'white', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                    {statusLabel}
                  </div>
                </div>
              )}
            </div>
          </Marker>
        )
      })}

      {/* Drivers without GPS but in route */}
      {inRoute
        .filter(del => del.driver_id && !activeGps.find(g => g.driver_id === del.driver_id))
        .map((del, i) => {
          const mins = del.picked_up_at
            ? Math.floor((Date.now() - new Date(del.picked_up_at).getTime()) / 60000)
            : null
          const late = mins !== null && mins > 30
          const name = del.driver_name ?? '?'
          const init = initials(name)
          const c = STATUS_COLORS[late ? 'late' : 'in_route']
          const angle = (i / Math.max(inRoute.length, 1)) * 2 * Math.PI
          const approxLng = pos[1] + Math.sin(angle) * 0.008
          const approxLat = pos[0] + Math.cos(angle) * 0.006

          return (
            <Marker key={del.id} longitude={approxLng} latitude={approxLat} anchor="center">
              <div style={{ position: 'relative', opacity: 0.75 }} onClick={e => { e.stopPropagation(); setPopup(p => p === del.id ? null : del.id) }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: c.bg, border: `2.5px dashed ${c.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: c.text,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.12)', cursor: 'pointer',
                  fontFamily: 'system-ui',
                }}>{init}</div>
                {popup === del.id && (
                  <div style={{
                    position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)',
                    background: 'white', borderRadius: 10, padding: '10px 14px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.16)', minWidth: 160,
                    fontSize: 12, zIndex: 20, whiteSpace: 'nowrap',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>{name}</div>
                    <div style={{ color: '#6B7280' }}>Cliente: {del.customer_name}</div>
                    {mins !== null && (
                      <div style={{ color: late ? '#B45309' : '#7C3AED', marginTop: 3, fontWeight: 500 }}>
                        {mins} min en ruta{late ? ' · ATRASADO' : ''}
                      </div>
                    )}
                    <div style={{ color: '#9CA3AF', marginTop: 4, fontSize: 11 }}>Sin GPS · posicion estimada</div>
                  </div>
                )}
              </div>
            </Marker>
          )
        })
      }
    </MapGL>
  )
}
