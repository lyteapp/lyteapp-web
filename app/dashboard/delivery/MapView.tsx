'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

function makeDriverIcon(initials: string, status: 'available' | 'in_route' | 'late') {
  const colors = {
    available: { border: '#15803D', text: '#15803D', bg: 'white', pulse: '#DCFCE7' },
    in_route:  { border: '#7C3AED', text: '#7C3AED', bg: 'white', pulse: '#EDE9FE' },
    late:      { border: '#B45309', text: '#B45309', bg: '#FFFBEB', pulse: '#FEF3C7' },
  }
  const c = colors[status]
  const dot = `<span style="
    position:absolute;top:0;right:0;
    width:9px;height:9px;border-radius:50%;
    background:${c.border};border:1.5px solid white;
  "></span>`
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:36px;height:36px;">
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${c.bg};border:2.5px solid ${c.border};
        display:flex;align-items:center;justify-content:center;
        font-family:system-ui;font-size:11px;font-weight:700;
        color:${c.text};box-shadow:0 2px 10px rgba(0,0,0,0.18);
      ">${initials}</div>
      ${dot}
    </div>`,
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
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

type Props = {
  inRoute: InRouteDelivery[]
  driverLocations: DriverLocation[]
  drivers: Driver[]
}

export default function MapView({ inRoute, driverLocations, drivers }: Props) {
  const [pos, setPos]     = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    iconFix()

    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador')
      return
    }

    const onSuccess = (p: GeolocationPosition) => setPos([p.coords.latitude, p.coords.longitude])
    const onError   = () => setError('Permiso de ubicacion denegado. Activa la ubicacion en tu navegador.')

    navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true })
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true, maximumAge: 10000, timeout: 15000,
    })

    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }
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

  // Active GPS: sharing + updated within 5 min
  const activeGps = driverLocations.filter(
    d => d.is_sharing && (Date.now() - new Date(d.updated_at).getTime()) < 300_000
  )

  // Map driver_id → active delivery
  const inRouteByDriver = new Map(inRoute.map(d => [d.driver_id, d]))

  return (
    <MapContainer center={pos} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />

      {/* Store marker */}
      <Marker position={pos} icon={storeIcon}>
        <Popup><strong style={{ color: '#4C1D95' }}>Tu tienda</strong></Popup>
      </Marker>
      <Circle center={pos} radius={80} pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.08, weight: 1 }} />

      {/* All dispatchers with active GPS */}
      {activeGps.map(loc => {
        const driver = drivers.find(d => d.id === loc.driver_id)
        const name = driver?.name ?? 'Despachador'
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

        const delivery = inRouteByDriver.get(loc.driver_id)
        const mins = delivery?.picked_up_at
          ? Math.floor((Date.now() - new Date(delivery.picked_up_at).getTime()) / 60000)
          : null
        const late = mins !== null && mins > 30

        const status: 'available' | 'in_route' | 'late' =
          !delivery ? 'available' : late ? 'late' : 'in_route'

        const secsAgo = Math.floor((Date.now() - new Date(loc.updated_at).getTime()) / 1000)
        const freshLabel = secsAgo < 60 ? `Hace ${secsAgo}s` : `Hace ${Math.floor(secsAgo / 60)} min`

        return (
          <Marker key={loc.driver_id} position={[loc.lat, loc.lng]} icon={makeDriverIcon(initials, status)}>
            <Popup>
              <div style={{ fontSize: 12, minWidth: 150 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{name}</div>
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
            </Popup>
          </Marker>
        )
      })}

      {/* Drivers without GPS but in route: show estimated position near store */}
      {inRoute
        .filter(del => del.driver_id && !activeGps.find(g => g.driver_id === del.driver_id))
        .map((del, i) => {
          const mins = del.picked_up_at
            ? Math.floor((Date.now() - new Date(del.picked_up_at).getTime()) / 60000)
            : null
          const late = mins !== null && mins > 30
          const name = del.driver_name ?? '?'
          const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          const angle = (i / Math.max(inRoute.length, 1)) * 2 * Math.PI
          const approxPos: [number, number] = [pos[0] + Math.cos(angle) * 0.006, pos[1] + Math.sin(angle) * 0.008]

          return (
            <Marker key={del.id} position={approxPos} icon={makeDriverIcon(initials, late ? 'late' : 'in_route')}>
              <Popup>
                <div style={{ fontSize: 12, minWidth: 150 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{name}</div>
                  <div style={{ color: '#6B7280' }}>Cliente: {del.customer_name}</div>
                  {mins !== null && (
                    <div style={{ color: late ? '#B45309' : '#7C3AED', marginTop: 3, fontWeight: 500 }}>
                      {mins} min en ruta{late ? ' · ATRASADO' : ''}
                    </div>
                  )}
                  <div style={{ color: '#9CA3AF', marginTop: 4, fontSize: 11 }}>Sin GPS · posicion estimada</div>
                </div>
              </Popup>
            </Marker>
          )
        })
      }

      <RecenterButton pos={pos} />
    </MapContainer>
  )
}
