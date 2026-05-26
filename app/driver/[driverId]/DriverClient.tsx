'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

type Props = {
  driverId: string
  driverName: string
  storeId: string
  storeName: string
  storeLogo: string | null
}

type Status = 'idle' | 'sharing' | 'error'

export default function DriverClient({ driverId, driverName, storeId, storeName, storeLogo }: Props) {
  const [isSharing, setIsSharing]     = useState(false)
  const [status, setStatus]           = useState<Status>('idle')
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null)
  const [accuracy, setAccuracy]       = useState<number | null>(null)
  const [errorMsg, setErrorMsg]       = useState('')

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

  const startSharing = async () => {
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

    setIsSharing(true)

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        sendLocation(pos.coords.latitude, pos.coords.longitude)
        setAccuracy(Math.round(pos.coords.accuracy))
        setStatus('sharing')
        setErrorMsg('')
      },
      err => {
        setErrorMsg(err.code === 1 ? 'Permiso de GPS denegado. Activa la ubicacion en ajustes.' : 'Error al obtener ubicacion GPS.')
        setStatus('error')
        setIsSharing(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 4000 }
    )
  }

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

    setIsSharing(false)
    setStatus('idle')
    setLastUpdate(null)
    setAccuracy(null)
  }, [driverId, storeId])

  // Re-acquire wake lock if tab becomes visible again
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'visible' && isSharing) {
        try {
          if ('wakeLock' in navigator && (!wakeLock.current || wakeLock.current.released)) {
            wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
          }
        } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [isSharing])

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      wakeLock.current?.release().catch(() => {})
    }
  }, [])

  function fmtTime(d: Date) {
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

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

        <button
          className={`drc-btn${isSharing ? ' on' : ''}`}
          onClick={isSharing ? stopSharing : startSharing}
        >
          {isSharing ? 'Detener rastreo' : 'Activar rastreo'}
        </button>

        <div className={`drc-status${status === 'sharing' ? ' on' : status === 'error' ? ' err' : ''}`}>
          <span className="drc-dot" />
          <span>
            {status === 'idle'    && 'Rastreo desactivado'}
            {status === 'sharing' && 'Compartiendo ubicacion en tiempo real'}
            {status === 'error'   && (errorMsg || 'Error de GPS')}
          </span>
        </div>

        {status === 'sharing' && (
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

        {isSharing && (
          <div className="drc-notice">
            Mantén esta pantalla abierta para continuar compartiendo tu ubicacion con el negocio.
          </div>
        )}
      </div>
    </div>
  )
}
