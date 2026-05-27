'use client'

import { useEffect, useRef, useState } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  driverLat: number | null
  driverLng: number | null
  customerLat: number | null
  customerLng: number | null
  height?: number | string
  mapboxToken: string
  mapStyle?: string
}

export default function TrackingMap({
  driverLat, driverLng, customerLat, customerLng,
  height = 260,
  mapboxToken,
  mapStyle = 'mapbox://styles/mapbox/standard',
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [loaded, setLoaded] = useState(false)

  const hasDriver = driverLat != null && driverLng != null

  useEffect(() => {
    if (!loaded || !mapRef.current || !hasDriver) return
    const map = mapRef.current

    if (customerLat != null && customerLng != null) {
      map.fitBounds(
        [
          [Math.min(driverLng!, customerLng) - 0.001, Math.min(driverLat!, customerLat) - 0.001],
          [Math.max(driverLng!, customerLng) + 0.001, Math.max(driverLat!, customerLat) + 0.001],
        ],
        { padding: 60, maxZoom: 16, duration: 800 }
      )
    } else {
      map.flyTo({ center: [driverLng!, driverLat!], zoom: 15, duration: 600 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, driverLat, driverLng])

  if (!hasDriver) {
    return (
      <div style={{
        width: '100%', height,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F8FAFC', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.15)',
          borderTopColor: '#7C3AED',
          animation: 'trSpin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: '#64748B' }}>Esperando ubicacion del despachador...</div>
      </div>
    )
  }

  const center: [number, number] = [driverLng!, driverLat!]

  return (
    <div style={{ width: '100%', height }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: center[0], latitude: center[1], zoom: 15 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        mapboxAccessToken={mapboxToken}
        scrollZoom={false}
        doubleClickZoom
        touchZoomRotate
        dragRotate={false}
        attributionControl={false}
        onLoad={() => setLoaded(true)}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Driver marker */}
        <Marker longitude={driverLng!} latitude={driverLat!} anchor="center">
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: '#7C3AED', border: '3px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
          }}>
            <svg viewBox="0 0 20 20" fill="white" width={18} height={18}>
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
            </svg>
          </div>
        </Marker>

        {/* Customer marker */}
        {customerLat != null && customerLng != null && (
          <Marker longitude={customerLng} latitude={customerLat} anchor="center">
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#10B981', border: '3px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(16,185,129,0.45)',
            }}>
              <svg viewBox="0 0 20 20" fill="white" width={14} height={14}>
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  )
}
