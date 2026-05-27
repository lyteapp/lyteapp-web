'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import type { AvailableOrder, ActiveDelivery } from './page'

const DriverMap = dynamic(() => import('./DriverMap'), { ssr: false, loading: () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4' }}>
    <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite' }} />
  </div>
) })

type Props = {
  driverId: string
  driverName: string
  driverAvatar: string | null
  storeId: string
  storeName: string
  storeLogo: string | null
  initialOrders: AvailableOrder[]
  initialDelivery: ActiveDelivery | null
  mapboxToken: string
}

type GpsStatus  = 'requesting' | 'active' | 'error' | 'stopped'
type InstallState = 'hidden' | 'ios' | 'android' | 'installed'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

type NavStep = {
  instruction: string
  distanceM: number
  maneuverPos: [number, number]
  modifier: string
}

function haversineDistance([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`
}

function buildInstruction(type: string, modifier: string, name: string): string {
  const via = name ? ` en ${name}` : ''
  if (type === 'depart')   return `Inicia la ruta${via}`
  if (type === 'arrive')   return 'Llegaste al destino'
  if (type === 'turn' || type === 'end of road') {
    if (modifier === 'uturn')       return `Da vuelta en U${via}`
    if (modifier === 'sharp left')  return `Gira fuerte a la izquierda${via}`
    if (modifier === 'sharp right') return `Gira fuerte a la derecha${via}`
    if (modifier === 'left')        return `Gira a la izquierda${via}`
    if (modifier === 'right')       return `Gira a la derecha${via}`
    if (modifier === 'slight left') return `Leve a la izquierda${via}`
    if (modifier === 'slight right') return `Leve a la derecha${via}`
    return `Continua${via}`
  }
  if (type === 'fork') {
    if (modifier?.includes('left'))  return `Toma la izquierda en el cruce${via}`
    if (modifier?.includes('right')) return `Toma la derecha en el cruce${via}`
  }
  if (type === 'merge')     return `Incorporese${via}`
  if (type === 'on ramp')   return `Toma la rampa${via}`
  if (type === 'off ramp')  return `Sal de la autopista${via}`
  if (type === 'roundabout' || type === 'rotary') return `Toma la rotonda${via}`
  return `Continua${via}`
}

function NavArrow({ modifier }: { modifier: string }) {
  const style = { color: 'white', width: 28, height: 28 }
  if (modifier === 'arrive') return (
    <svg {...style} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.07-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
    </svg>
  )
  if (modifier === 'uturn') return (
    <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h13a5 5 0 010 10H3"/>
      <path d="M7 5L3 9l4 4"/>
    </svg>
  )
  if (modifier === 'sharp left' || modifier === 'left') return (
    <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19V9m0 0L5 13m4-4l4 4M15 5v5a5 5 0 005 5h-1"/>
    </svg>
  )
  if (modifier === 'slight left') return (
    <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V8m0 0l-4 4m4-4l4 4M8 4v5a5 5 0 01-5 5h1"/>
    </svg>
  )
  if (modifier === 'sharp right' || modifier === 'right') return (
    <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 19V9m0 0l4 4m-4-4l-4 4M9 5v5a5 5 0 01-5 5h1"/>
    </svg>
  )
  if (modifier === 'slight right') return (
    <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V8m0 0l4 4m-4-4L8 12M16 4v5a5 5 0 005 5h-1"/>
    </svg>
  )
  // straight / default
  return (
    <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5m0 0l-4 4m4-4l4 4"/>
    </svg>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Ahora mismo'
  if (m < 60) return `Hace ${m} min`
  return `Hace ${Math.floor(m / 60)}h`
}

export default function DriverClient({
  driverId, driverName, driverAvatar, storeId, storeName, storeLogo,
  initialOrders, initialDelivery, mapboxToken,
}: Props) {
  const [orders, setOrders]             = useState<AvailableOrder[]>(initialOrders)
  const [delivery, setDelivery]         = useState<ActiveDelivery | null>(initialDelivery)
  const [claiming, setClaiming]         = useState<string | null>(null)
  const [completing, setCompleting]     = useState(false)
  const [errorMsg, setErrorMsg]         = useState('')
  const [gpsStatus, setGpsStatus]       = useState<GpsStatus>('requesting')
  const [accuracy, setAccuracy]         = useState<number | null>(null)
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null)
  const [driverPos, setDriverPos]       = useState<[number, number] | null>(null)
  const [installState, setInstallState] = useState<InstallState>('hidden')
  const [showIosHint, setShowIosHint]   = useState(false)
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // ── Navigation ────────────────────────────────────────────────────
  const [navMode, setNavMode]       = useState(false)
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([])
  const [navSteps, setNavSteps]     = useState<NavStep[]>([])
  const [navStepIdx, setNavStepIdx] = useState(0)
  const [navLoading, setNavLoading] = useState(false)
  const [totalDist, setTotalDist]   = useState(0)

  const watchId          = useRef<number | null>(null)
  const fallbackInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSentAt       = useRef<number>(0)
  const wakeLock         = useRef<WakeLockSentinel | null>(null)
  const lockRelease      = useRef<(() => void) | null>(null)
  const audioEl          = useRef<HTMLAudioElement | null>(null)

  // ── GPS ──────────────────────────────────────────────────────────
  const sendLocation = useCallback(async (lat: number, lng: number) => {
    lastSentAt.current = Date.now()
    setDriverPos([lat, lng])
    await supabase.from('driver_locations').upsert({
      driver_id: driverId, store_id: storeId,
      lat, lng, is_sharing: true,
      updated_at: new Date().toISOString(),
    })
    setLastUpdate(new Date())
  }, [driverId, storeId])

  const startGps = useCallback(async () => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }

    // 1. Screen wake lock — prevents display timeout
    try {
      if ('wakeLock' in navigator)
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
    } catch { /* not critical */ }

    // 2. Web Locks — tells Chrome this tab has active work; prevents background
    //    JS throttling even with screen locked (Chrome 69+, no user gesture needed)
    if ('locks' in navigator) {
      (navigator as Navigator & { locks: { request(name: string, opts: unknown, cb: () => Promise<void>): void } })
        .locks.request(`gps-${driverId}`, { mode: 'exclusive' }, () =>
          new Promise<void>(resolve => { lockRelease.current = resolve })
        )
    }

    // 3. Silent audio loop — secondary signal to Android that tab is "active".
    //    Uses a real audio file (not a synthesized oscillator Chrome can detect).
    //    Started on first user interaction to satisfy autoplay policy.
    const startAudio = () => {
      if (audioEl.current) return
      const el = new Audio('/silent.wav')
      el.loop = true
      el.volume = 0.01
      el.play().catch(() => {})
      audioEl.current = el
      document.removeEventListener('touchstart', startAudio)
      document.removeEventListener('click', startAudio)
    }
    document.addEventListener('touchstart', startAudio, { once: true })
    document.addEventListener('click', startAudio, { once: true })
    // Also try immediately — succeeds if there was already a gesture
    startAudio()

    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        sendLocation(pos.coords.latitude, pos.coords.longitude)
        setAccuracy(Math.round(pos.coords.accuracy))
        setGpsStatus('active')
      },
      () => setGpsStatus('error'),
      opts
    )

    // 4. Fallback poll every 15 s — fires if watchPosition stalls
    if (fallbackInterval.current) clearInterval(fallbackInterval.current)
    fallbackInterval.current = setInterval(() => {
      if (Date.now() - lastSentAt.current < 14000) return
      navigator.geolocation.getCurrentPosition(
        pos => {
          sendLocation(pos.coords.latitude, pos.coords.longitude)
          setAccuracy(Math.round(pos.coords.accuracy))
          setGpsStatus('active')
        },
        () => {},
        opts
      )
    }, 15000)
  }, [driverId, sendLocation])

  const stopGps = useCallback(async () => {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null }
    if (fallbackInterval.current) { clearInterval(fallbackInterval.current); fallbackInterval.current = null }
    lockRelease.current?.(); lockRelease.current = null
    try { audioEl.current?.pause(); audioEl.current = null } catch { /* ignore */ }
    try { await wakeLock.current?.release() } catch { /* ignore */ }
    await supabase.from('driver_locations').upsert({
      driver_id: driverId, store_id: storeId,
      lat: 0, lng: 0, is_sharing: false,
      updated_at: new Date().toISOString(),
    })
    setGpsStatus('stopped')
  }, [driverId, storeId])

  // ── Install detection ────────────────────────────────────────────
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) { setInstallState('installed'); return }

    const dismissed = localStorage.getItem('dsp-install-dismissed')
    if (dismissed) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIos) { setInstallState('ios'); return }

    const handler = (e: Event) => {
      e.preventDefault()
      installPrompt.current = e as BeforeInstallPromptEvent
      setInstallState('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function triggerInstall() {
    if (installPrompt.current) {
      await installPrompt.current.prompt()
      const { outcome } = await installPrompt.current.userChoice
      if (outcome === 'accepted') setInstallState('installed')
      installPrompt.current = null
    }
  }

  function dismissInstall() {
    localStorage.setItem('dsp-install-dismissed', '1')
    setInstallState('hidden')
    setShowIosHint(false)
  }

  // Auto-start GPS on mount
  useEffect(() => { startGps() }, [startGps])

  // Register service worker + push notifications
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        // Don't re-subscribe if already active
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        })

        // Save subscription endpoint to Supabase (upsert by endpoint)
        await supabase.from('driver_push_subscriptions').upsert({
          driver_id: driverId,
          endpoint: sub.endpoint,
          subscription: JSON.parse(JSON.stringify(sub)),
        }, { onConflict: 'driver_id,endpoint' })
      } catch {
        // Push blocked by user or not supported — silent fail
      }
    }

    // Ask for permission on first interaction to satisfy browser policy
    if (Notification.permission === 'granted') {
      registerPush()
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => { if (p === 'granted') registerPush() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId])

  // Re-acquire wake lock on tab focus
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === 'visible' && gpsStatus === 'active') {
        try {
          if ('wakeLock' in navigator && (!wakeLock.current || wakeLock.current.released))
            wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [gpsStatus])

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    if (fallbackInterval.current) clearInterval(fallbackInterval.current)
    lockRelease.current?.()
    try { audioEl.current?.pause() } catch { /* ignore */ }
    wakeLock.current?.release().catch(() => {})
  }, [])

  // ── Load available orders ─────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    const [{ data: ready }, { data: claimed }] = await Promise.all([
      supabase.from('orders').select('id,customer_name,customer_phone,customer_notes,payment_method,total,created_at')
        .eq('store_id', storeId).eq('status', 'ready').order('created_at', { ascending: true }),
      supabase.from('deliveries').select('order_id')
        .eq('store_id', storeId).not('order_id', 'is', null).not('status', 'eq', 'cancelled'),
    ])
    const claimedIds = new Set((claimed ?? []).map(d => d.order_id))
    setOrders((ready ?? []).filter(o => !claimedIds.has(o.id)) as AvailableOrder[])
  }, [storeId])

  const loadDelivery = useCallback(async () => {
    const { data } = await supabase.from('deliveries')
      .select('id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id,customer_lat,customer_lng')
      .eq('driver_id', driverId).in('status', ['ready', 'picked_up'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setDelivery(data as ActiveDelivery | null)
  }, [driverId])

  // ── Realtime subscriptions ────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`dispatcher-${driverId}`)
      // Any order change in this store → refresh available list
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => loadOrders())
      // Any delivery change in this store → refresh both (someone else may have claimed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `store_id=eq.${storeId}` },
        () => { loadOrders(); loadDelivery() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, driverId, loadOrders, loadDelivery])

  // ── Claim an order ────────────────────────────────────────────────
  async function claimOrder(order: AvailableOrder) {
    if (delivery) return // already has one
    setClaiming(order.id)
    setErrorMsg('')

    // Optimistic removal
    setOrders(prev => prev.filter(o => o.id !== order.id))

    const { data, error } = await supabase.from('deliveries').insert({
      store_id: storeId,
      order_id: order.id,
      driver_id: driverId,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.customer_notes ?? '',
      status: 'ready',
      driver_fee: 0,
      fee_paid: false,
    }).select('id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id').single()

    if (error) {
      // Revert: put the order back
      setOrders(prev => [order, ...prev])
      setErrorMsg('Este pedido ya fue tomado. Actualiza la lista.')
    } else {
      setDelivery(data as ActiveDelivery)
    }
    setClaiming(null)
  }

  // ── Mark delivered ────────────────────────────────────────────────
  async function completeDelivery() {
    if (!delivery) return
    setCompleting(true)
    await supabase.from('deliveries')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', delivery.id)
    setDelivery(null)
    setCompleting(false)
    await loadOrders()
  }

  // ── Mark picked up ────────────────────────────────────────────────
  async function markPickedUp() {
    if (!delivery || delivery.status !== 'ready') return
    await supabase.from('deliveries')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', delivery.id)
    setDelivery(d => d ? { ...d, status: 'picked_up', picked_up_at: new Date().toISOString() } : d)
  }

  // ── Navigation ────────────────────────────────────────────────────
  async function startNavigation() {
    if (!driverPos || !delivery?.customer_lat || !delivery?.customer_lng) return
    setNavLoading(true)
    try {
      const [dLat, dLng] = driverPos
      const cLat = delivery.customer_lat
      const cLng = delivery.customer_lng
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${cLng},${cLat}?steps=true&overview=full&geometries=geojson`
      )
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('no route')

      const route = data.routes[0]
      const coords: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      )
      setRouteCoords(coords)
      setTotalDist(route.distance)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps: NavStep[] = route.legs[0].steps.map((s: any) => ({
        instruction: buildInstruction(s.maneuver.type, s.maneuver.modifier ?? '', s.name ?? ''),
        distanceM:   s.distance,
        maneuverPos: [s.maneuver.location[1], s.maneuver.location[0]] as [number, number],
        modifier:    s.maneuver.modifier ?? s.maneuver.type ?? 'straight',
      }))
      setNavSteps(steps)
      setNavStepIdx(0)
      setNavMode(true)
    } catch {
      // silently fall back to current view — no route drawn
    }
    setNavLoading(false)
  }

  function stopNavigation() {
    setNavMode(false)
    setRouteCoords([])
    setNavSteps([])
    setNavStepIdx(0)
    setTotalDist(0)
  }

  // Advance step when driver is within 40 m of the current maneuver point
  useEffect(() => {
    if (!navMode || !driverPos || navSteps.length === 0) return
    const step = navSteps[navStepIdx]
    if (!step || navStepIdx >= navSteps.length - 1) return
    if (haversineDistance(driverPos, step.maneuverPos) < 40) {
      setNavStepIdx(i => i + 1)
    }
  }, [driverPos, navMode, navSteps, navStepIdx])

  const isActive = gpsStatus === 'active'
  const currentStep = navSteps[navStepIdx] ?? null

  return (
    <div className="dsp-root">

      {/* Header */}
      <div className="dsp-header">
        {storeLogo
          ? <img src={storeLogo} alt={storeName} className="dsp-logo" />
          : <div className="dsp-logo-av">{storeName[0]?.toUpperCase()}</div>
        }
        {driverAvatar && (
          <img src={driverAvatar} alt={driverName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #E2E8F0' }} />
        )}
        <div className="dsp-header-info">
          <div className="dsp-store">{storeName}</div>
          <div className="dsp-name">{driverName}</div>
        </div>
        {/* GPS pill */}
        <div className={`dsp-gps-pill${isActive ? ' on' : gpsStatus === 'error' ? ' err' : ''}`}>
          <span className="dsp-gps-dot" />
          {gpsStatus === 'requesting' && 'GPS...'}
          {gpsStatus === 'active'     && (accuracy ? `±${accuracy}m` : 'GPS activo')}
          {gpsStatus === 'error'      && 'Sin GPS'}
          {gpsStatus === 'stopped'    && 'GPS off'}
        </div>
      </div>

      {/* ── INSTALL BANNER ── */}
      {installState === 'android' && (
        <div className="dsp-install-bar">
          <div className="dsp-install-text">
            <strong>Instalar como app</strong>
            <span>Acceso rapido desde tu pantalla de inicio</span>
          </div>
          <div className="dsp-install-actions">
            <button className="dsp-install-btn" onClick={triggerInstall}>Instalar</button>
            <button className="dsp-install-dismiss" onClick={dismissInstall}>✕</button>
          </div>
        </div>
      )}

      {installState === 'ios' && !showIosHint && (
        <div className="dsp-install-bar">
          <div className="dsp-install-text">
            <strong>Instalar como app</strong>
            <span>Guarda el acceso en tu pantalla de inicio</span>
          </div>
          <div className="dsp-install-actions">
            <button className="dsp-install-btn" onClick={() => setShowIosHint(true)}>Como?</button>
            <button className="dsp-install-dismiss" onClick={dismissInstall}>✕</button>
          </div>
        </div>
      )}

      {installState === 'ios' && showIosHint && (
        <div className="dsp-install-hint">
          <div className="dsp-install-hint-step">
            <span className="dsp-install-hint-num">1</span>
            Toca el boton <strong>Compartir</strong>
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
              <path d="M13 4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-11ZM6 8.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5ZM9.5 4a.5.5 0 0 0-1 0v6.793L7.354 9.646a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L9.5 10.793V4Z"/>
            </svg>
            en Safari
          </div>
          <div className="dsp-install-hint-step">
            <span className="dsp-install-hint-num">2</span>
            Selecciona <strong>"Agregar a pantalla de inicio"</strong>
          </div>
          <button className="dsp-install-dismiss-full" onClick={dismissInstall}>Entendido</button>
        </div>
      )}

      {/* GPS stop/start bar */}
      {gpsStatus === 'stopped' && (
        <button className="dsp-gps-restart" onClick={startGps}>
          Reactivar GPS
        </button>
      )}
      {gpsStatus === 'error' && (
        <div className="dsp-gps-error">
          Activa el GPS en tu navegador y recarga la pagina.
          <button onClick={startGps}>Reintentar</button>
        </div>
      )}

      <div className={`dsp-body${delivery?.status === 'picked_up' ? ' dsp-body--active' : ''}`}>

        {/* ── ACTIVE DELIVERY: ready — card with info, no map yet ── */}
        {delivery && delivery.status === 'ready' && (
          <div className="dsp-section" style={{ paddingTop: 18 }}>
            <div className="dsp-section-title">
              <span className="dsp-pulse-dot" />
              Pedido asignado
            </div>
            <div className="dsp-delivery-card">
              <div className="dsp-delivery-customer">{delivery.customer_name}</div>
              {delivery.delivery_address && (
                <div className="dsp-delivery-address">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.938 4.5 8.5 4.5 8.5S12.5 9.938 12.5 6c0-2.485-2.015-4.5-4.5-4.5z"/>
                    <circle cx="8" cy="6" r="1.5"/>
                  </svg>
                  {delivery.delivery_address}
                </div>
              )}
              {delivery.notes && (
                <div className="dsp-delivery-notes">{delivery.notes}</div>
              )}
              {delivery.customer_phone && (
                <a href={`tel:${delivery.customer_phone}`} className="dsp-delivery-phone">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.042 11.042 0 005.516 5.516l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-1C7.82 18 2 8.18 2 3z"/>
                  </svg>
                  {delivery.customer_phone}
                </a>
              )}
              <div className="dsp-delivery-actions">
                <button className="dsp-btn-pickup" style={{ flex: 1 }} onClick={markPickedUp}>
                  Ya recogi el pedido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVE DELIVERY: picked_up — fullscreen satellite map ── */}
        {delivery && delivery.status === 'picked_up' && (
          <div className="dsp-active-wrap">
            <div className="dsp-active-map">
              {delivery.customer_lat && delivery.customer_lng ? (
                <DriverMap
                  customerLat={delivery.customer_lat}
                  customerLng={delivery.customer_lng}
                  customerName={delivery.customer_name}
                  driverLat={driverPos?.[0] ?? null}
                  driverLng={driverPos?.[1] ?? null}
                  routeCoords={routeCoords}
                  followDriver={navMode}
                  mapboxToken={mapboxToken}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#94A3B8' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                  </svg>
                  <span style={{ fontSize: 12 }}>El cliente no compartio su ubicacion</span>
                </div>
              )}

              {/* Top overlay — nav instruction or customer info */}
              <div className="dsp-active-info">
                {navMode && currentStep ? (
                  <div className="dsp-nav-instruction">
                    <div className="dsp-nav-arrow">
                      <NavArrow modifier={currentStep.modifier} />
                    </div>
                    <div className="dsp-nav-text">
                      <div className="dsp-nav-dist">{fmtDist(currentStep.distanceM)}</div>
                      <div className="dsp-nav-instr">{currentStep.instruction}</div>
                      {totalDist > 0 && (
                        <div className="dsp-nav-total">Total: {fmtDist(totalDist)}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span className="dsp-pulse-dot" />
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>Pedido activo</span>
                    </div>
                    <div className="dsp-delivery-customer" style={{ marginBottom: 4 }}>{delivery.customer_name}</div>
                    {delivery.delivery_address && (
                      <div className="dsp-delivery-address" style={{ marginBottom: 0 }}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12" style={{ flexShrink: 0 }}>
                          <path strokeLinecap="round" d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.938 4.5 8.5 4.5 8.5S12.5 9.938 12.5 6c0-2.485-2.015-4.5-4.5-4.5z"/>
                          <circle cx="8" cy="6" r="1.5"/>
                        </svg>
                        {delivery.delivery_address}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action buttons overlay — bottom of map */}
              <div className="dsp-active-actions">
                {delivery.customer_phone && (
                  <a href={`tel:${delivery.customer_phone}`} className="dsp-btn-call">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.042 11.042 0 005.516 5.516l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-1C7.82 18 2 8.18 2 3z"/>
                    </svg>
                    Llamar
                  </a>
                )}
                {delivery.customer_lat && delivery.customer_lng && (
                  <button
                    className={navMode ? 'dsp-btn-nav-stop' : 'dsp-btn-nav'}
                    onClick={navMode ? stopNavigation : startNavigation}
                    disabled={navLoading}
                  >
                    {navLoading ? 'Calculando...' : navMode ? 'Parar ruta' : 'Como llegar'}
                  </button>
                )}
                <button className="dsp-btn-done" style={{ flex: 1 }} onClick={completeDelivery} disabled={completing}>
                  {completing ? 'Guardando...' : 'Entregado'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AVAILABLE ORDERS ── hidden while a delivery is active */}
        {!delivery && <div className="dsp-section">
          <div className="dsp-section-title">
            Pedidos disponibles
            {orders.length > 0 && <span className="dsp-count">{orders.length}</span>}
          </div>

          {errorMsg && (
            <div className="dsp-error-bar">
              {errorMsg}
              <button onClick={() => { setErrorMsg(''); loadOrders() }}>Actualizar</button>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="dsp-empty">
              <div className="dsp-empty-icon">
                <svg viewBox="0 0 40 40" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="40" height="40">
                  <circle cx="20" cy="20" r="16" strokeDasharray="4 3"/>
                  <path strokeLinecap="round" d="M14 20h12M20 14v12"/>
                </svg>
              </div>
              <div className="dsp-empty-text">Sin pedidos disponibles</div>
              <div className="dsp-empty-sub">Apareceran aqui cuando cocina los marque como listos</div>
            </div>
          ) : (
            <div className="dsp-order-list">
              {orders.map(order => (
                <div key={order.id} className="dsp-order-card">
                  <div className="dsp-order-top">
                    <div className="dsp-order-name">{order.customer_name}</div>
                    <div className="dsp-order-time">{timeAgo(order.created_at)}</div>
                  </div>
                  {order.customer_notes && (
                    <div className="dsp-order-notes">{order.customer_notes}</div>
                  )}
                  <div className="dsp-order-meta">
                    {order.total > 0 && <span>${Number(order.total).toFixed(2)}</span>}
                    {order.payment_method && <span>{order.payment_method}</span>}
                    {order.customer_phone && <span>{order.customer_phone}</span>}
                  </div>
                  <button
                    className="dsp-btn-claim"
                    onClick={() => claimOrder(order)}
                    disabled={claiming === order.id || !!delivery}
                  >
                    {claiming === order.id ? 'Tomando...' : delivery ? 'Ya tienes un pedido' : 'Tomar pedido'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* GPS toggle at bottom — hidden when delivery active (status shown in header pill) */}
        {isActive && !delivery && (
          <>
            <div className="dsp-gps-bar">
              <div className="dsp-gps-info">
                <span className="dsp-gps-dot on" />
                <span>
                  GPS activo
                  {lastUpdate && <span className="dsp-gps-time"> · {lastUpdate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                </span>
              </div>
              <button className="dsp-gps-stop" onClick={stopGps}>Detener</button>
            </div>
            <div style={{ background: '#FFFBEB', borderTop: '1px solid #FDE68A', padding: '8px 18px', fontSize: 11, color: '#92400E', textAlign: 'center' }}>
              Android: puedes bloquear la pantalla · iOS: mantén Safari abierto
            </div>
          </>
        )}

      </div>
    </div>
  )
}
