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
}

type GpsStatus  = 'requesting' | 'active' | 'error' | 'stopped'
type InstallState = 'hidden' | 'ios' | 'android' | 'installed'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Ahora mismo'
  if (m < 60) return `Hace ${m} min`
  return `Hace ${Math.floor(m / 60)}h`
}

export default function DriverClient({
  driverId, driverName, driverAvatar, storeId, storeName, storeLogo,
  initialOrders, initialDelivery,
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

  // ── Mark picked up (from counter) ─────────────────────────────────
  async function markPickedUp() {
    if (!delivery || delivery.status !== 'ready') return
    await supabase.from('deliveries')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', delivery.id)
    setDelivery(d => d ? { ...d, status: 'picked_up', picked_up_at: new Date().toISOString() } : d)
  }

  const isActive = gpsStatus === 'active'

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

              {/* Customer info overlay — top of map */}
              <div className="dsp-active-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span className="dsp-pulse-dot" />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>Pedido activo</span>
                </div>
                <div className="dsp-delivery-customer" style={{ marginBottom: 4 }}>{delivery.customer_name}</div>
                {delivery.delivery_address && (
                  <div className="dsp-delivery-address" style={{ marginBottom: 4 }}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12" style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.938 4.5 8.5 4.5 8.5S12.5 9.938 12.5 6c0-2.485-2.015-4.5-4.5-4.5z"/>
                      <circle cx="8" cy="6" r="1.5"/>
                    </svg>
                    {delivery.delivery_address}
                  </div>
                )}
                {delivery.notes && (
                  <div className="dsp-delivery-notes" style={{ margin: 0 }}>{delivery.notes}</div>
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
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.customer_lat},${delivery.customer_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="dsp-btn-nav"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd"/>
                    </svg>
                    Como llegar
                  </a>
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
