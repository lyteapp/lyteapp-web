'use client'

import { useEffect, useRef } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  driverLat:   number | null
  driverLng:   number | null
  customerLat: number | null
  customerLng: number | null
  storeLat?:   number | null
  storeLng?:   number | null
  height?:     number | string
  mapboxToken: string
  mapStyle?:   string
  accent?:     string
}

function pad(
  lats: number[], lngs: number[], p = 0.002
): [[number, number], [number, number]] {
  return [
    [Math.min(...lngs) - p, Math.min(...lats) - p],
    [Math.max(...lngs) + p, Math.max(...lats) + p],
  ]
}

export default function TrackingMap({
  driverLat, driverLng,
  customerLat, customerLng,
  storeLat, storeLng,
  height = 260,
  mapboxToken,
  mapStyle = 'mapbox://styles/mapbox/standard',
  accent = '#7C3AED',
}: Props) {
  const mapRef  = useRef<MapRef>(null)
  const loaded  = useRef(false)

  const hasDriver   = driverLat   != null && driverLng   != null
  const hasCustomer = customerLat != null && customerLng != null
  const hasStore    = storeLat    != null && storeLng    != null

  // ── Initial camera on map load ──────────────────────────────────────────
  function fitInitial() {
    const map = mapRef.current
    if (!map) return

    if (hasDriver && hasCustomer) {
      map.fitBounds(pad([driverLat!, customerLat!], [driverLng!, customerLng!]),
        { padding: 64, maxZoom: 16, duration: 800 })
    } else if (hasStore && hasCustomer) {
      map.fitBounds(pad([storeLat!, customerLat!], [storeLng!, customerLng!]),
        { padding: 64, maxZoom: 14, duration: 800 })
    } else if (hasStore) {
      map.flyTo({ center: [storeLng!, storeLat!], zoom: 15, duration: 600 })
    } else if (hasCustomer) {
      map.flyTo({ center: [customerLng!, customerLat!], zoom: 15, duration: 600 })
    }
  }

  // ── Follow driver when GPS updates ─────────────────────────────────────
  useEffect(() => {
    if (!loaded.current || !mapRef.current || !hasDriver) return
    const map = mapRef.current
    if (hasCustomer) {
      map.fitBounds(pad([driverLat!, customerLat!], [driverLng!, customerLng!]),
        { padding: 64, maxZoom: 16, duration: 900 })
    } else {
      map.flyTo({ center: [driverLng!, driverLat!], zoom: 15, duration: 700 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng])

  // Default center fallback
  const initLng = driverLng ?? storeLng ?? customerLng ?? -66.9
  const initLat = driverLat ?? storeLat ?? customerLat ?? 10.5

  return (
    <div style={{ width: '100%', height }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: initLng, latitude: initLat, zoom: 13 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        mapboxAccessToken={mapboxToken}
        scrollZoom
        doubleClickZoom
        touchZoomRotate
        dragRotate={false}
        attributionControl={false}
        onLoad={() => { loaded.current = true; fitInitial() }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Store pin — shown when no driver yet */}
        {hasStore && !hasDriver && (
          <Marker longitude={storeLng!} latitude={storeLat!} anchor="bottom">
            <div style={{
              background: accent, border: '3px solid white',
              borderRadius: 12, padding: '5px 10px',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: `0 4px 14px ${accent}55`,
              whiteSpace: 'nowrap' as const,
            }}>
              <svg viewBox="0 0 20 20" fill="white" width={13} height={13}>
                <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 7v9a1 1 0 001 1h3a1 1 0 001-1V12a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V7a1 1 0 00-.504-.868l-7-4z" clipRule="evenodd"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>Tu tienda</span>
            </div>
          </Marker>
        )}

        {/* Driver pin */}
        {hasDriver && (
          <Marker longitude={driverLng!} latitude={driverLat!} anchor="center">
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: accent, border: '3px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${accent}55`,
            }}>
              <svg viewBox="0 0 20 20" fill="white" width={18} height={18}>
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h1a1 1 0 00.9-.561l2-4A1 1 0 0014 9h-3V5a1 1 0 00-1-1H3z"/>
              </svg>
            </div>
          </Marker>
        )}

        {/* Customer pin */}
        {hasCustomer && (
          <Marker longitude={customerLng!} latitude={customerLat!} anchor="center">
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
