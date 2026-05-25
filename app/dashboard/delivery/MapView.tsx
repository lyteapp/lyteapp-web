'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default icon paths broken by webpack
const iconFix = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const storeIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:10px;
    background:#4C1D95;display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(76,29,149,0.4);
    border:2px solid white;
  ">
    <svg viewBox="0 0 20 20" fill="white" width="18" height="18">
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
    </svg>
  </div>`,
  iconSize:   [36, 36],
  iconAnchor: [18, 18],
  popupAnchor:[0, -20],
})

function makeDriverIcon(initials: string, late: boolean) {
  const color = late ? '#BA7517' : '#7C3AED'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;
      background:white;border:2.5px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-family:system-ui;font-size:11px;font-weight:700;
      color:${color};box-shadow:0 2px 8px rgba(0,0,0,0.2);
    ">${initials}</div>`,
    iconSize:   [34, 34],
    iconAnchor: [17, 17],
    popupAnchor:[0, -20],
  })
}

function RecenterButton({ pos }: { pos: [number, number] }) {
  const map = useMap()
  return (
    <button
      onClick={() => map.setView(pos, map.getZoom())}
      style={{
        position: 'absolute', bottom: 14, right: 14, zIndex: 1000,
        width: 32, height: 32, borderRadius: 8, background: 'white',
        border: '0.5px solid rgba(15,23,42,0.12)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
      title="Centrar en mi ubicacion"
    >
      <svg viewBox="0 0 20 20" fill="#4C1D95" width="14" height="14">
        <path fillRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd"/>
      </svg>
    </button>
  )
}

type InRouteDelivery = {
  id: string
  customer_name: string
  driver_name: string | null
  picked_up_at: string | null
}

type Props = {
  inRoute: InRouteDelivery[]
}

export default function MapView({ inRoute }: Props) {
  const [pos, setPos]     = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    iconFix()

    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador')
      return
    }

    const onSuccess = (p: GeolocationPosition) => {
      setPos([p.coords.latitude, p.coords.longitude])
    }
    const onError = () => {
      setError('Permiso de ubicacion denegado. Activa la ubicacion en tu navegador.')
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true })
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    })

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [])

  if (error) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#E8EEF4', padding: 24, textAlign: 'center',
    }}>
      <svg viewBox="0 0 20 20" fill="#9CA3AF" width="32" height="32" style={{ marginBottom: 12 }}>
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
      </svg>
      <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 220, lineHeight: 1.5 }}>{error}</div>
    </div>
  )

  if (!pos) return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#E8EEF4', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Obteniendo ubicacion...</span>
    </div>
  )

  return (
    <MapContainer
      center={pos}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Store location */}
      <Marker position={pos} icon={storeIcon}>
        <Popup>
          <strong style={{ color: '#4C1D95' }}>Tu tienda</strong>
        </Popup>
      </Marker>

      {/* Accuracy circle */}
      <Circle
        center={pos}
        radius={80}
        pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.08, weight: 1 }}
      />

      {/* In-route deliveries — positioned near store since we don't have driver GPS */}
      {inRoute.map((del, i) => {
        const mins = del.picked_up_at
          ? Math.floor((Date.now() - new Date(del.picked_up_at).getTime()) / 60000)
          : null
        const late = mins !== null && mins > 30
        const angle = (i / Math.max(inRoute.length, 1)) * 2 * Math.PI
        const offsetLat = pos[0] + Math.cos(angle) * 0.006
        const offsetLng = pos[1] + Math.sin(angle) * 0.008
        const drv = del.driver_name ?? '?'
        const initials = drv.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        return (
          <Marker
            key={del.id}
            position={[offsetLat, offsetLng]}
            icon={makeDriverIcon(initials, late)}
          >
            <Popup>
              <div style={{ fontSize: 12, minWidth: 140 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{drv}</div>
                <div style={{ color: '#6B7280' }}>Cliente: {del.customer_name}</div>
                {mins !== null && (
                  <div style={{ color: late ? '#BA7517' : '#1D9E75', marginTop: 4 }}>
                    {mins} min en ruta{late ? ' · ATRASADO' : ''}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}

      <RecenterButton pos={pos} />
    </MapContainer>
  )
}
