'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './delivery.css'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Cargando mapa...</span>
    </div>
  ),
})

const ZonesMap = dynamic(() => import('./ZonesMap'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF4', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Cargando mapa...</span>
    </div>
  ),
})

type Tab = 'live' | 'today' | 'couriers' | 'zones' | 'settlements' | 'settings'
type DeliveryStatus = 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled'
type TodayFilter = 'all' | 'ongoing' | 'delivered' | 'cancelled'

type Driver = { id: string; name: string; phone: string | null; is_active: boolean; created_at: string; avatar_url: string | null }
type DriverLocation = { driver_id: string; lat: number; lng: number; is_sharing: boolean; updated_at: string }
type Delivery = {
  id: string; store_id: string; order_id: string | null; driver_id: string | null
  customer_name: string; customer_phone: string; delivery_address: string
  status: DeliveryStatus; driver_fee: number; fee_paid: boolean
  notes: string | null; picked_up_at: string | null; delivered_at: string | null; created_at: string
  customer_lat: number | null; customer_lng: number | null; is_customer_order: boolean | null
  zone_id: string | null
  driver?: Driver | null
  zone?: { id: string; name: string; fee: number; color: string } | null
}
type Zone = { id: string; name: string; fee: number; color: string; radius_m: number; center_lat: number; center_lng: number }

const BASE_URL = 'https://lyte-app.com'
const pickupUrl = (id: string) => `${BASE_URL}/pickup/${id}`
const ZONE_COLORS = ['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#DB2777', '#0F172A', '#64748B']
const RADIUS_PRESETS = [
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
]

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function deliveryMinutes(del: Delivery) {
  if (!del.picked_up_at || !del.delivered_at) return null
  return Math.round((new Date(del.delivered_at).getTime() - new Date(del.picked_up_at).getTime()) / 60000)
}

