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
  storeLogo?:  string | null
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
  storeLat, storeLng, storeLogo,
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

        {/* Store marker — 3D building with logo, shown while driver not yet assigned */}
        {hasStore && !hasDriver && (
          <Marker longitude={storeLng!} latitude={storeLat!} anchor="bottom">
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.24))',
            }}>
              {/* Logo circle */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid white', overflow: 'hidden',
                background: '#F1F5F9', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {storeLogo
                  ? <img src={storeLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (
                    <svg viewBox="0 0 20 20" fill={accent} width="22" height="22">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 4H2v7a2 2 0 002 2h12a2 2 0 002-2V8zm-8 3a1 1 0 011 1v2a1 1 0 01-2 0v-2a1 1 0 011-1z" clipRule="evenodd"/>
                    </svg>
                  )
                }
              </div>
              {/* 3D building */}
              <svg viewBox="0 0 44 36" width="42" height="33" style={{ display: 'block', marginTop: -7 }}>
                {/* Top face */}
                <polygon points="2,14 30,14 42,6 14,6" fill={accent} />
                <polygon points="2,14 30,14 42,6 14,6" fill="rgba(255,255,255,0.22)" />
                {/* Right face */}
                <polygon points="30,14 42,6 42,30 30,36" fill={accent} />
                <polygon points="30,14 42,6 42,30 30,36" fill="rgba(0,0,0,0.28)" />
                {/* Front face */}
                <rect x="2" y="14" width="28" height="22" fill={accent} />
                {/* Front windows */}
                <rect x="5" y="18" width="9" height="7" rx="1.5" fill="rgba(255,255,255,0.65)" />
                <rect x="16" y="18" width="9" height="7" rx="1.5" fill="rgba(255,255,255,0.65)" />
                {/* Door */}
                <rect x="10" y="28" width="9" height="8" rx="1" fill="rgba(0,0,0,0.25)" />
                {/* Right side window */}
                <polygon points="33,17 39.5,13 39.5,20 33,22.5" fill="rgba(255,255,255,0.4)" />
              </svg>
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
