'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconFix = () => { delete (L.Icon.Default.prototype as any)._getIconUrl; L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' }) }

const storeIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;border-radius:10px;background:#4C1D95;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(76,29,149,0.4);border:2px solid white;">
    <svg viewBox="0 0 20 20" fill="white" width="18" height="18"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
  </div>`,
  iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38],
})

function makeClickIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:translate(-50%,-50%)"></div>`,
    iconSize: [1, 1], iconAnchor: [0, 0],
  })
}

function ClickHandler({ active, onMapClick }: { active: boolean; onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterButton({ pos }: { pos: [number, number] }) {
  const map = useMap()
  return (
    <button
      onClick={() => map.setView(pos, map.getZoom())}
      style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 1000, width: 32, height: 32, borderRadius: 8, background: 'white', border: '0.5px solid rgba(15,23,42,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      title="Mi ubicacion"
    >
      <svg viewBox="0 0 20 20" fill="#4C1D95" width="14" height="14"><path fillRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd"/></svg>
    </button>
  )
}

export type DeliveryZone = {
  id: string
  name: string
  fee: number
  color: string
  radius_m: number
  center_lat: number
  center_lng: number
}

type Props = {
  zones: DeliveryZone[]
  placingZone: boolean
  onMapClick?: (lat: number, lng: number) => void
  previewCenter?: [number, number] | null
  previewRadius?: number
  previewColor?: string
  onUserPos?: (lat: number, lng: number) => void
}

export default function ZonesMap({ zones, placingZone, onMapClick, previewCenter, previewRadius, previewColor, onUserPos }: Props) {
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reportedPos = useState(false)

  useEffect(() => {
    iconFix()
    if (!navigator.geolocation) { setError('Geolocalización no disponible'); return }
    navigator.geolocation.getCurrentPosition(
      p => {
        const coords: [number, number] = [p.coords.latitude, p.coords.longitude]
        setPos(coords)
        if (!reportedPos[0]) { reportedPos[1](true); onUserPos?.(coords[0], coords[1]) }
      },
      () => setError('Activa la ubicacion en tu navegador para usar el mapa de zonas.'),
      { enableHighAccuracy: true }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', padding: 24, textAlign: 'center', gap: 12 }}>
      <svg viewBox="0 0 20 20" fill="#9CA3AF" width="32" height="32"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
      <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 220, lineHeight: 1.5 }}>{error}</div>
    </div>
  )

  if (!pos) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Obteniendo ubicacion...</span>
    </div>
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {placingZone && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#4C1D95', color: 'white', padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(76,29,149,0.4)' }}>
          Toca el mapa para colocar el centro de la zona
        </div>
      )}
      <MapContainer
        center={pos}
        zoom={13}
        style={{ flex: 1, width: '100%', cursor: placingZone ? 'crosshair' : undefined }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <ClickHandler active={placingZone} onMapClick={onMapClick} />

        {/* Store / user location */}
        <Marker position={pos} icon={storeIcon}>
          <Popup><strong style={{ color: '#4C1D95' }}>Tu tienda</strong></Popup>
        </Marker>

        {/* Existing zones */}
        {zones.map(z => (
          <Circle
            key={z.id}
            center={[z.center_lat, z.center_lng]}
            radius={z.radius_m}
            pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.12, weight: 2 }}
          >
            <Popup>
              <div style={{ fontSize: 12 }}>
                <strong>{z.name}</strong>
                <div style={{ color: '#6B7280', marginTop: 3 }}>${z.fee.toFixed(2)} · {(z.radius_m / 1000).toFixed(1)} km</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Preview zone while placing */}
        {previewCenter && (previewRadius ?? 0) > 0 && (
          <>
            <Circle
              center={previewCenter}
              radius={previewRadius!}
              pathOptions={{ color: previewColor ?? '#7C3AED', fillColor: previewColor ?? '#7C3AED', fillOpacity: 0.18, weight: 2, dashArray: '8 5' }}
            />
            <Marker position={previewCenter} icon={makeClickIcon(previewColor ?? '#7C3AED')} />
          </>
        )}

        <RecenterButton pos={pos} />
      </MapContainer>
    </div>
  )
}
