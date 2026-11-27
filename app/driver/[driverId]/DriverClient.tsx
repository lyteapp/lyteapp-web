'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import type { ActiveDelivery } from './page'
import { fetchBestRoute, isOffRoute, routeProgress, type NavRoute, type NavProgress } from '../../lib/driverRoute'
import { whatsappLink } from '../../lib/phone'

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
  initialDelivery: ActiveDelivery | null
  mapboxToken: string
}

type AvailableOrder = {
  id: string
  customer_name: string
  customer_phone: string | null
  customer_notes: string | null
  payment_method: string | null
  total: number
  created_at: string
}

type GpsStatus  = 'requesting' | 'active' | 'error' | 'stopped'
type InstallState = 'hidden' | 'ios' | 'android' | 'installed'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`
}

function fmtEta(s: number): string {
  const min = Math.max(1, Math.round(s / 60))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
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

// What the driver did today, from /api/driver-stats
type DaySheet = {
  currency: string
  deliveries: number
  earned: number
  list: { id: string; customer_name: string; delivered_at: string; fee: number; zone: string | null }[]
}
const money = (n: number, currency: string) =>
  `${currency === 'EUR' ? '€' : '$'}${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DriverClient({
  driverId, driverName, driverAvatar, storeId, storeName,
  initialDelivery, mapboxToken,
}: Props) {
  const [delivery, setDelivery]         = useState<ActiveDelivery | null>(initialDelivery)
  const [completing, setCompleting]     = useState(false)
  const [gpsStatus, setGpsStatus]       = useState<GpsStatus>('requesting')
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null)
  const [driverPos, setDriverPos]       = useState<[number, number] | null>(null)
  const [heading, setHeading]           = useState<number | null>(null)
  const [compassActive, setCompassActive] = useState(false)
  const [installState, setInstallState] = useState<InstallState>('hidden')
  const [showIosHint, setShowIosHint]   = useState(false)
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // ── Navigation ────────────────────────────────────────────────────
  const [navMode, setNavMode]         = useState(false)
  const [navRoute, setNavRoute]       = useState<NavRoute | null>(null)
  const [navProgress, setNavProgress] = useState<NavProgress | null>(null)
  const [navLoading, setNavLoading]   = useState(false)
  const [navNote, setNavNote]         = useState('')
  const [showContact, setShowContact] = useState(false)
  const [newDeliveryFlash, setNewDeliveryFlash] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const [orders, setOrders] = useState<AvailableOrder[]>([])
  const [day, setDay] = useState<DaySheet | null>(null)
  const [showDay, setShowDay] = useState(false)
  const watchId              = useRef<number | null>(null)
  const fallbackInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSentAt       = useRef<number>(0)
  const wakeLock         = useRef<WakeLockSentinel | null>(null)
  const lockRelease      = useRef<(() => void) | null>(null)
  const audioEl          = useRef<HTMLAudioElement | null>(null)
  const compassOff       = useRef<(() => void) | null>(null)
  const prevDelivery        = useRef<ActiveDelivery | null>(initialDelivery)
  const autoPickedUpRef     = useRef<string | null>(null)
  const autoNavRef          = useRef<string | null>(null)
  // following the driver along the route (read from GPS callbacks, so refs)
  const navRouteRef         = useRef<NavRoute | null>(null)
  const segHint             = useRef(0)
  const offCount            = useRef(0)
  const lastReroute         = useRef(0)
  const gpsCourse            = useRef<{ heading: number; at: number } | null>(null)
  const rerouteRef           = useRef<() => void>(() => {})
  const storeOrdersChannel  = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Compass ───────────────────────────────────────────────────────
  function initCompass() {
    if (compassOff.current) return

    type DOEC = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }

    const handler = (e: DeviceOrientationEvent) => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      if (webkit != null && !Number.isNaN(webkit)) {
        setHeading(webkit)
        setCompassActive(true)
      } else if (e.alpha != null && !Number.isNaN(e.alpha)) {
        setHeading((360 - e.alpha + 360) % 360)
        setCompassActive(true)
      }
    }

    const attach = () => {
      window.addEventListener('deviceorientationabsolute', handler as EventListener, true)
      window.addEventListener('deviceorientation', handler as EventListener, true)
      compassOff.current = () => {
        window.removeEventListener('deviceorientationabsolute', handler as EventListener, true)
        window.removeEventListener('deviceorientation', handler as EventListener, true)
        compassOff.current = null
      }
    }

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as DOEC).requestPermission === 'function') {
      ;(DeviceOrientationEvent as DOEC).requestPermission!()
        .then(p => { if (p === 'granted') attach() })
        .catch(() => {})
    } else {
      attach()
    }
  }

  // ── GPS ──────────────────────────────────────────────────────────
  // Positions go out at most every 2 s, but the latest one is never dropped:
  // a fix that arrives inside the window is sent when the window ends (the
  // old throttle discarded it, so the maps could sit on a stale point for up
  // to 15 s — e.g. the spot where the driver stopped never got sent).
  // Coarse fixes (cell/wifi, often hundreds of meters off) are ignored while
  // real GPS fixes keep coming, so the marker doesn't jump around.
  const pendingFix  = useRef<{ lat: number; lng: number; acc: number | null } | null>(null)
  const sendTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGoodFix = useRef(0)
  const flushLocation = useCallback(async () => {
    if (sendTimer.current) { clearTimeout(sendTimer.current); sendTimer.current = null }
    const fix = pendingFix.current
    if (!fix) return
    pendingFix.current = null
    lastSentAt.current = Date.now()
    await supabase.from('driver_locations').upsert({
      driver_id: driverId, store_id: storeId,
      lat: fix.lat, lng: fix.lng, accuracy: fix.acc, is_sharing: true,
      updated_at: new Date().toISOString(),
    })
    setLastUpdate(new Date())
  }, [driverId, storeId])
  const sendLocation = useCallback((lat: number, lng: number, acc: number | null = null) => {
    const precise = acc == null || acc <= 60
    if (!precise && Date.now() - lastGoodFix.current < 30_000) return
    if (precise) lastGoodFix.current = Date.now()
    setDriverPos([lat, lng])
    const route = navRouteRef.current
    if (route) {
      const pr = routeProgress(route, [lat, lng], segHint.current)
      segHint.current = pr.segIdx
      setNavProgress(pr)
      // several fixes in a row off the road (not one bad reading): draw a new route
      offCount.current = isOffRoute(pr.offRouteM, acc) && !pr.arrived ? offCount.current + 1 : 0
      if (offCount.current >= 3 && Date.now() - lastReroute.current > 15_000) {
        offCount.current = 0
        lastReroute.current = Date.now()
        rerouteRef.current()
      }
    }
    pendingFix.current = { lat, lng, acc }
    const wait = 2000 - (Date.now() - lastSentAt.current)
    if (wait <= 0) flushLocation()
    else if (!sendTimer.current) sendTimer.current = setTimeout(flushLocation, wait)
  }, [flushLocation])

  const startGps = useCallback(async () => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }

    try {
      if ('wakeLock' in navigator)
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
    } catch { /* not critical */ }

    if ('locks' in navigator) {
      (navigator as Navigator & { locks: { request(name: string, opts: unknown, cb: () => Promise<void>): void } })
        .locks.request(`gps-${driverId}`, { mode: 'exclusive' }, () =>
          new Promise<void>(resolve => { lockRelease.current = resolve })
        )
    }

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
    startAudio()

    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 500 }
    initCompass()

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        setGpsStatus('active')
        // the way the vehicle is really going: only while it moves (a still phone's heading is noise)
        if (pos.coords.speed != null && pos.coords.speed > 2 && pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) {
          gpsCourse.current = { heading: pos.coords.heading, at: Date.now() }
        }
        if (!compassActive && pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading)
        }
      },
      () => setGpsStatus('error'),
      opts
    )

    if (fallbackInterval.current) clearInterval(fallbackInterval.current)
    fallbackInterval.current = setInterval(() => {
      if (Date.now() - lastSentAt.current < 14000) return
      navigator.geolocation.getCurrentPosition(
        pos => {
          sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
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
    if (sendTimer.current) { clearTimeout(sendTimer.current); sendTimer.current = null }
    pendingFix.current = null
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
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        })
        await supabase.from('driver_push_subscriptions').upsert({
          driver_id: driverId,
          endpoint: sub.endpoint,
          subscription: JSON.parse(JSON.stringify(sub)),
        }, { onConflict: 'driver_id,endpoint' })
      } catch { /* push not supported or blocked */ }
    }

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
        // Back from another app (iOS pauses the page meanwhile): send a
        // fresh fix right away instead of waiting for the next movement.
        navigator.geolocation.getCurrentPosition(
          pos => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
        try {
          if ('wakeLock' in navigator && (!wakeLock.current || wakeLock.current.released))
            wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [gpsStatus, sendLocation])

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    if (fallbackInterval.current) clearInterval(fallbackInterval.current)
    lockRelease.current?.()
    compassOff.current?.()
    try { audioEl.current?.pause() } catch { /* ignore */ }
    wakeLock.current?.release().catch(() => {})
  }, [])

  // ── Today's tally (the driver's own delivery earnings) ───────────
  const loadDay = useCallback(async () => {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    const res = await fetch(`/api/driver-stats?driverId=${driverId}&todayStart=${encodeURIComponent(midnight.toISOString())}`, { cache: 'no-store' }).catch(() => null)
    const json = res?.ok ? await res.json().catch(() => null) : null
    if (json?.today) setDay(json.today as DaySheet)
  }, [driverId])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    loadDay()
    const onVisible = () => { if (document.visibilityState === 'visible') loadDay() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadDay])
  // Refresh when a delivery finishes (from this phone or the dashboard)
  const hadDelivery = useRef(!!initialDelivery)
  useEffect(() => {
    if (hadDelivery.current && !delivery) loadDay()
    hadDelivery.current = !!delivery
  }, [delivery, loadDay])

  // ── Load available orders ─────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    const [{ data: ready }, { data: claimed }] = await Promise.all([
      supabase.from('orders')
        .select('id,customer_name,customer_phone,customer_notes,payment_method,total,created_at')
        .eq('store_id', storeId).eq('status', 'ready').eq('delivery_type', 'delivery')
        .order('created_at', { ascending: true }),
      supabase.from('deliveries')
        .select('order_id')
        .eq('store_id', storeId)
        .not('order_id', 'is', null)
        .not('status', 'eq', 'cancelled')
        .not('driver_id', 'is', null),
    ])
    const claimedIds = new Set((claimed ?? []).map((d: { order_id: string }) => d.order_id))
    setOrders((ready ?? []).filter((o: { id: string }) => !claimedIds.has(o.id)) as AvailableOrder[])
  }, [storeId])

  // ── Load active delivery ──────────────────────────────────────────
  const loadDelivery = useCallback(async () => {
    const { data, error } = await supabase.from('deliveries')
      .select('id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id,customer_lat,customer_lng,zone_id,orders(total,payment_method,payment_proof_url)')
      .eq('driver_id', driverId).in('status', ['ready', 'picked_up'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) return // network/RLS error — keep existing state
    if (!data) { setDelivery(null); return }

    // Prefer coordinate-based zone detection (server key bypasses RLS)
    let zone_name: string | null = null
    let zone_fee: number | null = null
    let zone_color: string | null = null
    if (data.customer_lat != null && data.customer_lng != null) {
      const res = await fetch(
        `/api/zone-for-delivery?storeId=${storeId}&lat=${data.customer_lat}&lng=${data.customer_lng}`
      ).catch(() => null)
      if (res?.ok) {
        const json = await res.json().catch(() => null)
        if (json?.zone) { zone_name = json.zone.name; zone_fee = json.zone.fee; zone_color = json.zone.color }
      }
    }
    // Fallback to zone_id lookup if coords gave no result
    if (zone_fee == null && data.zone_id) {
      const { data: zd } = await supabase.from('delivery_zones')
        .select('name,fee,color').eq('id', data.zone_id).maybeSingle()
      if (zd) { zone_name = zd.name; zone_fee = zd.fee; zone_color = zd.color }
    }

    setDelivery({
      ...data,
      order_total: (data.orders as unknown as { total: number; payment_method: string; payment_proof_url: string | null } | null)?.total ?? null,
      order_payment_method: (data.orders as unknown as { total: number; payment_method: string; payment_proof_url: string | null } | null)?.payment_method ?? null,
      order_proof_url: (data.orders as unknown as { total: number; payment_method: string; payment_proof_url: string | null } | null)?.payment_proof_url ?? null,
      zone_name,
      zone_fee,
      zone_color,
    } as ActiveDelivery)
  }, [driverId])

  // ── New-delivery alert (beep + flash when a delivery is assigned) ──
  useEffect(() => {
    const prev = prevDelivery.current
    if (!prev && delivery?.status === 'ready') {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(990, ctx.currentTime + 0.15)
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.3)
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6)
      } catch { /* AudioContext blocked */ }
      if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 200])
      setNewDeliveryFlash(true)
      const t = setTimeout(() => setNewDeliveryFlash(false), 3000)
      prevDelivery.current = delivery
      return () => clearTimeout(t)
    }
    prevDelivery.current = delivery
  }, [delivery])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-transition ready → picked_up so GPS map opens immediately ──
  useEffect(() => {
    if (!delivery || delivery.status !== 'ready' || delivery.id === autoPickedUpRef.current) return
    autoPickedUpRef.current = delivery.id
    initCompass()
    supabase.from('deliveries')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', delivery.id)
      .then(() => setDelivery(d => d ? { ...d, status: 'picked_up', picked_up_at: new Date().toISOString() } : d))
  }, [delivery])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-start navigation when delivery has coords + driver has GPS fix ──
  useEffect(() => {
    if (navMode || !delivery?.customer_lat || !delivery?.customer_lng || !driverPos) return
    if (autoNavRef.current === delivery.id) return
    autoNavRef.current = delivery.id
    startNavigation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.id, delivery?.customer_lat, delivery?.customer_lng, driverPos, navMode])

  // ── Claim an order ────────────────────────────────────────────────
  const claimOrder = useCallback(async (order: AvailableOrder) => {
    if (delivery) return
    const sel = 'id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id,customer_lat,customer_lng'
    const { data } = await supabase.from('deliveries')
      .update({ driver_id: driverId, status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('order_id', order.id)
      .is('driver_id', null)
      .not('status', 'eq', 'cancelled')
      .select(sel)
    if (!data?.length) return // race lost
    setOrders(prev => prev.filter(o => o.id !== order.id))
    setDelivery(data[0] as ActiveDelivery)
    storeOrdersChannel.current?.send({
      type: 'broadcast', event: 'order_claimed',
      payload: { orderId: order.id },
    })
  }, [delivery, driverId])

  // ── Broadcast: instant order removal on all dispatcher screens ────
  useEffect(() => {
    const ch = supabase.channel(`store-orders-${storeId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'order_claimed' }, ({ payload }) => {
        setOrders(prev => prev.filter(o => o.id !== (payload as { orderId: string }).orderId))
      })
      .subscribe()
    storeOrdersChannel.current = ch
    return () => { supabase.removeChannel(ch); storeOrdersChannel.current = null }
  }, [storeId])

  // ── Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    loadOrders()
    loadDelivery()
    const ch = supabase.channel(`dispatcher-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => loadOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `store_id=eq.${storeId}` },
        () => { loadOrders(); loadDelivery() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, driverId, loadOrders, loadDelivery])

  // ── Mark delivered ────────────────────────────────────────────────
  async function completeDelivery() {
    if (!delivery) return
    setCompleting(true)
    const now = new Date().toISOString()
    try {
      const res = await fetch('/api/driver-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId: delivery.id,
          orderId: delivery.order_id ?? null,
          driverId,
        }),
      })
      if (!res.ok) {
        // API failed — update delivery directly with anon key as fallback
        await supabase
          .from('deliveries')
          .update({ status: 'delivered', delivered_at: now })
          .eq('id', delivery.id)
          .eq('driver_id', driverId)
      }
    } catch {
      // Network error — update delivery directly
      await supabase
        .from('deliveries')
        .update({ status: 'delivered', delivered_at: now })
        .eq('id', delivery.id)
        .eq('driver_id', driverId)
    }
    stopNavigation()
    setDelivery(null)
    setCompleting(false)
  }

  // ── Navigation ────────────────────────────────────────────────────
  // `reroute` = the driver left the road: the new line replaces the old one
  // without leaving navigation or blanking the screen
  async function startNavigation(reroute = false) {
    if (!driverPos || !delivery?.customer_lat || !delivery?.customer_lng) return
    if (!reroute) setNavLoading(true)
    setNavNote(reroute ? 'Recalculando ruta…' : '')
    // the heading only counts when it is recent (the vehicle was moving a moment ago)
    const course = gpsCourse.current && Date.now() - gpsCourse.current.at < 8000 ? gpsCourse.current.heading : null
    const route = await fetchBestRoute({
      from: driverPos,
      to: [delivery.customer_lat, delivery.customer_lng],
      bearing: course,
      mapboxToken,
    })
    if (route) {
      navRouteRef.current = route
      segHint.current = 0
      offCount.current = 0
      setNavRoute(route)
      setNavProgress(routeProgress(route, driverPos, 0))
      setNavMode(true)
      setNavNote('')
    } else if (reroute) {
      setNavNote('No se pudo recalcular. Sigue la línea del mapa.')
    } else {
      setNavNote('No se pudo calcular la ruta. Revisa tu conexión e intenta de nuevo.')
    }
    setNavLoading(false)
  }
  rerouteRef.current = () => { startNavigation(true) }

  function stopNavigation() {
    navRouteRef.current = null
    segHint.current = 0
    offCount.current = 0
    setNavMode(false)
    setNavRoute(null)
    setNavProgress(null)
    setNavNote('')
  }

  const isActive = gpsStatus === 'active'
  const currentStep = navProgress?.next ?? null

  return (
    <div className="dsp-root">

      {/* Header */}
      <div className="dsp-header">
        <div className="dsp-header-top">
          {driverAvatar
            ? <img src={driverAvatar} alt={driverName} className="dsp-courier-av" style={{ objectFit: 'cover' }} />
            : <div className="dsp-courier-av">{driverName[0]?.toUpperCase()}</div>
          }
          <div className="dsp-courier-info">
            <div className="dsp-courier-name">{driverName}</div>
            <div className="dsp-store">{storeName}</div>
          </div>
          {gpsStatus === 'active' && delivery
            ? <span className="dsp-badge-route">en ruta</span>
            : gpsStatus === 'active'
              ? <span className="dsp-badge-gps"><span className="dsp-badge-dot" />GPS activo</span>
              : gpsStatus === 'error'
                ? <span className="dsp-badge-offline">Sin GPS</span>
                : <span className="dsp-badge-offline">offline</span>
          }
        </div>
        <button className="dsp-day-bar" onClick={() => { setShowDay(true); loadDay() }}>
          <span className="dsp-day-bar-lbl">Ganancias hoy</span>
          <span className="dsp-day-bar-val">{day ? money(day.earned, day.currency) : '—'}</span>
          <span className="dsp-day-bar-sub">
            {day ? `${day.deliveries} ${day.deliveries === 1 ? 'entrega' : 'entregas'}` : ''}
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
          </span>
        </button>
      </div>

      {/* Contact the customer: call, or WhatsApp (with quick messages) */}
      {showContact && delivery?.customer_phone && (() => {
        const phone = delivery.customer_phone
        const hi = `Hola ${delivery.customer_name}, soy ${driverName} de ${storeName}.`
        const quick = [
          { label: 'Ya voy en camino', text: `${hi} Ya voy en camino con tu pedido.` },
          { label: 'Ya llegué', text: `${hi} Ya llegué con tu pedido, ¿puedes salir a recibirlo?` },
          { label: 'No encuentro la dirección', text: `${hi} No encuentro la dirección, ¿me ayudas con una referencia?` },
        ]
        const chat = whatsappLink(phone)
        return (
          <div className="dsp-day-overlay" onClick={() => setShowContact(false)}>
            <div className="dsp-day-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Contactar al cliente">
              <div className="dsp-day-grip" />
              <div className="dsp-day-head">
                <div>
                  <div className="dsp-day-title">{delivery.customer_name}</div>
                  <div className="dsp-day-date">{phone}</div>
                </div>
                <button className="dsp-day-close" onClick={() => setShowContact(false)} aria-label="Cerrar">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                </button>
              </div>
              <div className="dsp-day-body">
                <div className="dsp-contact-main">
                  <a className="dsp-contact-btn call" href={`tel:${phone.replace(/[^\d+]/g, '')}`} onClick={() => setShowContact(false)}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.042 11.042 0 005.516 5.516l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-1C7.82 18 2 8.18 2 3z" /></svg>
                    Llamar
                  </a>
                  {chat ? (
                    <a className="dsp-contact-btn wa" href={chat} target="_blank" rel="noopener noreferrer" onClick={() => setShowContact(false)}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      WhatsApp
                    </a>
                  ) : (
                    <div className="dsp-contact-btn off">WhatsApp no disponible</div>
                  )}
                </div>
                {chat ? (
                  <>
                    <div className="dsp-contact-lbl">Mensajes rápidos por WhatsApp</div>
                    <div className="dsp-contact-quick">
                      {quick.map(q => (
                        <a key={q.label} href={whatsappLink(phone, q.text) ?? chat} target="_blank" rel="noopener noreferrer" className="dsp-contact-chip" onClick={() => setShowContact(false)}>{q.label}</a>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="dsp-contact-lbl">Este número no parece válido para WhatsApp. Puedes llamarlo.</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Today's sheet */}
      {showDay && (
        <div className="dsp-day-overlay" onClick={() => setShowDay(false)}>
          <div className="dsp-day-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Tu día">
            <div className="dsp-day-grip" />
            <div className="dsp-day-head">
              <div>
                <div className="dsp-day-title">Tu día</div>
                <div className="dsp-day-date">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              </div>
              <button className="dsp-day-close" onClick={() => setShowDay(false)} aria-label="Cerrar">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5L5 15M5 5l10 10" /></svg>
              </button>
            </div>

            {!day ? (
              <div className="dsp-day-empty">Cargando…</div>
            ) : (
              <div className="dsp-day-body">
                <div className="dsp-day-total">
                  <div className="dsp-day-total-lbl">Ganancias por delivery</div>
                  <div className="dsp-day-total-val">{money(day.earned, day.currency)}</div>
                  <div className="dsp-day-total-sub">{day.deliveries} {day.deliveries === 1 ? 'entrega' : 'entregas'} hoy</div>
                </div>

                <div className="dsp-day-section">
                  <div className="dsp-day-section-title">Entregas</div>
                  {day.list.length === 0 ? (
                    <div className="dsp-day-empty">Todavía no tienes entregas hoy.</div>
                  ) : day.list.map(d => (
                    <div key={d.id} className="dsp-day-row">
                      <span className="dsp-day-row-main">
                        <span className="dsp-day-row-name">{d.customer_name}</span>
                        <span className="dsp-day-row-meta">
                          {new Date(d.delivered_at).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}{d.zone ? ` · ${d.zone}` : ''}
                        </span>
                      </span>
                      <span className="dsp-day-row-val">{money(d.fee, day.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Install banner */}
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

      {gpsStatus === 'stopped' && (
        <button className="dsp-gps-restart" onClick={startGps}>Reactivar GPS</button>
      )}
      {gpsStatus === 'error' && (
        <div className="dsp-gps-error">
          Activa el GPS en tu navegador y recarga la pagina.
          <button onClick={startGps}>Reintentar</button>
        </div>
      )}

      <div className={`dsp-body${delivery ? ' dsp-body--active' : ''}`}>

        {/* Active delivery — fullscreen GPS map */}
        {delivery && (
          <div className={`dsp-active-wrap${newDeliveryFlash ? ' dsp-delivery-card--new' : ''}`}>
            <div className="dsp-active-map">
              {delivery.customer_lat && delivery.customer_lng ? (
                <DriverMap
                  customerLat={delivery.customer_lat}
                  customerLng={delivery.customer_lng}
                  customerName={delivery.customer_name}
                  driverLat={driverPos?.[0] ?? null}
                  driverLng={driverPos?.[1] ?? null}
                  routeCoords={navProgress ? navProgress.ahead : navRoute?.coords}
                  followDriver={navMode}
                  heading={heading}
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

              <div className="dsp-active-info">
                {navMode && currentStep ? (
                  <div className="dsp-nav-instruction">
                    <div className="dsp-nav-arrow"><NavArrow modifier={currentStep.step.modifier} /></div>
                    <div className="dsp-nav-text">
                      <div className="dsp-nav-dist">{fmtDist(currentStep.distM)}</div>
                      <div className="dsp-nav-instr">{currentStep.step.instruction}</div>
                      {navProgress && (
                        <div className="dsp-nav-total">
                          {navProgress.arrived ? 'Llegaste' : `Faltan ${fmtDist(navProgress.remainingM)} · ${fmtEta(navProgress.etaS)}`}
                          {navNote ? ` · ${navNote}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span className="dsp-pulse-dot" />
                      <span className="dsp-active-label">Pedido activo</span>
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

              {/* Zone fee card — floating over map canvas */}
              {delivery.zone_fee != null && (
                <div style={{
                  position: 'absolute', right: 14, bottom: 190, zIndex: 1002,
                  background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 16, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: delivery.zone_color ?? '#7C3AED',
                    boxShadow: `0 0 0 3px ${(delivery.zone_color ?? '#7C3AED')}33`,
                  }} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                      {delivery.zone_name ?? 'Zona'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px', lineHeight: 1 }}>
                      ${Number(delivery.zone_fee).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              <div className="dsp-active-actions">
                {(delivery.order_total != null || delivery.order_payment_method) && (
                  <div style={{
                    background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(8px)',
                    borderRadius: 12, padding: '9px 16px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    {delivery.order_total != null && (
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
                        ${Number(delivery.order_total).toFixed(2)}
                      </span>
                    )}
                    {delivery.order_payment_method && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>
                        {delivery.order_payment_method}
                      </span>
                    )}
                  </div>
                )}
                {(delivery.customer_phone || (delivery.customer_lat && delivery.customer_lng)) && (
                  <div className="dsp-actions-row">
                    {delivery.customer_phone && (
                      <button type="button" className="dsp-btn-call" onClick={() => setShowContact(true)}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.042 11.042 0 005.516 5.516l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-1C7.82 18 2 8.18 2 3z"/>
                        </svg>
                        Contactar
                      </button>
                    )}
                    {delivery.customer_lat && delivery.customer_lng && (
                      <button
                        className={navMode ? 'dsp-btn-nav-stop' : 'dsp-btn-nav'}
                        onClick={navMode ? stopNavigation : () => startNavigation()}
                        disabled={navLoading}
                      >
                        {navLoading ? 'Calculando...' : navMode ? 'Parar ruta' : 'Como llegar'}
                      </button>
                    )}
                  </div>
                )}
                {!navMode && navNote && <div className="dsp-nav-note" role="status">{navNote}</div>}
                {delivery.order_proof_url && (
                  <button className="dsp-btn-proof" onClick={() => setShowProof(true)}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                    </svg>
                    Ver comprobante
                  </button>
                )}
                <button className="dsp-btn-done" onClick={completeDelivery} disabled={completing}>
                  {completing ? 'Guardando...' : 'Entregado'}
                </button>
              </div>

              {/* Proof lightbox */}
              {showProof && delivery.order_proof_url && (
                <div
                  style={{
                    position: 'absolute', inset: 0, zIndex: 2000,
                    background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 20,
                  }}
                  onClick={() => setShowProof(false)}
                >
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
                  }}>
                    Comprobante de pago
                  </div>
                  <img
                    src={delivery.order_proof_url}
                    alt="Comprobante"
                    style={{
                      maxWidth: '100%', maxHeight: '70vh',
                      borderRadius: 14, objectFit: 'contain',
                      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    onClick={() => setShowProof(false)}
                    style={{
                      marginTop: 20, background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 10, padding: '10px 28px',
                      color: 'white', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Available orders — only shown when no active delivery */}
        {!delivery && orders.length > 0 && (
          <div className="dsp-order-list">
            {orders.map(order => (
              <div key={order.id} className="dsp-order-card">
                <div className="dsp-order-name">{order.customer_name}</div>
                {order.customer_notes && (
                  <div className="dsp-order-address">{order.customer_notes}</div>
                )}
                {order.customer_phone && (
                  <div className="dsp-order-phone">{order.customer_phone}</div>
                )}
                {(order.total > 0 || order.payment_method) && (
                  <div className="dsp-order-meta">
                    {order.total > 0 && <span>${Number(order.total).toFixed(2)}</span>}
                    {order.payment_method && <span>{order.payment_method}</span>}
                  </div>
                )}
                <button
                  className="dsp-btn-claim"
                  onClick={() => claimOrder(order)}
                  disabled={!!delivery}
                >
                  Tomar pedido
                </button>
              </div>
            ))}
          </div>
        )}


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
          </>
        )}

      </div>
    </div>
  )
}