function isToday(iso: string) {
  const d = new Date(iso); const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function zoneForCoords(lat: number | null, lng: number | null, zones: Zone[]) {
  if (lat == null || lng == null) return null
  return zones.find(z => haversineM(lat, lng, z.center_lat, z.center_lng) <= z.radius_m) ?? null
}

export default function DeliveryPage() {
  const { user } = useAuth()
  const [loading, setLoading]       = useState(true)
  const [storeId, setStoreId]       = useState<string | null>(null)
  const [storeName, setStoreName]   = useState<string>('')
  const [tab, setTab]               = useState<Tab>('live')
  const [deliveries, setDeliveries]         = useState<Delivery[]>([])
  const [drivers, setDrivers]               = useState<Driver[]>([])
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([])

  // Today tab
  const [todayFilter, setTodayFilter] = useState<TodayFilter>('all')

  // Zones tab
  const [zonesResizeTrigger, setZonesResizeTrigger] = useState(0)
  const [zones, setZones]               = useState<Zone[]>([])
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [editZone, setEditZone]         = useState<Zone | null>(null)
  const [zName, setZName]               = useState('')
  const [zFee, setZFee]                 = useState('')
  const [zColor, setZColor]             = useState('#7C3AED')
  const [zRadius, setZRadius]           = useState(2000)
  const [zCenter, setZCenter]           = useState<[number, number] | null>(null)
  const [zUserPos, setZUserPos]         = useState<[number, number] | null>(null)
  const [zSaving, setZSaving]           = useState(false)
  const [zError, setZError]             = useState('')

  // Couriers tab
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [editDriver, setEditDriver]         = useState<Driver | null>(null)
  const [drName, setDrName]   = useState('')
  const [drPhone, setDrPhone] = useState('')
  const [drSaving, setDrSaving] = useState(false)
  const [drError, setDrError]   = useState('')
  const [drAvatarFile, setDrAvatarFile] = useState<File | null>(null)
  const [drAvatarPreview, setDrAvatarPreview] = useState<string | null>(null)

  // Settings tab
  const [stDeliveryEnabled, setStDeliveryEnabled] = useState(false)
  const [stDeliveryFee,     setStDeliveryFee]     = useState('')
  const [stDeliveryTime,    setStDeliveryTime]     = useState('')
  const [stDeliveryZone,    setStDeliveryZone]     = useState('')
  const [stAutoAssign,      setStAutoAssign]        = useState(false)
  const [savingSettings,    setSavingSettings]     = useState(false)
  const [savedSettings,     setSavedSettings]      = useState(false)

  // Mobile fullscreen map
  const [showMap, setShowMap] = useState(false)

  // QR modals
  const [qrDel, setQrDel]       = useState<Delivery | null>(null)
  const [qrDriver, setQrDriver] = useState<Driver | null>(null)
  const [qrSeconds, setQrSeconds] = useState(272)
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Toast
  const [toast, setToast]   = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Copy state
  const [copied, setCopied] = useState(false)

  const trackUrl = (id: string) => `${BASE_URL}/delivery/${id}`

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  const loadData = useCallback(async (sid: string) => {
    const [{ data: dels }, { data: drvs }, { data: locs }, { data: zns }, { data: storeRow }] = await Promise.all([
      supabase.from('deliveries').select('*, driver:driver_id(id,name,phone,is_active), zone:zone_id(id,name,fee,color)').eq('store_id', sid).order('created_at', { ascending: false }).limit(300),
      supabase.from('delivery_drivers').select('*').eq('store_id', sid).order('name'),
      supabase.from('driver_locations').select('*').eq('store_id', sid),
      supabase.from('delivery_zones').select('*').eq('store_id', sid).order('created_at'),
      supabase.from('stores').select('checkout_settings').eq('id', sid).maybeSingle(),
    ])
    setDeliveries((dels as Delivery[]) ?? [])
    setDrivers(drvs ?? [])
    setDriverLocations((locs as DriverLocation[]) ?? [])
    setZones((zns as Zone[]) ?? [])
    const cs = (storeRow as { checkout_settings?: Record<string, unknown> } | null)?.checkout_settings ?? {}
    setStDeliveryEnabled(Boolean(cs.deliveryEnabled))
    setStDeliveryFee(cs.deliveryFee ? String(cs.deliveryFee) : '')
    setStDeliveryTime(typeof cs.deliveryTime === 'string' ? cs.deliveryTime : '')
    setStDeliveryZone(typeof cs.deliveryZone === 'string' ? cs.deliveryZone : '')
    setStAutoAssign(Boolean(cs.autoAssign))
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id, name').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) { setStoreId(data.id); setStoreName(data.name ?? ''); loadData(data.id) }
      setLoading(false)
    })
  }, [user, loadData])

  useEffect(() => {
    if (!storeId) return
    const ch = supabase.channel(`delivery-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `store_id=eq.${storeId}` }, () => loadData(storeId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => loadData(storeId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `store_id=eq.${storeId}` }, (payload) => {
        // Optimistic update: patch only the changed driver location instead of full reload
        const row = payload.new as DriverLocation
        if (row?.driver_id) {
          setDriverLocations(prev => {
            const exists = prev.find(d => d.driver_id === row.driver_id)
            return exists
              ? prev.map(d => d.driver_id === row.driver_id ? row : d)
              : [...prev, row]
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, loadData])

  // QR timer
  useEffect(() => {
    if (!qrDel) {
      if (qrTimer.current) clearInterval(qrTimer.current)
      return
    }
    setQrSeconds(272)
    qrTimer.current = setInterval(() => {
      setQrSeconds(s => { if (s <= 1) { clearInterval(qrTimer.current!); return 0 } return s - 1 })
    }, 1000)
    return () => { if (qrTimer.current) clearInterval(qrTimer.current) }
  }, [qrDel])

  useEffect(() => {
    if (tab === 'zones') setZonesResizeTrigger(n => n + 1)
    if (tab === 'live' && window.innerWidth <= 900) setShowMap(true)
    if (tab !== 'live') setShowMap(false)
  }, [tab])

  async function updateStatus(del: Delivery, status: DeliveryStatus) {
    const patch: Record<string, unknown> = { status }
    if (status === 'picked_up') patch.picked_up_at = new Date().toISOString()
    if (status === 'delivered') patch.delivered_at = new Date().toISOString()
    await supabase.from('deliveries').update(patch).eq('id', del.id)
    setDeliveries(p => p.map(d => d.id === del.id ? { ...d, ...patch } as Delivery : d))
    showToast(status === 'delivered' ? 'Entrega confirmada' : 'Estado actualizado')
  }


  async function saveDriver() {
    if (!storeId || !drName.trim()) return
    setDrSaving(true)
    setDrError('')

    let avatarUrl: string | null = editDriver?.avatar_url ?? null

    if (drAvatarFile) {
      const ext  = drAvatarFile.name.split('.').pop()
      const path = `${storeId}/drivers/${editDriver?.id ?? Date.now()}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('store-assets').upload(path, drAvatarFile, { upsert: true })
      if (upErr) { setDrError(upErr.message); setDrSaving(false); return }
      const { data: urlData } = supabase.storage.from('store-assets').getPublicUrl(path)
      avatarUrl = urlData.publicUrl
    }

    if (editDriver) {
      const { error } = await supabase.from('delivery_drivers')
        .update({ name: drName.trim(), phone: drPhone.trim() || null, avatar_url: avatarUrl })
        .eq('id', editDriver.id)
      if (error) { setDrError(error.message); setDrSaving(false); return }
    } else {
      const { error } = await supabase.from('delivery_drivers')
        .insert({ store_id: storeId, name: drName.trim(), phone: drPhone.trim() || null, is_active: true, avatar_url: avatarUrl })
      if (error) { setDrError(error.message); setDrSaving(false); return }
    }

    setDrName(''); setDrPhone(''); setEditDriver(null); setShowDriverForm(false)
    setDrSaving(false); setDrError(''); setDrAvatarFile(null); setDrAvatarPreview(null)
    showToast(editDriver ? 'Despachador actualizado' : 'Despachador agregado')
    await loadData(storeId)
  }

  async function toggleDriver(drv: Driver) {
    await supabase.from('delivery_drivers').update({ is_active: !drv.is_active }).eq('id', drv.id)
    setDrivers(p => p.map(d => d.id === drv.id ? { ...d, is_active: !drv.is_active } : d))
  }

  async function deleteDriver(id: string) {
    if (!confirm('Eliminar despachador?')) return
    await supabase.from('delivery_drivers').delete().eq('id', id)
    setDrivers(p => p.filter(d => d.id !== id))
  }

  function openZoneForm(zone?: Zone) {
    if (zone) {
      setEditZone(zone); setZName(zone.name ?? ''); setZFee(String(zone.fee ?? 0))
      setZColor(zone.color); setZRadius(zone.radius_m)
      setZCenter([zone.center_lat, zone.center_lng])
    } else {
      setEditZone(null); setZName(''); setZFee(''); setZColor('#7C3AED')
      setZRadius(2000); setZCenter(zUserPos)
    }
    setZError(''); setShowZoneForm(true)
  }

  async function saveZone() {
    if (!storeId || !zName.trim()) return
    const center = zCenter ?? zUserPos
    if (!center) { setZError('Toca el mapa para colocar el centro de la zona'); return }
    setZSaving(true); setZError('')
    const payload = {
      store_id: storeId, name: zName.trim(),
      fee: parseFloat(zFee) || 0, color: zColor,
      radius_m: zRadius, center_lat: center[0], center_lng: center[1],
    }
    const { error } = editZone
      ? await supabase.from('delivery_zones').update(payload).eq('id', editZone.id)
      : await supabase.from('delivery_zones').insert(payload)
    if (error) { setZError(error.message); setZSaving(false); return }
    setShowZoneForm(false); setEditZone(null); setZSaving(false)
    showToast(editZone ? 'Zona actualizada' : 'Zona creada')
    await loadData(storeId)
  }

  async function deleteZone(id: string) {
    if (!confirm('Eliminar zona?')) return
    await supabase.from('delivery_zones').delete().eq('id', id)
    setZones(p => p.filter(z => z.id !== id))
    showToast('Zona eliminada')
  }

  function sendWhatsApp(del: Delivery) {
    const url = trackUrl(del.id)
    const msg = `Hola ${del.customer_name}, tu pedido ya va en camino. Puedes seguirlo aqui: ${url}`
    window.open(`https://wa.me/${(del.customer_phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
  }

  async function saveSettings() {
    if (!storeId) return
    setSavingSettings(true)
    const { data: existing } = await supabase.from('stores').select('checkout_settings').eq('id', storeId).maybeSingle()
    const current = (existing as { checkout_settings?: Record<string, unknown> } | null)?.checkout_settings ?? {}
    const merged = {
      ...current,
      deliveryEnabled: stDeliveryEnabled,
      deliveryFee: stDeliveryFee ? parseFloat(stDeliveryFee) : null,
      deliveryTime: stDeliveryTime.trim() || null,
      deliveryZone: stDeliveryZone.trim() || null,
      autoAssign: stAutoAssign,
    }
    await supabase.from('stores').update({ checkout_settings: merged }).eq('id', storeId)
    setSavingSettings(false)
    setSavedSettings(true)
    setTimeout(() => setSavedSettings(false), 2500)
  }

  // Derived data
  const inRoute       = deliveries.filter(d => d.status === 'picked_up')
  const activeDrivers = drivers.filter(d => d.is_active !== false)
  const todayDels = deliveries.filter(d => isToday(d.created_at))

  const avgMinutes = (() => {
    const completed = todayDels.filter(d => d.picked_up_at && d.delivered_at)
    if (!completed.length) return null
    const total = completed.reduce((s, d) => s + (deliveryMinutes(d) ?? 0), 0)
    return Math.round(total / completed.length)
  })()


  const todayFiltered = todayDels.filter(d =>
    todayFilter === 'all' ? true
    : todayFilter === 'ongoing' ? ['ready', 'picked_up'].includes(d.status)
    : d.status === todayFilter
  )


  if (loading) return <div className="dv-spinner-wrap"><div className="dv-spinner" /></div>

  if (!storeId) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#0F172A' }}>No tienes una tienda aun</div>
      <a href="/dashboard/tienda" style={{ color: '#7C3AED' }}>Crear tienda</a>
    </div>
  )

  return (
    <div className="dv-root">

      {/* ── TABS ── */}
      <nav className="dv-tabs">
        <button className={`dv-tab${tab === 'live' ? ' active' : ''}`} onClick={() => setTab('live')}>
          En vivo
          {inRoute.length > 0 && (
            <span className="dv-tab-count">{inRoute.length}</span>
          )}
        </button>
        <button className={`dv-tab${tab === 'today' ? ' active' : ''}`} onClick={() => setTab('today')}>
          Hoy
        </button>
        <button className={`dv-tab${tab === 'couriers' ? ' active' : ''}`} onClick={() => setTab('couriers')}>
          Despachadores
        </button>
        <button className={`dv-tab${tab === 'zones' ? ' active' : ''}`} onClick={() => setTab('zones')}>
          Zonas
        </button>
        <button className={`dv-tab${tab === 'settlements' ? ' active' : ''}`} onClick={() => setTab('settlements')}>
          Liquidaciones
        </button>
        <button className={`dv-tab dv-tab-settings${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
          </svg>
          Ajustes
        </button>
      </nav>

      {/* ══════════════════════════════════════════════
          VISTA: EN VIVO
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'live' ? ' active' : ''}`}>

        {/* Mobile map button */}
        <button className="dv-map-mobile-btn" onClick={() => setShowMap(true)}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
            <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd"/>
          </svg>
          Ver mapa en vivo
        </button>

        {/* Fullscreen map overlay (mobile) */}
        {showMap && (
          <div className="dv-map-fullscreen">
            <div className="dv-map-fullscreen-header">
              <div className="dv-map-fullscreen-title">
                {inRoute.length > 0 ? `${inRoute.length} en ruta` : 'Mapa en vivo'}
              </div>
              <button className="dv-map-fullscreen-close" onClick={() => setShowMap(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
            {/* Floating counter (mobile) */}
            <div className="dv-map-badge">
              <span className="dv-live-dot" />
              <span style={{ fontWeight: 700, color: '#0F172A' }}>{inRoute.length}</span>
              <span style={{ color: '#64748B' }}>{inRoute.length === 1 ? 'en proceso' : 'en proceso'}</span>
            </div>

            {/* Floating customer cards (mobile) */}
            {inRoute.length > 0 && (
              <div className="dv-live-strip">
                {inRoute.map(del => (
                  <div key={del.id} className="dv-live-cc">
                    <div className="dv-live-cc-name">{del.customer_name}</div>
                    {del.delivery_address && <div className="dv-live-cc-addr">{del.delivery_address}</div>}
                    {(del.driver as Driver | null)?.name && (
                      <div className="dv-live-cc-driver">{(del.driver as Driver).name}</div>
                    )}
                    <button className="dv-live-cc-wa" onClick={() => sendWhatsApp(del)}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Contactar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <MapView
              inRoute={inRoute.map(del => ({
                id: del.id,
                customer_name: del.customer_name,
                driver_name: (del.driver as Driver | null)?.name ?? null,
                driver_id: del.driver_id,
                picked_up_at: del.picked_up_at,
              }))}
              driverLocations={driverLocations}
              drivers={drivers.map(d => ({ id: d.id, name: d.name }))}
              customerPins={todayDels.filter(d => d.customer_lat != null && d.customer_lng != null).map(d => ({
                id: d.id,
                customer_name: d.customer_name,
                delivery_address: d.delivery_address,
                status: d.status,
                customer_lat: d.customer_lat!,
                customer_lng: d.customer_lng!,
              }))}
              mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
            />
          </div>
        )}

        {/* Map — full width */}
        <div className="dv-panel dv-map-panel" style={{ position: 'relative', flex: 1, border: 'none' }}>
          {/* Floating order counter */}
          <div className="dv-map-badge">
            <span className="dv-live-dot" />
            <span style={{ fontWeight: 700, color: '#0F172A' }}>{inRoute.length}</span>
            <span style={{ color: '#64748B' }}>{inRoute.length === 1 ? 'pedido en proceso' : 'pedidos en proceso'}</span>
          </div>

          {/* Floating customer cards at bottom */}
          {inRoute.length > 0 && (
            <div className="dv-live-strip">
              {inRoute.map(del => (
                <div key={del.id} className="dv-live-cc">
                  <div className="dv-live-cc-name">{del.customer_name}</div>
                  {del.delivery_address && <div className="dv-live-cc-addr">{del.delivery_address}</div>}
                  {(del.driver as Driver | null)?.name && (
                    <div className="dv-live-cc-driver">{(del.driver as Driver).name}</div>
                  )}
                  <button className="dv-live-cc-wa" onClick={() => sendWhatsApp(del)}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Contactar
                  </button>
                </div>
              ))}
            </div>
          )}

          <MapView
            inRoute={inRoute.map(del => ({
              id: del.id,
              customer_name: del.customer_name,
              driver_name: (del.driver as Driver | null)?.name ?? null,
              driver_id: del.driver_id,
              picked_up_at: del.picked_up_at,
            }))}
            driverLocations={driverLocations}
            drivers={drivers.map(d => ({ id: d.id, name: d.name }))}
            customerPins={todayDels.filter(d => d.customer_lat != null && d.customer_lng != null).map(d => ({
              id: d.id,
              customer_name: d.customer_name,
              delivery_address: d.delivery_address,
              status: d.status,
              customer_lat: d.customer_lat!,
              customer_lng: d.customer_lng!,
            }))}
            mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
          />
        </div>

      </div>

      {/* ══════════════════════════════════════════════
          VISTA: HOY
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'today' ? ' active' : ''}`}>
        <div className="dv-table-wrap">
          <div className="dv-summary-grid">
            <div className="dv-summary-card">
              <div className="dv-sc-label">Entregas hoy</div>
              <div className="dv-sc-val">{todayDels.length}</div>
            </div>
            <div className="dv-summary-card">
              <div className="dv-sc-label">Tiempo promedio</div>
              <div className="dv-sc-val">{avgMinutes ? `${avgMinutes} min` : '—'}</div>
            </div>
            <div className="dv-summary-card">
              <div className="dv-sc-label">Canceladas</div>
              <div className="dv-sc-val">{todayDels.filter(d => d.status === 'cancelled').length}</div>
            </div>
          </div>

          <div className="dv-filter-pills">
            {(['all', 'ongoing', 'delivered', 'cancelled'] as const).map(f => (
              <button key={f} className={`dv-filter-pill${todayFilter === f ? ' active' : ''}`} onClick={() => setTodayFilter(f)}>
                {f === 'all' ? `Todos · ${todayDels.length}` : f === 'ongoing' ? `En curso · ${todayDels.filter(d => ['ready','picked_up'].includes(d.status)).length}` : f === 'delivered' ? `Entregados · ${todayDels.filter(d => d.status === 'delivered').length}` : `Cancelados · ${todayDels.filter(d => d.status === 'cancelled').length}`}
              </button>
            ))}
          </div>

          {todayFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--dv-ink-muted)', fontSize: 13 }}>
              Sin entregas para este filtro
            </div>
          ) : (
            <table className="dv-data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Direccion</th>
                  <th>Despachador</th>
                  <th>Listo</th>
                  <th>Recogido</th>
                  <th>Entregado</th>
                  <th>Tiempo</th>
                  <th>Zona</th>
                  <th style={{ textAlign: 'right' }}>Fee zona</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {todayFiltered.map(del => {
                  const drv = del.driver as Driver | null
                  const mins = deliveryMinutes(del)
                  const status = del.status === 'delivered' ? 'delivered' : del.status === 'cancelled' ? 'cancelled' : 'ongoing'
                  const statusLabel = { delivered: 'Entregado', cancelled: 'Cancelado', ongoing: 'En curso' }[status]
                  const displayZone = zoneForCoords(del.customer_lat, del.customer_lng, zones) ?? del.zone
                  return (
                    <tr key={del.id}>
                      <td style={{ fontWeight: 500 }}>{del.customer_name}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{del.delivery_address || '—'}</td>
                      <td>
                        {drv ? <><span className="dv-mini-av">{drv.name[0]}</span>{drv.name}</> : <span style={{ color: 'var(--dv-ink-muted)' }}>—</span>}
                      </td>
                      <td>{fmtTime(del.created_at)}</td>
                      <td>{fmtTime(del.picked_up_at)}</td>
                      <td>{fmtTime(del.delivered_at)}</td>
                      <td>{mins !== null ? `${mins} min` : '—'}</td>
                      <td>
                        {displayZone
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: displayZone.color, flexShrink: 0 }} />
                              {displayZone.name}
                            </span>
                          : <span style={{ color: 'var(--dv-ink-muted)' }}>—</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {displayZone ? `$${Number(displayZone.fee).toFixed(2)}` : <span style={{ color: 'var(--dv-ink-muted)' }}>—</span>}
                      </td>
                      <td><span className={`dv-chip ${status}`}>{statusLabel}</span></td>
                      <td>
                        {del.status === 'ready' && (
                          <button className="dv-btn-outline-sm" onClick={() => setQrDel(del)} style={{ fontSize: 11, padding: '4px 8px' }}>QR</button>
                        )}
                        {del.status === 'picked_up' && (
                          <button className="dv-btn-outline-sm" onClick={() => updateStatus(del, 'delivered')} style={{ fontSize: 11, padding: '4px 8px', color: '#1D9E75' }}>
                            Entregado
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: MOTORIZADOS
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'couriers' ? ' active' : ''}`}>
        <div className="dv-couriers-wrap">
          <div className="dv-couriers-header">
            <div style={{ fontSize: 13, color: 'var(--dv-ink-soft)' }}>
              {activeDrivers.length} activos · {drivers.length - activeDrivers.length} offline
            </div>
            <button className="dv-btn-add" onClick={() => { setDrName(''); setDrPhone(''); setEditDriver(null); setDrAvatarFile(null); setDrAvatarPreview(null); setShowDriverForm(true) }}>
              + Agregar despachador
            </button>
          </div>

          {showDriverForm && (
            <div className="dv-driver-form-card">
              <div className="dv-driver-form-title">{editDriver ? 'Editar despachador' : 'Nuevo despachador'}</div>

              {/* Avatar upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <label htmlFor="dr-avatar-input" style={{ cursor: 'pointer', flexShrink: 0 }}>
                  {drAvatarPreview
                    ? <img src={drAvatarPreview} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E2E8F0' }} />
                    : <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 20 20" fill="#94A3B8" width="20" height="20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                      </div>
                  }
                </label>
                <input
                  id="dr-avatar-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setDrAvatarFile(f)
                    setDrAvatarPreview(URL.createObjectURL(f))
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dv-ink)', marginBottom: 2 }}>
                    {drAvatarPreview ? 'Cambiar foto' : 'Agregar foto'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dv-ink-muted)' }}>Toca el circulo para subir</div>
                </div>
              </div>

              <div className="dv-driver-form-row">
                <div className="dv-form-field">
                  <label className="dv-form-label">Nombre *</label>
                  <input className="dv-input" value={drName} onChange={e => setDrName(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="dv-form-field">
                  <label className="dv-form-label">Telefono</label>
                  <input className="dv-input" value={drPhone} onChange={e => setDrPhone(e.target.value)} placeholder="+58 412 000 0000" type="tel" />
                </div>
              </div>
              {drError && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#DC2626', lineHeight: 1.4 }}>
                  {drError}
                </div>
              )}
              <div className="dv-driver-form-actions">
                <button className="dv-btn-ghost-sm" onClick={() => { setShowDriverForm(false); setDrError(''); setDrAvatarFile(null); setDrAvatarPreview(null) }}>Cancelar</button>
                <button className="dv-btn-primary-sm" onClick={saveDriver} disabled={drSaving || !drName.trim()}>
                  {drSaving ? 'Guardando...' : editDriver ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </div>
          )}

          {drivers.length === 0 ? (
            <div className="dv-empty-wrap">
              <h4>Sin despachadores registrados</h4>
              <p>Agrega tu equipo para asignar entregas</p>
            </div>
          ) : (
            <div className="dv-courier-grid">
              {drivers.map(drv => {
                const dDels = deliveries.filter(d => d.driver_id === drv.id && d.status !== 'cancelled')
                const todayDrv = dDels.filter(d => isToday(d.created_at) && d.status === 'delivered')
                const todayZoneFeeTotal = todayDrv.reduce((s, d) => s + Number(d.zone?.fee ?? d.driver_fee), 0)
                const busy = inRoute.find(d => d.driver_id === drv.id)
                const loc = driverLocations.find(d => d.driver_id === drv.id)
                const gpsActive = loc?.is_sharing && (Date.now() - new Date(loc.updated_at).getTime()) < 300_000
                return (
                  <div key={drv.id} className={`dv-courier-card${!drv.is_active ? ' inactive' : ''}`}>
                    <div className="dv-courier-card-head">
                      {drv.avatar_url
                        ? <img src={drv.avatar_url} alt={drv.name} className="dv-courier-card-av" style={{ objectFit: 'cover' }} />
                        : <div className="dv-courier-card-av">{drv.name[0].toUpperCase()}</div>
                      }
                      <div className="dv-courier-card-info">
                        <h4>{drv.name}</h4>
                        <p>{drv.phone || 'Sin telefono'}</p>
                      </div>
                      {gpsActive && (
                        <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803D', display: 'inline-block', animation: 'dbBlink 1.4s ease-in-out infinite' }} />
                          GPS activo
                        </span>
                      )}
                      {!gpsActive && (drv.is_active
                        ? busy
                          ? <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 500, marginLeft: 'auto', whiteSpace: 'nowrap' }}>en ruta</span>
                          : <span className="dv-badge-online" style={{ marginLeft: 'auto' }}>en linea</span>
                        : <span className="dv-badge-offline">offline</span>
                      )}
                    </div>
                    <div className="dv-courier-stats">
                      <div className="dv-courier-stat">
                        <div className="val">{todayDrv.length}</div>
                        <div className="lbl">Entregas hoy</div>
                      </div>
                      <div className="dv-courier-stat">
                        <div className="val">{dDels.length}</div>
                        <div className="lbl">Total</div>
                      </div>
                      <div className="dv-courier-stat">
                        <div className="val">${todayZoneFeeTotal.toFixed(2)}</div>
                        <div className="lbl">Acumulado hoy</div>
                      </div>
                    </div>

                    <div className="dv-courier-card-actions">
                      <button onClick={() => { setEditDriver(drv); setDrName(drv.name); setDrPhone(drv.phone ?? ''); setDrAvatarFile(null); setDrAvatarPreview(drv.avatar_url ?? null); setShowDriverForm(true) }}>
                        Editar
                      </button>
                      <button onClick={() => toggleDriver(drv)}>
                        {drv.is_active ? 'Pausar' : 'Activar'}
                      </button>
                      <button onClick={() => setQrDriver(drv)}>
                        Ver QR
                      </button>
                      <button className="danger" onClick={() => deleteDriver(drv.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: ZONAS
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'zones' ? ' active' : ''}`}>
        <div className="dv-zones-wrap">

          {/* ── Left: zone list + form ── */}
          <div className="dv-zones-list">
            <div className="dv-zones-header">
              <div>
                <h3>Zonas de delivery</h3>
                <p style={{ fontSize: 11, color: 'var(--dv-ink-muted)', marginTop: 2 }}>{zones.length} {zones.length === 1 ? 'zona' : 'zonas'} configuradas</p>
              </div>
              {!showZoneForm && (
                <button className="dv-btn-primary-sm" onClick={() => openZoneForm()}>+ Nueva zona</button>
              )}
            </div>

            {/* Zone form */}
            {showZoneForm && (
              <div className="dv-driver-form-card" style={{ marginBottom: 14 }}>
                <div className="dv-driver-form-title">{editZone ? 'Editar zona' : 'Nueva zona'}</div>

                {/* Name + fee */}
                <div className="dv-driver-form-row" style={{ marginBottom: 10 }}>
                  <div className="dv-form-field">
                    <label className="dv-form-label">Nombre *</label>
                    <input className="dv-input" value={zName} onChange={e => setZName(e.target.value)} placeholder="Ej. Centro, Altamira..." />
                  </div>
                  <div className="dv-form-field">
                    <label className="dv-form-label">Tarifa ($)</label>
                    <input className="dv-input" value={zFee} onChange={e => setZFee(e.target.value)} type="number" min="0" step="0.50" placeholder="0.00" />
                  </div>
                </div>

                {/* Radius */}
                <div className="dv-form-field" style={{ marginBottom: 10 }}>
                  <label className="dv-form-label">Radio de cobertura</label>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {RADIUS_PRESETS.map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setZRadius(r.value)}
                        style={{
                          padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                          border: `1px solid ${zRadius === r.value ? '#7C3AED' : 'rgba(15,23,42,0.1)'}`,
                          background: zRadius === r.value ? '#EEF2FF' : 'white',
                          color: zRadius === r.value ? '#4C1D95' : 'var(--dv-ink-soft)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={zRadius}
                      onChange={e => setZRadius(Number(e.target.value))}
                      style={{ width: 70, padding: '5px 8px', borderRadius: 7, fontSize: 11, border: '1px solid rgba(15,23,42,0.1)', fontFamily: 'inherit' }}
                      title="Radio en metros"
                    />
                    <span style={{ fontSize: 10, color: 'var(--dv-ink-muted)', alignSelf: 'center' }}>m</span>
                  </div>
                </div>

                {/* Color */}
                <div className="dv-form-field" style={{ marginBottom: 10 }}>
                  <label className="dv-form-label">Color</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ZONE_COLORS.map(c => (
                      <div
                        key={c}
                        onClick={() => setZColor(c)}
                        style={{
                          width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                          outline: zColor === c ? `3px solid ${c}` : 'none',
                          outlineOffset: 2,
                          boxShadow: zColor === c ? '0 0 0 2px white inset' : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Center indicator */}
                <div style={{ fontSize: 11, color: 'var(--dv-ink-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {zCenter ? (
                    <>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                      Centro: {zCenter[0].toFixed(5)}, {zCenter[1].toFixed(5)}
                      <button type="button" onClick={() => setZCenter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 11, padding: 0, marginLeft: 4 }}>quitar</button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27', flexShrink: 0 }} />
                      Toca el mapa para colocar el centro
                    </>
                  )}
                </div>

                {zError && (
                  <div style={{ marginBottom: 8, padding: '7px 10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 7, fontSize: 12, color: '#DC2626' }}>
                    {zError}
                  </div>
                )}

                <div className="dv-driver-form-actions">
                  <button className="dv-btn-ghost-sm" onClick={() => { setShowZoneForm(false); setZError('') }}>Cancelar</button>
                  <button className="dv-btn-primary-sm" onClick={saveZone} disabled={zSaving || !zName.trim()}>
                    {zSaving ? 'Guardando...' : editZone ? 'Guardar cambios' : 'Crear zona'}
                  </button>
                </div>
              </div>
            )}

            {/* Zone list */}
            {zones.length === 0 && !showZoneForm ? (
              <div className="dv-empty-wrap" style={{ flex: 'none', paddingTop: 40 }}>
                <h4>Sin zonas configuradas</h4>
                <p>Crea zonas con tarifas por radio para calcular el costo de delivery automaticamente.</p>
              </div>
            ) : (
              zones.map(z => (
                <div key={z.id} className="dv-zone-item" style={{ borderLeft: `3px solid ${z.color}` }}>
                  <div className="dv-zone-item-head">
                    <div className="dv-zone-name-row">
                      <span className="dv-zone-color-dot" style={{ background: z.color }} />
                      <h4>{z.name ?? 'Sin nombre'}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => openZoneForm(z)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dv-ink-muted)', padding: '2px 4px', borderRadius: 5, fontSize: 11 }}
                      >Editar</button>
                      <button
                        onClick={() => deleteZone(z.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '2px 4px', borderRadius: 5, fontSize: 11 }}
                      >Eliminar</button>
                    </div>
                  </div>
                  <div className="dv-zone-meta">
                    <span>{(z.radius_m / 1000).toFixed(1)} km radio</span>
                    <span className="dv-zone-fee">${(z.fee ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Right: real map ── */}
          <div className="dv-zones-map">
            <ZonesMap
              zones={zones}
              placingZone={showZoneForm}
              onMapClick={(lat, lng) => setZCenter([lat, lng])}
              previewCenter={zCenter ?? undefined}
              previewRadius={zRadius}
              previewColor={zColor}
              onUserPos={(lat, lng) => setZUserPos([lat, lng])}
              mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
              resizeTrigger={zonesResizeTrigger}
            />
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: LIQUIDACIONES
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'settlements' ? ' active' : ''}`}>
        <div className="dv-settle-wrap">
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: AJUSTES
      ══════════════════════════════════════════════ */}
      <div className={`dv-view${tab === 'settings' ? ' active' : ''}`}>
        <div className="dv-settings-view">
          <div className="dv-settings-wrap">

            {/* Delivery general */}
            <div className="dv-settings-section">
              <div className="dv-settings-section-head">
                <div className="dv-settings-section-title">Delivery</div>
                <div className="dv-settings-section-sub">Configura las opciones generales de tu servicio de delivery</div>
              </div>
              <div className="dv-settings-body">
                <div className="dv-settings-toggle-row">
                  <div>
                    <div className="dv-settings-toggle-label">Activar delivery</div>
                    <div className="dv-settings-toggle-hint">Los clientes pueden pedir delivery desde tu tienda</div>
                  </div>
                  <label className="dv-settings-toggle">
                    <input type="checkbox" checked={stDeliveryEnabled} onChange={() => setStDeliveryEnabled(v => !v)} />
                    <span className="dv-settings-toggle-track" />
                  </label>
                </div>

                <div className="dv-settings-toggle-row">
                  <div>
                    <div className="dv-settings-toggle-label">Distribucion automatica</div>
                    <div className="dv-settings-toggle-hint">Asigna pedidos listos al despachador disponible mas antiguo en cola</div>
                  </div>
                  <label className="dv-settings-toggle">
                    <input type="checkbox" checked={stAutoAssign} onChange={() => setStAutoAssign(v => !v)} />
                    <span className="dv-settings-toggle-track" />
                  </label>
                </div>

                <div className="dv-settings-field">
                  <div className="dv-settings-field-label">Tarifa base de delivery ($)</div>
                  <input
                    className="dv-settings-input"
                    type="number"
                    min="0"
                    step="0.50"
                    value={stDeliveryFee}
                    onChange={e => setStDeliveryFee(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="dv-settings-field">
                  <div className="dv-settings-field-label">Tiempo estimado de entrega</div>
                  <input
                    className="dv-settings-input"
                    type="text"
                    value={stDeliveryTime}
                    onChange={e => setStDeliveryTime(e.target.value)}
                    placeholder="Ej. 30-45 min"
                  />
                </div>

                <div className="dv-settings-field">
                  <div className="dv-settings-field-label">Zona de cobertura (descripcion)</div>
                  <textarea
                    className="dv-settings-input dv-settings-textarea"
                    value={stDeliveryZone}
                    onChange={e => setStDeliveryZone(e.target.value)}
                    placeholder="Ej. Municipio Chacao, Las Mercedes, El Hatillo..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="dv-settings-save-row">
              <button className="dv-settings-save-btn" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Guardando...' : 'Guardar ajustes'}
              </button>
              {savedSettings && <span className="dv-settings-saved">Guardado</span>}
            </div>

          </div>
        </div>
      </div>

      {/* ── DRIVER QR CARD MODAL ── */}
      {qrDriver && (
        <div className="dv-qr-overlay" onClick={() => setQrDriver(null)}>
          <div className="dv-qr-modal" onClick={e => e.stopPropagation()}>
            <div className="dv-qr-header">
              <div>
                <h3>{qrDriver.name}</h3>
                <div style={{ fontSize: 11, color: 'var(--dv-ink-muted)', marginTop: 2 }}>Tarjeta de despachador</div>
              </div>
              <button className="dv-close-btn" onClick={() => setQrDriver(null)}>✕</button>
            </div>
            <div className="dv-qr-body">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dv-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Escanear para activar GPS
              </div>
              <div className="dv-qr-display">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${BASE_URL}/driver/${qrDriver.id}`)}&margin=10&color=0F172A&bgcolor=FFFFFF`}
                  alt="QR Code"
                />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--dv-ink)', letterSpacing: '-0.3px', marginBottom: 10 }}>
                {qrDriver.name}
              </div>
              <p className="dv-qr-hint">
                El despachador escanea este codigo con su telefono para activar el rastreo GPS en tiempo real. El cliente vera su ubicacion en vivo.
              </p>
              <div className="dv-qr-url">{`${BASE_URL}/driver/${qrDriver.id}`}</div>
            </div>
            <div className="dv-qr-actions">
              <button className="dv-qr-copy-btn" onClick={() => { copyLink(`${BASE_URL}/driver/${qrDriver.id}`); showToast('Link copiado') }}>
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
            <div className="dv-qr-footer">
              <span>QR permanente · unico por despachador</span>
              <button className="dv-btn-primary-sm" onClick={() => setQrDriver(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR MODAL ── */}
      {qrDel && (
        <div className="dv-qr-overlay" onClick={() => setQrDel(null)}>
          <div className="dv-qr-modal" onClick={e => e.stopPropagation()}>
            <div className="dv-qr-header">
              <h3>QR de entrega · {qrDel.customer_name}</h3>
              <button className="dv-close-btn" onClick={() => setQrDel(null)}>✕</button>
            </div>
            <div className="dv-qr-body">
              <div className="dv-qr-display">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pickupUrl(qrDel.id))}&margin=10&color=0F172A&bgcolor=FFFFFF`}
                  alt="QR Code"
                />
              </div>
              <div className="dv-qr-timer">
                <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                Expira en {Math.floor(qrSeconds / 60)}:{String(qrSeconds % 60).padStart(2, '0')}
              </div>
              <p className="dv-qr-hint">
                El despachador escanea esto para confirmar la recogida y notificar al cliente
              </p>
              <div className="dv-qr-url">{pickupUrl(qrDel.id)}</div>
            </div>
            <div className="dv-qr-actions">
              <button className="dv-qr-copy-btn" onClick={() => copyLink(trackUrl(qrDel.id))}>
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button className="dv-qr-wa-btn" onClick={() => { sendWhatsApp(qrDel); showToast('WhatsApp abierto') }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar por WhatsApp
              </button>
            </div>
            <div className="dv-qr-footer">
              <span>QR de un solo uso · vinculado a esta entrega</span>
              <button className="dv-btn-primary-sm" onClick={() => setQrDel(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="dv-toast">
          <span className="dv-toast-check">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}
