'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import MapGL, { Marker, NavigationControl, Source, Layer } from 'react-map-gl'
import type { MapRef, MapMouseEvent } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

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
  mapboxToken: string
}

function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const R = 6371000
  const dLat = (radiusM / R) * (180 / Math.PI)
  const dLng = dLat / Math.cos((lat * Math.PI) / 180)
  const coords: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
}

export default function ZonesMap({ zones, placingZone, onMapClick, previewCenter, previewRadius, previewColor, onUserPos, mapboxToken }: Props) {
  const mapRef = useRef<MapRef>(null)
  const reportedPos = useRef(false)
  const [pos, setPos]     = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) { setError('Geolocalización no disponible'); return }
    navigator.geolocation.getCurrentPosition(
      p => {
        const coords: [number, number] = [p.coords.latitude, p.coords.longitude]
        setPos(coords)
        if (!reportedPos.current) { reportedPos.current = true; onUserPos?.(coords[0], coords[1]) }
      },
      () => setError('Activa la ubicacion en tu navegador para usar el mapa de zonas.'),
      { enableHighAccuracy: true },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = placingZone ? 'crosshair' : ''
  }, [placingZone])

  const handleClick = useCallback((e: MapMouseEvent) => {
    if (placingZone) onMapClick?.(e.lngLat.lat, e.lngLat.lng)
  }, [placingZone, onMapClick])

  const fill: React.CSSProperties = { position: 'absolute', inset: 0 }

  if (error) return (
    <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', padding: 24, textAlign: 'center', gap: 12 }}>
      <svg viewBox="0 0 20 20" fill="#9CA3AF" width="32" height="32"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
      <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 220, lineHeight: 1.5 }}>{error}</div>
    </div>
  )

  if (!pos) return (
    <div style={{ ...fill, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Obteniendo ubicacion...</span>
    </div>
  )

  return (
    <div style={fill}>
      {placingZone && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: '#4C1D95', color: 'white', padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(76,29,149,0.4)' }}>
          Toca el mapa para colocar el centro de la zona
        </div>
      )}

      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: pos[1], latitude: pos[0], zoom: 13 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/standard"
        mapboxAccessToken={mapboxToken}
        attributionControl={false}
        onClick={handleClick}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Recenter */}
        <button
          onClick={e => { e.stopPropagation(); mapRef.current?.flyTo({ center: [pos[1], pos[0]], zoom: 13, duration: 600 }) }}
          style={{ position: 'absolute', bottom: 80, right: 14, zIndex: 10, width: 32, height: 32, borderRadius: 8, background: 'white', border: '0.5px solid rgba(15,23,42,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <svg viewBox="0 0 20 20" fill="#4C1D95" width="14" height="14">
            <path fillRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd"/>
          </svg>
        </button>

        {/* Store marker */}
        <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#4C1D95', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(76,29,149,0.4)' }}>
            <svg viewBox="0 0 20 20" fill="white" width="18" height="18"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
          </div>
        </Marker>

        {/* Existing zones */}
        {zones.map(z => (
          <Source key={z.id} id={`zone-${z.id}`} type="geojson" data={circlePolygon(z.center_lat, z.center_lng, z.radius_m)}>
            <Layer id={`zone-fill-${z.id}`} type="fill" paint={{ 'fill-color': z.color, 'fill-opacity': 0.12 }} />
            <Layer id={`zone-line-${z.id}`} type="line" paint={{ 'line-color': z.color, 'line-width': 2, 'line-opacity': 0.85 }} />
          </Source>
        ))}

        {/* Zone labels */}
        {zones.map(z => (
          <Marker key={`lbl-${z.id}`} longitude={z.center_lng} latitude={z.center_lat} anchor="center">
            <div style={{ background: 'white', border: `1.5px solid ${z.color}`, borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#0F172A', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none' }}>
              {z.name} · ${z.fee.toFixed(2)}
            </div>
          </Marker>
        ))}

        {/* Preview zone while placing */}
        {previewCenter && (previewRadius ?? 0) > 0 && (
          <Source id="zone-preview" type="geojson" data={circlePolygon(previewCenter[0], previewCenter[1], previewRadius!)}>
            <Layer id="zone-preview-fill" type="fill" paint={{ 'fill-color': previewColor ?? '#7C3AED', 'fill-opacity': 0.18 }} />
            <Layer id="zone-preview-line" type="line" paint={{ 'line-color': previewColor ?? '#7C3AED', 'line-width': 2, 'line-dasharray': [3, 2] }} />
          </Source>
        )}

        {/* Preview center dot */}
        {previewCenter && (
          <Marker longitude={previewCenter[1]} latitude={previewCenter[0]} anchor="center">
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: previewColor ?? '#7C3AED', border: '2.5px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
          </Marker>
        )}

      </MapGL>
    </div>
  )
}
