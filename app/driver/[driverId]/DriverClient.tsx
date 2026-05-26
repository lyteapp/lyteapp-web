'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

type ActiveDelivery = {
  customer_name: string
  delivery_address: string
  status: string
  notes: string | null
}

type Props = {
  driverId: string
  driverName: string
  storeId: string
  storeName: string
  storeLogo: string | null
  activeDelivery: ActiveDelivery | null
}

type Status = 'requesting' | 'sharing' | 'error' | 'stopped'

export default function DriverClient({ driverId, driverName, storeId, storeName, storeLogo, activeDelivery }: Props) {
  const [status, setStatus]         = useState<Status>('requesting')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [accuracy, setAccuracy]     = useState<number | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')

  const watchId  = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    await supabase.from('driver_locations').upsert({
      driver_id:  driverId,
      store_id:   storeId,
      lat, lng,
      is_sharing: true,
      updated_at: new Date().toISOString(),
    })
    setLastUpdate(new Date())
  }, [driverId, storeId])

  const startSharing = useCallback(async () => {
    if (!navigator.geolocation) {
      setErrorMsg('GPS no disponible en este dispositivo')
      setStatus('error')
      return
    }

    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
      }
    } catch { /* wake lock not critical */ }

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        sendLocation(pos.coords.latitude, pos.coords.longitude)
        setAccuracy(Math.round(pos.coords.accuracy))
        setStatus('sharing')
        setErrorMsg('')
      },
      err => {
        setErrorMsg(err.code === 1
          ? 'Permiso de GPS denegado. Activa la ubicacion en los ajustes del navegador.'
          : 'Error al obtener ubicacion GPS.')
        setStatus('error')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 4000 }
    )
  }, [sendLocation])

  const stopSharing = useCallback(async () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    try { await wakeLock.current?.release() } catch { /* ignore */ }
    wakeLock.current = null

    await supabase.from('driver_locations').upsert({
      driver_id:  driverId,
      store_id:   storeId,
      lat: 0, lng: 0,
      is_sharing: false,
      updated_at: new Date().toISOString(),
    })

    setStatus('stopped')
    setLastUpdate(null)
    setAccuracy(null)
  }, [driverId, storeId])

  // Auto-start GPS when page loads (triggered by scanning QR)
  useEffect(() => {
    startSharing()
  }, [startSharing])

  // Re-acquire wake lock if tab becomes visible again
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'visible' && status === 'sharing') {
        try {
          if ('wakeLock' in navigator && (!wakeLock.current || wakeLock.current.released)) {
            wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
          }
        } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status])

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      wakeLock.current?.release().catch(() => {})
    }
  }, [])

  function fmtTime(d: Date) {
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const isSharing = status === 'sharing'

  return (
    <div className="drc-root">
      <div className="drc-header">
        {storeLogo
          ? <img src={storeLogo} alt={storeName} className="drc-logo" />
          : <div className="drc-logo-placeholder">{storeName[0]?.toUpperCase()}</div>
        }
        <span className="drc-store">{storeName}</span>
      </div>

      <div className="drc-body">
        <div className="drc-greeting">Hola, {driverName}</div>

        {/* Animated GPS orb */}
        <div className={`drc-orb${isSharing ? ' active' : ''}`}>
          {isSharing && <div className="drc-pulse" />}
          {isSharing && <div className="drc-pulse delay" />}
          {status === 'requesting' && <div className="drc-spinner" />}
          <svg viewBox="0 0 56 56" fill="none" width="52" height="52">
            <path
              d="M28 6C18.06 6 10 14.06 10 24c0 15.4 18 30 18 30s18-14.6 18-30C46 14.06 37.94 6 28 6z"
              fill={isSharing ? '#fff' : '#94A3B8'}
            />
            <circle cx="28" cy="24" r="8"
              fill={isSharing ? 'rgba(124,58,237,0.5)' : '#CBD5E1'}
            />
          </svg>
        </div>

        {/* Status row */}
        <div className={`drc-status${isSharing ? ' on' : status === 'error' ? ' err' : ''}`}>
          <span className="drc-dot" />
          <span>
            {status === 'requesting' && 'Solicitando acceso al GPS...'}
            {status === 'sharing'    && 'Compartiendo ubicacion en tiempo real'}
            {status === 'stopped'    && 'Rastreo detenido'}
            {status === 'error'      && (errorMsg || 'Error de GPS')}
          </span>
        </div>

        {/* Stop / Retry button */}
        {isSharing && (
          <button className="drc-btn on" onClick={stopSharing}>
            Detener rastreo
          </button>
        )}
        {status === 'stopped' && (
          <button className="drc-btn" onClick={startSharing}>
            Reactivar rastreo
          </button>
        )}
        {status === 'error' && (
          <button className="drc-btn" onClick={startSharing}>
            Reintentar
          </button>
        )}

        {/* GPS accuracy / update info */}
        {isSharing && (
          <div className="drc-info">
            {lastUpdate && (
              <div className="drc-info-row">
                <span>Ultima actualizacion</span>
                <span>{fmtTime(lastUpdate)}</span>
              </div>
            )}
            {accuracy !== null && (
              <div className="drc-info-row">
                <span>Precision GPS</span>
                <span>±{accuracy}m</span>
              </div>
            )}
          </div>
        )}

        {/* Active delivery card */}
        {activeDelivery && (
          <div className="drc-delivery-card">
            <div className="drc-delivery-label">
              {activeDelivery.status === 'picked_up' ? 'Entrega en curso' : 'Entrega asignada'}
            </div>
            <div className="drc-delivery-name">{activeDelivery.customer_name}</div>
            {activeDelivery.delivery_address && (
              <div className="drc-delivery-address">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.938 4.5 8.5 4.5 8.5S12.5 9.938 12.5 6c0-2.485-2.015-4.5-4.5-4.5z"/>
                  <circle cx="8" cy="6" r="1.5"/>
                </svg>
                {activeDelivery.delivery_address}
              </div>
            )}
            {activeDelivery.notes && (
              <div className="drc-delivery-notes">{activeDelivery.notes}</div>
            )}
          </div>
        )}

        {isSharing && (
          <div className="drc-notice">
            Manten esta pantalla abierta para continuar compartiendo tu ubicacion.
          </div>
        )}
      </div>
    </div>
  )
}
