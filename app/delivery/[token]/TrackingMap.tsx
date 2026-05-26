'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;border-radius:50%;background:#7C3AED;border:3px solid white;box-shadow:0 3px 12px rgba(124,58,237,0.5);display:flex;align-items:center;justify-content:center;">
    <svg viewBox="0 0 20 20" fill="white" width="18" height="18">
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -24],
})

const customerIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#10B981;border:3px solid white;box-shadow:0 3px 10px rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;">
    <svg viewBox="0 0 20 20" fill="white" width="14" height="14">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20],
})

function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([lat, lng], { animate: true, duration: 0.5 })
  }, [lat, lng, map])
  return null
}

interface Props {
  driverLat: number | null
  driverLng: number | null
  customerLat: number | null
  customerLng: number | null
}

export default function TrackingMap({ driverLat, driverLng, customerLat, customerLng }: Props) {
  if (!driverLat || !driverLng) {
    return (
      <div style={{ width: '100%', height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'trSpin 0.8s linear infinite', marginBottom: 12 }} />
        <div style={{ fontSize: 13, color: '#64748B' }}>Esperando ubicacion del despachador...</div>
      </div>
    )
  }

  return (
    <MapContainer
      center={[driverLat, driverLng]}
      zoom={15}
      style={{ width: '100%', height: 260, borderRadius: 16 }}
      zoomControl
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[driverLat, driverLng]} icon={driverIcon}>
        <Popup>Tu pedido en camino</Popup>
      </Marker>
      {customerLat && customerLng && (
        <Marker position={[customerLat, customerLng]} icon={customerIcon}>
          <Popup>Tu ubicacion</Popup>
        </Marker>
      )}
      <PanTo lat={driverLat} lng={driverLng} />
    </MapContainer>
  )
}
