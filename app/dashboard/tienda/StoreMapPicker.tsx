'use client'

import { useRef, useEffect, useCallback } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl'
import type { MapRef, MarkerDragEvent, MapMouseEvent } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  lat: number | null
  lng: number | null
  mapboxToken: string
  onLocationChange: (lat: number, lng: number) => void
}

// Default center: Caracas, Venezuela
const DEFAULT_LNG = -66.9036
const DEFAULT_LAT =  10.4806

export default function StoreMapPicker({ lat, lng, mapboxToken, onLocationChange }: Props) {
  const mapRef = useRef<MapRef>(null)

  // Fly to new coords when parent geocodes or detects location
  useEffect(() => {
    if (lat != null && lng != null) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 700 })
    }
  }, [lat, lng])

  const handleDragEnd = useCallback((e: MarkerDragEvent) => {
    onLocationChange(e.lngLat.lat, e.lngLat.lng)
  }, [onLocationChange])

  const handleClick = useCallback((e: MapMouseEvent) => {
    onLocationChange(e.lngLat.lat, e.lngLat.lng)
  }, [onLocationChange])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: lng ?? DEFAULT_LNG,
          latitude:  lat ?? DEFAULT_LAT,
          zoom: lat != null ? 16 : 11,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/standard"
        mapboxAccessToken={mapboxToken}
        onClick={handleClick}
        attributionControl={false}
        cursor="crosshair"
      >
        <NavigationControl position="top-right" showCompass={false} />

        {lat != null && lng != null && (
          <Marker
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            draggable
            onDragEnd={handleDragEnd}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#7C3AED', border: '3px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
              cursor: 'grab',
              transition: 'transform 0.15s',
            }}>
              <svg viewBox="0 0 20 20" fill="white" width="20" height="20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
            </div>
          </Marker>
        )}
      </Map>

      {/* Hint overlay — shown only when no pin placed yet */}
      {(lat == null || lng == null) && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(4px)',
            color: 'white', borderRadius: 100, padding: '7px 16px',
            fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 20 20" fill="white" width="13" height="13">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
            </svg>
            Haz clic para ubicar tu tienda
          </div>
        </div>
      )}
    </div>
  )
}
