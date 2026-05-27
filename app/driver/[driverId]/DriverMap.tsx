'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, Circle, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const customerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:44px;height:44px;border-radius:50%;
    background:#7C3AED;border:3px solid white;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 16px rgba(124,58,237,0.5);
  ">
    <svg viewBox="0 0 20 20" fill="white" width="20" height="20">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
    </svg>
  </div>`,
  iconSize:   [44, 44],
  iconAnchor: [22, 44],
})

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:#3B82F6;border:3px solid white;
    box-shadow:0 2px 10px rgba(59,130,246,0.6);
  "></div>`,
  iconSize:   [20, 20],
  iconAnchor: [10, 10],
})

function FitBounds({ customerPos, driverPos }: { customerPos: [number, number]; driverPos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (driverPos) {
      map.fitBounds(L.latLngBounds([customerPos, driverPos]), { padding: [50, 50], maxZoom: 16 })
    } else {
      map.setView(customerPos, 16)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPos[0], customerPos[1], driverPos?.[0], driverPos?.[1]])
  return null
}

function FollowDriver({ pos }: { pos: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(pos, Math.max(map.getZoom(), 17), { animate: true, duration: 0.6 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos[0], pos[1]])
  return null
}

interface Props {
  customerLat: number
  customerLng: number
  customerName: string
  driverLat: number | null
  driverLng: number | null
  routeCoords?: [number, number][]
  followDriver?: boolean
}

export default function DriverMap({
  customerLat, customerLng, customerName,
  driverLat, driverLng,
  routeCoords, followDriver,
}: Props) {
  const customerPos: [number, number] = [customerLat, customerLng]
  const driverPos: [number, number] | null = driverLat && driverLng ? [driverLat, driverLng] : null

  return (
    <MapContainer
      center={customerPos}
      zoom={16}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        opacity={0.85}
      />

      {/* Route polyline */}
      {routeCoords && routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{ color: '#7C3AED', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
        />
      )}

      {/* Customer pin */}
      <Marker position={customerPos} icon={customerIcon} />
      <Circle
        center={customerPos}
        radius={30}
        pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.15, weight: 0 }}
      />

      {/* Driver dot */}
      {driverPos && (
        <>
          <Marker position={driverPos} icon={driverIcon} />
          <Circle
            center={driverPos}
            radius={15}
            pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.2, weight: 0 }}
          />
        </>
      )}

      {followDriver && driverPos
        ? <FollowDriver pos={driverPos} />
        : <FitBounds customerPos={customerPos} driverPos={driverPos} />
      }

      {/* Customer name chip — only when not navigating */}
      {!followDriver && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'white', padding: '5px 12px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, color: '#0F172A',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
          maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {customerName}
        </div>
      )}
    </MapContainer>
  )
}
