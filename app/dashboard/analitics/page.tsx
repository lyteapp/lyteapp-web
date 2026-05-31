'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import '../home.css'
import './analitics.css'

// ── Types ──
type SaleOrder = {
  id: string
  created_at: string
  total: number
  payment_method: string | null
  status: string
}

type DeliveryRow = {
  id: string
  created_at: string
  delivered_at: string
  customer_name?: string
}

type ZoneRow = { id: string; name: string | null; center_lat: number; center_lng: number; radius_m: number }
type GeoDelivery = { id: string; customer_lat: number | null; customer_lng: number | null }
type AllOrder = { id: string; created_at: string; status: string; customer_lat: number | null; customer_lng: number | null }

// ── Status constants ──
const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', preparing: 'Cocina', ready: 'Listo', picked_up: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado' }
const STATUS_ORDER = ['delivered', 'picked_up', 'ready', 'preparing', 'pending', 'cancelled']
const STATUS_COLORS: Record<string, string> = { pending: '#94A3B8', preparing: '#F59E0B', ready: '#3B82F6', picked_up: '#7C3AED', delivered: '#10B981', cancelled: '#EF4444' }
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

// ── Method currency map ──
const METHOD_CURRENCY: Record<string, { label: string; currency: string; symbol: string }> = {
  'pago movil':       { label: 'Pago Movil',       currency: 'VES',  symbol: 'Bs' },
  'pago móvil':       { label: 'Pago Movil',       currency: 'VES',  symbol: 'Bs' },
  'efectivo bs':      { label: 'Efectivo Bs',      currency: 'VES',  symbol: 'Bs' },
  'transferencia':    { label: 'Transferencia',    currency: 'VES',  symbol: 'Bs' },
  'transferencia bs': { label: 'Transferencia Bs', currency: 'VES',  symbol: 'Bs' },
  'punto de venta':   { label: 'Punto de Venta',   currency: 'VES',  symbol: 'Bs' },
  'punto_venta':      { label: 'Punto de Venta',   currency: 'VES',  symbol: 'Bs' },
  'zelle':            { label: 'Zelle',            currency: 'USD',  symbol: '$'  },
  'efectivo usd':     { label: 'Efectivo USD',     currency: 'USD',  symbol: '$'  },
  'efectivo':         { label: 'Efectivo USD',     currency: 'USD',  symbol: '$'  },
  'usdt':             { label: 'USDT',             currency: 'USDT', symbol: '₮'  },
  'binance':          { label: 'Binance Pay',      currency: 'USDT', symbol: '₮'  },
  'binance pay':      { label: 'Binance Pay',      currency: 'USDT', symbol: '₮'  },
}

function getCurrencyInfo(method: string | null) {
  if (!method) return { label: 'Sin metodo', currency: 'USD', symbol: '$' }
  return METHOD_CURRENCY[method.toLowerCase().trim()] ?? { label: method, currency: 'USD', symbol: '$' }
}

// ── Date helpers ──
function sod(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function eod(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }
function toStr(d: Date) { return d.toISOString().slice(0, 10) }

// ── Preset logic ──
type Preset = 'hoy' | '7d' | 'mes' | 'mes_ant'

function presetDates(p: Preset): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const tod = sod(new Date())
  if (p === 'hoy') {
    const yest = new Date(tod); yest.setDate(tod.getDate() - 1)
    return { from: tod, to: tod, prevFrom: yest, prevTo: yest }
  }
  if (p === '7d') {
    const from = new Date(tod); from.setDate(tod.getDate() - 6)
    const prevTo = new Date(from); prevTo.setDate(from.getDate() - 1)
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - 6)
    return { from, to: tod, prevFrom, prevTo }
  }
  if (p === 'mes') {
    const from = new Date(tod.getFullYear(), tod.getMonth(), 1)
    const prevFrom = new Date(tod.getFullYear(), tod.getMonth() - 1, 1)
    const prevTo = new Date(tod.getFullYear(), tod.getMonth(), 0)
    return { from, to: tod, prevFrom, prevTo }
  }
  // mes_ant
  const from = new Date(tod.getFullYear(), tod.getMonth() - 1, 1)
  const to = new Date(tod.getFullYear(), tod.getMonth(), 0)
  const prevFrom = new Date(tod.getFullYear(), tod.getMonth() - 2, 1)
  const prevTo = new Date(tod.getFullYear(), tod.getMonth() - 1, 0)
  return { from, to, prevFrom, prevTo }
}

