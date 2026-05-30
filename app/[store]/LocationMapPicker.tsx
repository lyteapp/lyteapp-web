'use client'

import { useRef } from 'react'
import MapGL, { NavigationControl } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

type Props = {
  initialLat: number
  initialLng: number
  mapboxToken: string
  onConfirm: (lat: number, lng: number) => void
  onClose: () => void
}

export default function LocationMapPicker({ initialLat, initialLng, mapboxToken, onConfirm, onClose }: Props) {
  const mapRef = useRef<MapRef>(null)

  function confirm() {
    const c = mapRef.current?.getCenter()
    if (c) onConfirm(c.lat, c.lng)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: initialLng, latitude: initialLat, zoom: 16 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/standard"
        mapboxAccessToken={mapboxToken}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
      </MapGL>

      {/* Fixed pin at center — tip aligned to map center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none', zIndex: 10,
      }}>
        <svg viewBox="0 0 28 42" width="36" height="54" style={{ display: 'block', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.30))' }}>
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 28 14 28S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#7C3AED"/>
          <circle cx="14" cy="13" r="6" fill="white"/>
        </svg>
      </div>
      {/* Shadow dot at the exact map center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -2px)',
        width: 10, height: 5, borderRadius: '50%',
        background: 'rgba(0,0,0,0.22)',
        pointerEvents: 'none', zIndex: 9,
      }} />

      {/* Top hint */}
      <div style={{
        position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(6px)',
        color: 'white', borderRadius: 100, padding: '8px 18px',
        fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
        pointerEvents: 'none', zIndex: 10,
      }}>
        Mueve el mapa hasta la ubicacion de entrega
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 14, right: 14, zIndex: 11,
          width: 38, height: 38, borderRadius: '50%',
          background: 'white', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
        }}
      >
        <svg viewBox="0 0 20 20" fill="#374151" width="16" height="16">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>

      {/* Confirm button */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)',
      }}>
        <button
          onClick={confirm}
          style={{
            width: '100%', padding: '15px',
            background: '#7C3AED', color: 'white',
            border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
          }}
        >
          Confirmar ubicacion
        </button>
      </div>
    </div>
  )
}
