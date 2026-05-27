'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { AvailableOrder, ActiveDelivery } from './page'

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
  const [installState, setInstallState] = useState<InstallState>('hidden')
  const [showIosHint, setShowIosHint]   = useState(false)
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  const watchId          = useRef<number | null>(null)
  const fallbackInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSentAt       = useRef<number>(0)
  const wakeLock         = useRef<WakeLockSentinel | null>(null)
  const audioCtx         = useRef<AudioContext | null>(null)
  const audioOsc         = useRef<OscillatorNode | null>(null)

  // ── GPS ──────────────────────────────────────────────────────────
  const sendLocation = useCallback(async (lat: number, lng: number) => {
    lastSentAt.current = Date.now()
    await supabase.from('driver_locations').upsert({
      driver_id: driverId, store_id: storeId,
      lat, lng, is_sharing: true,
      updated_at: new Date().toISOString(),
    })
    setLastUpdate(new Date())
  }, [driverId, storeId])

  const startGps = useCallback(async () => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }

    // Wake lock — prevents screen timeout
    try {
      if ('wakeLock' in navigator)
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
    } catch { /* not critical */ }

    // Silent audio loop — keeps Android Chrome alive when screen is locked.
    // The oscillator runs at near-zero gain (inaudible) but signals to the OS
    // that the tab is "active", preventing JS/GPS suspension.
    try {
      if (!audioCtx.current) {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.value = 0.001          // essentially silent
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        audioCtx.current = ctx
        audioOsc.current = osc
        if (ctx.state === 'suspended') await ctx.resume()
      }
    } catch { /* not critical — GPS still works without it */ }

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

    // Fallback: if watchPosition stalls (background/screen lock), poll every 15 s
    if (fallbackInterval.current) clearInterval(fallbackInterval.current)
    fallbackInterval.current = setInterval(() => {
      if (Date.now() - lastSentAt.current < 14000) return // watchPosition is alive
      navigator.geolocation.getCurrentPosition(
        pos => {
          sendLocation(pos.coords.latitude, pos.coords.longitude)
          setAccuracy(Math.round(pos.coords.accuracy))
          setGpsStatus('active')
        },
        () => {}, // silent — main watch will surface the error
        opts
      )
    }, 15000)
  }, [sendLocation])

  const stopGps = useCallback(async () => {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null }
    if (fallbackInterval.current) { clearInterval(fallbackInterval.current); fallbackInterval.current = null }
    try { await wakeLock.current?.release() } catch { /* ignore */ }
    try { audioOsc.current?.stop(); await audioCtx.current?.close(); audioOsc.current = null; audioCtx.current = null } catch { /* ignore */ }
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
    wakeLock.current?.release().catch(() => {})
    try { audioOsc.current?.stop(); audioCtx.current?.close() } catch { /* ignore */ }
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
      .select('id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id')
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
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
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

      <div className="dsp-body">

        {/* ── ACTIVE DELIVERY ── */}
        {delivery && (
          <div className="dsp-section">
            <div className="dsp-section-title">
              <span className="dsp-pulse-dot" />
              Tu pedido activo
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
              {delivery.customer_phone && (
                <a href={`tel:${delivery.customer_phone}`} className="dsp-delivery-phone">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.042 11.042 0 005.516 5.516l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V13a1 1 0 01-1 1h-1C7.82 14 2 8.18 2 3z"/>
                  </svg>
                  {delivery.customer_phone}
                </a>
              )}
              {delivery.notes && (
                <div className="dsp-delivery-notes">{delivery.notes}</div>
              )}
              <div className="dsp-delivery-actions">
                {delivery.status === 'ready' && (
                  <button className="dsp-btn-pickup" onClick={markPickedUp}>
                    Recogi el pedido
                  </button>
                )}
                <button className="dsp-btn-done" onClick={completeDelivery} disabled={completing}>
                  {completing ? 'Guardando...' : 'Entregado'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AVAILABLE ORDERS ── */}
        <div className="dsp-section">
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
        </div>

        {/* GPS toggle at bottom */}
        {isActive && (
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
