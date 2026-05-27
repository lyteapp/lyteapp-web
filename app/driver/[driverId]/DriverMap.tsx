'use client'

import { useEffect, useRef, useState } from 'react'
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

function calcBearing([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const lat1R = lat1 * Math.PI / 180
  const lat2R = lat2 * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2R)
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function haversine([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function routeBearing(driverPos: [number, number], coords: [number, number][]): number {
  let minD = Infinity, idx = 0
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(driverPos, coords[i])
    if (d < minD) { minD = d; idx = i }
  }
  const next = Math.min(idx + 3, coords.length - 1)
  return next === idx ? 0 : calcBearing(coords[idx], coords[next])
}

interface Props {
  customerLat: number
  customerLng: number
  customerName: string
  driverLat: number | null
  driverLng: number | null
  routeCoords?: [number, number][]
  followDriver?: boolean
  heading?: number | null
  mapboxToken: string
}

export default function DriverMap({
  customerLat, customerLng, customerName,
  driverLat, driverLng,
  routeCoords, followDriver, heading, mapboxToken,
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [loaded, setLoaded] = useState(false)
  const [mapBearing, setMapBearing] = useState(0)
  const driverPos: [number, number] | null = driverLat && driverLng ? [driverLat, driverLng] : null

  useEffect(() => {
    if (!loaded || !mapRef.current) return
    const map = mapRef.current

    if (followDriver && driverPos) {
      const bearing = routeCoords && routeCoords.length > 2
        ? routeBearing(driverPos, routeCoords)
        : 0
      map.flyTo({
        center: [driverPos[1], driverPos[0]],
        zoom: 18,
        pitch: 60,
        bearing,
        speed: 0.5,
        curve: 1,
        essential: true,
      })
    } else {
      if (driverPos) {
        map.fitBounds(
          [
            [Math.min(driverPos[1], customerLng) - 0.001, Math.min(driverPos[0], customerLat) - 0.001],
            [Math.max(driverPos[1], customerLng) + 0.001, Math.max(driverPos[0], customerLat) + 0.001],
          ],
          { padding: 64, maxZoom: 16, pitch: 0, bearing: 0, duration: 800 }
        )
      } else {
        map.flyTo({ center: [customerLng, customerLat], zoom: 16, pitch: 0, bearing: 0, duration: 800 })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, followDriver, driverPos?.[0], driverPos?.[1]])

  const geojsonRoute = routeCoords && routeCoords.length > 0
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          // routeCoords are [lat, lng]; GeoJSON needs [lng, lat]
          coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
        },
      }
    : null

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: customerLng, latitude: customerLat, zoom: 16, pitch: 0, bearing: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/standard"
      mapboxAccessToken={mapboxToken}
      scrollZoom
      doubleClickZoom
      touchZoomRotate
      dragRotate={false}
      attributionControl={false}
      onLoad={() => setLoaded(true)}
      onMove={e => setMapBearing(e.viewState.bearing)}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* Route polyline */}
      {geojsonRoute && (
        <Source id="route" type="geojson" data={geojsonRoute}>
          <Layer
            id="route-casing"
            type="line"
            paint={{ 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.6 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="route-line"
            type="line"
            paint={{ 'line-color': '#7C3AED', 'line-width': 6, 'line-opacity': 1 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
      )}

      {/* Customer pin */}
      <Marker longitude={customerLng} latitude={customerLat} anchor="bottom">
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: '#7C3AED', border: '3px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
          cursor: 'default',
        }}>
          <svg viewBox="0 0 20 20" fill="white" width={20} height={20}>
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
          </svg>
        </div>
      </Marker>

      {/* Driver arrow */}
      {driverPos && (
        <Marker longitude={driverPos[1]} latitude={driverPos[0]} anchor="center">
          <div style={{
            transform: `rotate(${((heading ?? 0) - mapBearing + 360) % 360}deg)`,
            transition: 'transform 0.5s ease-out',
            filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))',
            width: 36, height: 45,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 32 40" width="32" height="40" style={{ overflow: 'visible' }}>
              {/* shadow */}
              <ellipse cx="16" cy="39" rx="9" ry="2.5" fill="rgba(0,0,0,0.22)" />
              {/* left face — lit */}
              <path d="M16 2 L3 36 L16 29 Z" fill="#60A5FA" />
              {/* right face — shadow */}
              <path d="M16 2 L29 36 L16 29 Z" fill="#1D4ED8" />
              {/* bottom concave strip */}
              <path d="M3 36 Q16 41 29 36 L16 29 Z" fill="#2563EB" />
              {/* center highlight ridge */}
              <line x1="16" y1="2" x2="16" y2="29" stroke="rgba(255,255,255,0.42)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </Marker>
      )}

      {/* Customer name chip — only in overview mode */}
      {!followDriver && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: 'white', padding: '5px 14px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, color: '#0F172A',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
          maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis',
          pointerEvents: 'none',
        }}>
          {customerName}
        </div>
      )}
    </Map>
  )
}