// ── Revenue chart ──
function RevenueChart({ orders, from, to }: { orders: SaleOrder[]; from: Date; to: Date }) {
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const byDay = diffDays <= 60

  const buckets: { key: string; label: string; total: number }[] = []
  if (byDay) {
    const d = new Date(from)
    while (d <= to) {
      const key = toStr(d)
      const label = d.getDate() === 1 || d.getTime() === from.getTime()
        ? d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
        : String(d.getDate())
      buckets.push({ key, label, total: 0 })
      d.setDate(d.getDate() + 1)
    }
  } else {
    const d = new Date(from.getFullYear(), from.getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1)
    while (d <= end) {
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
      buckets.push({ key, label, total: 0 })
      d.setMonth(d.getMonth() + 1)
    }
  }

  orders.forEach(o => {
    const key = byDay ? o.created_at.slice(0, 10) : o.created_at.slice(0, 7)
    const b = buckets.find(x => x.key === key)
    if (b) b.total += Number(o.total)
  })

  const maxTotal = Math.max(...buckets.map(b => b.total), 0.01)
  const visible = buckets.length > 30 ? buckets.slice(buckets.length - 30) : buckets

  return (
    <div className="an-chart-wrap">
      <div className="an-chart-bars">
        {visible.map(b => (
          <div key={b.key} className="an-chart-col">
            <div
              className={`an-chart-bar${b.total === 0 ? ' an-chart-bar--empty' : ''}`}
              style={{ height: `${Math.max((b.total / maxTotal) * 100, b.total > 0 ? 10 : 4)}%` }}
            />
            <div className="an-chart-label">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Delta badge ──
function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`an-delta ${up ? 'an-delta--up' : 'an-delta--down'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ── Delivery helpers ──
const BUCKETS = [
  { label: '0-15 min',  min: 0,  max: 15  },
  { label: '15-30 min', min: 15, max: 30  },
  { label: '30-45 min', min: 30, max: 45  },
  { label: '45-60 min', min: 45, max: 60  },
  { label: '+60 min',   min: 60, max: Infinity },
]

function fmtMins(m: number) {
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Page ──
export default function AnaliticsPage() {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<string | null>(null)

  // Sales
  const [preset, setPreset]           = useState<Preset | null>('mes')
  const [salesFromStr, setSalesFromStr] = useState(() => toStr(presetDates('mes').from))
  const [salesToStr,   setSalesToStr]   = useState(() => toStr(presetDates('mes').to))
  const [salesOrders, setSalesOrders] = useState<SaleOrder[]>([])
  const [prevOrders, setPrevOrders]   = useState<SaleOrder[]>([])
  const [bcvRate, setBcvRate]         = useState<number>(0)
  const [salesLoading, setSalesLoading] = useState(true)

  // Deliveries
  const todayStr = toStr(new Date())
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo]     = useState(todayStr)
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [loadingDel, setLoadingDel] = useState(false)
  const [openCard, setOpenCard]     = useState(false)

  // Operations / zones
  const [allOrders, setAllOrders]       = useState<AllOrder[]>([])
  const [zonesData, setZonesData]       = useState<ZoneRow[]>([])
  const [openOpsCard, setOpenOpsCard]   = useState(false)
  const [openZonesCard, setOpenZonesCard] = useState(false)

  // ── Loaders ──
  const loadSales = useCallback(async (sid: string, from: Date, to: Date, prevFrom: Date, prevTo: Date) => {
    setSalesLoading(true)
    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id,created_at,total,payment_method,status')
        .eq('store_id', sid)
        .neq('status', 'cancelled')
        .gte('created_at', sod(from).toISOString())
        .lte('created_at', eod(to).toISOString()),
      supabase
        .from('orders')
        .select('id,created_at,total,payment_method,status')
        .eq('store_id', sid)
        .neq('status', 'cancelled')
        .gte('created_at', sod(prevFrom).toISOString())
        .lte('created_at', eod(prevTo).toISOString()),
    ])
    setSalesOrders((curRes.data ?? []) as SaleOrder[])
    setPrevOrders((prevRes.data ?? []) as SaleOrder[])
    setSalesLoading(false)
  }, [])

  const loadOpsData = useCallback(async (sid: string, from: Date, to: Date) => {
    const [ordersRes, zonesRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id,created_at,status,customer_lat,customer_lng')
        .eq('store_id', sid)
        .gte('created_at', sod(from).toISOString())
        .lte('created_at', eod(to).toISOString()),
      supabase
        .from('delivery_zones')
        .select('id,name,center_lat,center_lng,radius_m')
        .eq('store_id', sid),
    ])
    setAllOrders((ordersRes.data ?? []) as AllOrder[])
    setZonesData((zonesRes.data ?? []) as ZoneRow[])
  }, [])

  const loadDeliveries = useCallback(async (sid: string, from: string, to: string) => {
    setLoadingDel(true)
    const { data } = await supabase
      .from('deliveries')
      .select('id,created_at,delivered_at,customer_name')
      .eq('store_id', sid)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', `${from}T00:00:00`)
      .lte('delivered_at', `${to}T23:59:59`)
      .order('delivered_at', { ascending: false })
    setDeliveries((data ?? []) as DeliveryRow[])
    setLoadingDel(false)
  }, [])

  function applySalesPreset(p: Preset) {
    const dates = presetDates(p)
    setPreset(p)
    setSalesFromStr(toStr(dates.from))
    setSalesToStr(toStr(dates.to))
  }

  // Initial load
  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setStoreId(data.id)
      loadDeliveries(data.id, dateFrom, dateTo)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!storeId || !salesFromStr || !salesToStr) return
    const from = new Date(salesFromStr + 'T00:00:00')
    const to   = new Date(salesToStr   + 'T00:00:00')
    let prevFrom: Date, prevTo: Date
    if (preset) {
      const p = presetDates(preset)
      prevFrom = p.prevFrom; prevTo = p.prevTo
    } else {
      const diffMs = to.getTime() - from.getTime()
      prevTo   = new Date(from.getTime() - 86400000)
      prevFrom = new Date(prevTo.getTime() - diffMs)
    }
    loadSales(storeId, from, to, prevFrom, prevTo)
  }, [storeId, salesFromStr, salesToStr, preset, loadSales])

  useEffect(() => {
    if (storeId) loadDeliveries(storeId, dateFrom, dateTo)
  }, [storeId, dateFrom, dateTo, loadDeliveries])

  useEffect(() => {
    if (!storeId || !salesFromStr || !salesToStr) return
    const from = new Date(salesFromStr + 'T00:00:00')
    const to   = new Date(salesToStr   + 'T00:00:00')
    loadOpsData(storeId, from, to)
  }, [storeId, salesFromStr, salesToStr, loadOpsData])

  useEffect(() => {
    fetch('/api/bcv-rate')
      .then(r => r.json())
      .then(d => { if (d.rates?.USD > 0) setBcvRate(d.rates.USD) })
      .catch(() => {})
  }, [])

  // ── Sales computations ──
  const totalUSD    = salesOrders.reduce((s, o) => s + Number(o.total), 0)
  const prevTotalUSD = prevOrders.reduce((s, o) => s + Number(o.total), 0)
  const orderCount  = salesOrders.length
  const prevCount   = prevOrders.length
  const avgTicket   = orderCount > 0 ? totalUSD / orderCount : 0

  const changePct      = prevTotalUSD > 0 ? ((totalUSD - prevTotalUSD) / prevTotalUSD) * 100 : null
  const countChangePct = prevCount > 0 ? ((orderCount - prevCount) / prevCount) * 100 : null

  const vesTotalUSD = salesOrders
    .filter(o => getCurrencyInfo(o.payment_method).currency === 'VES')
    .reduce((s, o) => s + Number(o.total), 0)
  const usdTotal = salesOrders
    .filter(o => getCurrencyInfo(o.payment_method).currency === 'USD')
    .reduce((s, o) => s + Number(o.total), 0)
  const usdtTotal = salesOrders
    .filter(o => getCurrencyInfo(o.payment_method).currency === 'USDT')
    .reduce((s, o) => s + Number(o.total), 0)

  const methodTotals = useMemo(() => {
    const map: Record<string, { label: string; currency: string; symbol: string; total: number }> = {}
    salesOrders.forEach(o => {
      const info = getCurrencyInfo(o.payment_method)
      if (!map[info.label]) map[info.label] = { ...info, total: 0 }
      map[info.label].total += Number(o.total)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [salesOrders])

  const salesFrom = new Date(salesFromStr + 'T00:00:00')
  const salesTo   = new Date(salesToStr   + 'T00:00:00')
  const salesDiffDays = Math.round((salesTo.getTime() - salesFrom.getTime()) / 86400000) + 1

  // ── Delivery computations ──
  const mins = deliveries.map(d =>
    Math.round((new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 60000)
  )
  const avg    = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null
  const best   = mins.length ? Math.min(...mins) : null
  const worst  = mins.length ? Math.max(...mins) : null
  const bucketCounts = BUCKETS.map(b => mins.filter(m => m >= b.min && m < b.max).length)
  const bucketMax = Math.max(...bucketCounts, 1)

  // ── Operations computations ──
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {}
    allOrders.forEach(o => { map[o.status] = (map[o.status] ?? 0) + 1 })
    return map
  }, [allOrders])

  const hourCounts = useMemo(() => {
    const arr = Array(24).fill(0)
    allOrders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      arr[h]++
    })
    return arr as number[]
  }, [allOrders])
  const hourMax = Math.max(...hourCounts, 1)
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

  const dayCounts = useMemo(() => {
    const arr = Array(7).fill(0)
    allOrders.forEach(o => {
      const d = new Date(o.created_at).getDay()
      arr[d]++
    })
    return arr as number[]
  }, [allOrders])
  const dayMax = Math.max(...dayCounts, 1)
  const peakDay = dayCounts.indexOf(Math.max(...dayCounts))

  const zoneCounts = useMemo(() => {
    const map: Record<string, { zone: ZoneRow; count: number }> = {}
    let outsideCount = 0
    allOrders.forEach(o => {
      if (o.customer_lat == null || o.customer_lng == null) return
      const matched = zonesData.find(z =>
        haversineM(o.customer_lat!, o.customer_lng!, z.center_lat, z.center_lng) <= z.radius_m
      )
      if (matched) {
        if (!map[matched.id]) map[matched.id] = { zone: matched, count: 0 }
        map[matched.id].count++
      } else {
        outsideCount++
      }
    })
    const rows = Object.values(map).sort((a, b) => b.count - a.count)
    if (outsideCount > 0) rows.push({ zone: { id: '__outside__', name: 'Fuera de zonas', center_lat: 0, center_lng: 0, radius_m: 0 }, count: outsideCount })
    return rows
  }, [allOrders, zonesData])
  const zoneCountMax = Math.max(...zoneCounts.map(z => z.count), 1)

  function setDelPreset(p: 'today' | 'week' | 'month') {
    const d = new Date()
    if (p === 'today') {
      setDateFrom(todayStr); setDateTo(todayStr)
    } else if (p === 'week') {
      const start = new Date(d); start.setDate(d.getDate() - d.getDay())
      setDateFrom(toStr(start)); setDateTo(todayStr)
    } else {
      const start = new Date(d); start.setDate(1)
      setDateFrom(toStr(start)); setDateTo(todayStr)
    }
  }

  return (
    <div className="dh-content">
      <div className="dh-section-title" style={{ marginBottom: 20 }}>Analytics</div>

      {/* ── VENTAS CARD ── */}
      <div className="dh-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Ventas</span>
          {salesLoading && <div className="an-spinner" />}
        </div>

        {/* Presets + date range */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div className="an-presets" style={{ marginBottom: 0 }}>
            {(['hoy', '7d', 'mes', 'mes_ant'] as Preset[]).map(p => {
              const labels: Record<Preset, string> = { hoy: 'Hoy', '7d': '7 dias', mes: 'Mes', mes_ant: 'Mes ant.' }
              return (
                <button
                  key={p}
                  className={`an-preset${preset === p ? ' active' : ''}`}
                  onClick={() => applySalesPreset(p)}
                >
                  {labels[p]}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '7px 12px' }}>
            <input
              type="date"
              value={salesFromStr}
              max={salesToStr}
              onChange={e => { setSalesFromStr(e.target.value); setPreset(null) }}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0F172A', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
            />
            <span style={{ color: '#CBD5E1', fontSize: 12 }}>→</span>
            <input
              type="date"
              value={salesToStr}
              min={salesFromStr}
              max={todayStr}
              onChange={e => { setSalesToStr(e.target.value); setPreset(null) }}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0F172A', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
            />
          </div>
        </div>

        {salesLoading ? null : salesOrders.length === 0 ? (
          <div className="an-empty">Sin ventas en este periodo</div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="an-kpi-row">
              <div className="an-kpi">
                <div className="an-kpi-label">Total facturado</div>
                <div className="an-kpi-value">
                  ${totalUSD.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <Delta pct={changePct} />
              </div>
              <div className="an-kpi">
                <div className="an-kpi-label">Pedidos</div>
                <div className="an-kpi-value">{orderCount}</div>
                <Delta pct={countChangePct} />
              </div>
              <div className="an-kpi">
                <div className="an-kpi-label">Ticket prom.</div>
                <div className="an-kpi-value">${avgTicket.toFixed(2)}</div>
              </div>
            </div>

            {/* Currency breakdown */}
            {(vesTotalUSD > 0 || usdTotal > 0 || usdtTotal > 0) && (
              <div className="an-currency-row">
                {vesTotalUSD > 0 && (
                  <div className="an-currency-card">
                    <div className="an-currency-label">Bolivares</div>
                    <div className="an-currency-amount">
                      {bcvRate > 0
                        ? `Bs ${(vesTotalUSD * bcvRate).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : 'Bs ...'}
                    </div>
                    <div className="an-currency-sub">${vesTotalUSD.toFixed(2)} equiv.</div>
                  </div>
                )}
                {usdTotal > 0 && (
                  <div className="an-currency-card">
                    <div className="an-currency-label">Dolares</div>
                    <div className="an-currency-amount">
                      ${usdTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {usdtTotal > 0 && (
                  <div className="an-currency-card">
                    <div className="an-currency-label">USDT</div>
                    <div className="an-currency-amount">
                      ₮{usdtTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Method breakdown */}
            {methodTotals.length > 0 && (
              <>
                <div className="an-section-label">Por metodo de pago</div>
                <div className="an-method-list" style={{ marginBottom: 16 }}>
                  {methodTotals.map(m => {
                    const pct = totalUSD > 0 ? (m.total / totalUSD) * 100 : 0
                    const isVES = m.currency === 'VES'
                    const displayAmt = isVES
                      ? bcvRate > 0
                        ? `Bs ${(m.total * bcvRate).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : 'Bs ...'
                      : `${m.symbol}${m.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    return (
                      <div key={m.label} className="an-method-row">
                        <div className="an-method-name">{m.label}</div>
                        <div className="an-method-bar-wrap">
                          <div className="an-method-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="an-method-pct">{pct.toFixed(0)}%</div>
                        <div className="an-method-amt">{displayAmt}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Bar chart */}
            <div className="an-section-label" style={{ marginBottom: 10 }}>
              Facturacion por {salesDiffDays > 60 ? 'mes' : 'dia'}
            </div>
            <RevenueChart orders={salesOrders} from={salesFrom} to={salesTo} />
          </>
        )}
      </div>

      {/* ── OPERACIONES (collapsible) ── */}
      <div className="dh-card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        <button
          onClick={() => setOpenOpsCard(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Operaciones</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{allOrders.length} pedidos</span>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
            style={{ transition: 'transform 0.2s', transform: openOpsCard ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {openOpsCard && (
          <div style={{ padding: '0 24px 24px' }}>

            {/* Status breakdown */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por estado</div>
            {allOrders.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Sin pedidos en este periodo</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                {STATUS_ORDER.filter(s => statusCounts[s] > 0).map(s => {
                  const count = statusCounts[s] ?? 0
                  const pct = allOrders.length > 0 ? (count / allOrders.length) * 100 : 0
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 78, fontSize: 12, color: '#64748B', flexShrink: 0 }}>{STATUS_LABELS[s] ?? s}</div>
                      <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: STATUS_COLORS[s] ?? '#94A3B8', borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                      <div style={{ width: 28, fontSize: 12, fontWeight: 600, color: '#0F172A', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Hour of day */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hora pico{allOrders.length > 0 ? ` — ${peakHour}:00 h` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 52, marginBottom: 6 }}>
              {hourCounts.map((count, h) => {
                const isPeak = h === peakHour && allOrders.length > 0
                return (
                  <div
                    key={h}
                    title={`${h}:00 — ${count} pedidos`}
                    style={{
                      flex: 1, minWidth: 0,
                      height: `${Math.max((count / hourMax) * 100, count > 0 ? 8 : 3)}%`,
                      background: isPeak ? '#7C3AED' : count > 0 ? '#C4B5FD' : '#E2E8F0',
                      borderRadius: '2px 2px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
              {[0, 6, 12, 18, 23].map(h => (
                <div key={h} style={{ fontSize: 10, color: '#94A3B8' }}>{h}h</div>
              ))}
            </div>

            {/* Day of week */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Dia mas fuerte{allOrders.length > 0 ? ` — ${DAY_LABELS[peakDay]}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
              {dayCounts.map((count, d) => {
                const isPeak = d === peakDay && allOrders.length > 0
                return (
                  <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max((count / dayMax) * 40, count > 0 ? 6 : 2)}px`,
                        background: isPeak ? '#7C3AED' : count > 0 ? '#C4B5FD' : '#E2E8F0',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <div style={{ fontSize: 11, color: isPeak ? '#7C3AED' : '#94A3B8', fontWeight: isPeak ? 700 : 400 }}>{DAY_LABELS[d]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── ZONAS MAS DESPACHADAS (collapsible) ── */}
      {zonesData.length > 0 && (
        <div className="dh-card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
          <button
            onClick={() => setOpenZonesCard(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Zonas mas despachadas</span>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
              style={{ transition: 'transform 0.2s', transform: openZonesCard ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {openZonesCard && (
            <div style={{ padding: '0 24px 24px' }}>
              {zoneCounts.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94A3B8' }}>Sin pedidos con ubicacion en este periodo</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {zoneCounts.map(({ zone, count }) => {
                    const pct = (count / zoneCountMax) * 100
                    const isOutside = zone.id === '__outside__'
                    return (
                      <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 110, fontSize: 12, color: isOutside ? '#94A3B8' : '#64748B', flexShrink: 0, fontStyle: isOutside ? 'italic' : 'normal' }}>
                          {zone.name ?? 'Sin nombre'}
                        </div>
                        <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: isOutside ? '#CBD5E1' : '#7C3AED', borderRadius: 4, transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ width: 28, fontSize: 12, fontWeight: 600, color: '#0F172A', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TIEMPOS DE ENTREGA (collapsible) ── */}
      <div className="dh-card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        <button
          onClick={() => setOpenCard(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Tiempos de entrega</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
              {loadingDel ? '...' : `${deliveries.length} entregas`}
            </span>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
            style={{ transition: 'transform 0.2s', transform: openCard ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {openCard && (
          <div style={{ padding: '0 24px 24px' }}>
            {/* Date range for deliveries */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px' }}>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0F172A', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
                />
                <span style={{ color: '#CBD5E1' }}>→</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={todayStr}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0F172A', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 3, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
                {([
                  { key: 'today', label: 'Hoy' },
                  { key: 'week',  label: 'Semana' },
                  { key: 'month', label: 'Mes' },
                ] as const).map(p => (
                  <button
                    key={p.key}
                    onClick={() => setDelPreset(p.key)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, background: 'transparent', color: '#64748B',
                      fontFamily: 'inherit',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Promedio', value: avg   !== null ? fmtMins(avg)   : '—' },
                { label: 'Mejor',    value: best  !== null ? fmtMins(best)  : '—' },
                { label: 'Peor',     value: worst !== null ? fmtMins(worst) : '—' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Distribution */}
            {deliveries.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distribucion</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {BUCKETS.map((b, i) => {
                    const count = bucketCounts[i]
                    const pct = Math.round((count / bucketMax) * 100)
                    return (
                      <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 72, fontSize: 12, color: '#64748B', flexShrink: 0 }}>{b.label}</div>
                        <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#7C3AED', borderRadius: 4, transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ width: 24, fontSize: 12, fontWeight: 600, color: '#0F172A', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Delivery list */}
            {loadingDel ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>Cargando...</div>
            ) : deliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>Sin entregas en este periodo</div>
            ) : (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {deliveries.map((d, i) => {
                    const m = mins[i]
                    const isLong = m >= 45
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: isLong ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${isLong ? '#FECACA' : '#E2E8F0'}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{d.customer_name ?? 'Cliente'}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                            {fmtDate(d.created_at)} · {fmtTime(d.created_at)} → {fmtTime(d.delivered_at)}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isLong ? '#DC2626' : '#7C3AED', flexShrink: 0 }}>
                          {fmtMins(m)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
