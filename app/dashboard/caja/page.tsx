'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './caja.css'

type Order = {
  id: string
  customer_name: string
  customer_phone: string
  payment_method: string | null
  payment_proof_url: string | null
  payment_verified_by: string | null
  total: number
  status: string
  created_at: string
}

const METHOD_CURRENCY: Record<string, { label: string; currency: string; symbol: string }> = {
  'pago movil':       { label: 'Pago Movil',       currency: 'VES', symbol: 'Bs' },
  'pago móvil':       { label: 'Pago Movil',       currency: 'VES', symbol: 'Bs' },
  'efectivo bs':      { label: 'Efectivo Bs',      currency: 'VES', symbol: 'Bs' },
  'transferencia':    { label: 'Transferencia',    currency: 'VES', symbol: 'Bs' },
  'transferencia bs': { label: 'Transferencia Bs', currency: 'VES', symbol: 'Bs' },
  'punto de venta':   { label: 'Punto de Venta',   currency: 'VES', symbol: 'Bs' },
  'punto_venta':      { label: 'Punto de Venta',   currency: 'VES', symbol: 'Bs' },
  'zelle':            { label: 'Zelle',            currency: 'USD', symbol: '$'  },
  'efectivo usd':     { label: 'Efectivo USD',     currency: 'USD', symbol: '$'  },
  'efectivo':         { label: 'Efectivo USD',     currency: 'USD', symbol: '$'  },
  'usdt':             { label: 'USDT',             currency: 'USDT', symbol: '₮' },
  'binance':          { label: 'Binance Pay',      currency: 'USDT', symbol: '₮' },
  'binance pay':      { label: 'Binance Pay',      currency: 'USDT', symbol: '₮' },
}

function getCurrencyInfo(method: string | null) {
  if (!method) return { label: 'Sin metodo', currency: 'USD', symbol: '$' }
  return METHOD_CURRENCY[method.toLowerCase().trim()] ?? { label: method, currency: 'USD', symbol: '$' }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function CalendarPicker({ from, to, onChange }: {
  from: Date
  to: Date
  onChange: (from: Date, to: Date) => void
}) {
  const [viewYear, setViewYear]   = useState(from.getFullYear())
  const [viewMonth, setViewMonth] = useState(from.getMonth())
  const [picking, setPicking]     = useState<Date | null>(null)
  const today = startOfDay(new Date())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    const canGo = viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth < today.getMonth())
    if (!canGo) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function handleDay(date: Date) {
    if (!picking) {
      setPicking(date)
    } else {
      const [a, b] = date.getTime() < picking.getTime() ? [date, picking] : [picking, date]
      onChange(a, b)
      setPicking(null)
    }
  }

  const firstDow  = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMo  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMo }, (_, i) => i + 1)]
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const canGoNext  = viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth < today.getMonth())

  return (
    <div className="cx-calendar">
      <div className={`cx-cal-hint${picking ? ' cx-cal-hint--picking' : ''}`}>
        {picking
          ? `Desde ${picking.toLocaleDateString('es', { day: 'numeric', month: 'long' })} — elige el dia final`
          : 'Elige el primer dia del rango'}
      </div>
      <div className="cx-cal-nav">
        <button className="cx-cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cx-cal-month">{monthLabel}</span>
        <button className="cx-cal-nav-btn" onClick={nextMonth} disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.3 }}>›</button>
      </div>
      <div className="cx-cal-dow">
        {['L','M','M','J','V','S','D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="cx-cal-grid">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />
          const date = startOfDay(new Date(viewYear, viewMonth, day))
          const isFuture = date > today
          let cls = 'cx-cal-day'
          if (picking) {
            if (date.getTime() === picking.getTime()) cls += ' cx-cal-day--picking'
            else if (date.getTime() === today.getTime()) cls += ' cx-cal-day--today'
          } else {
            const isStart = date.getTime() === from.getTime()
            const isEnd   = date.getTime() === to.getTime()
            const inRange = date > from && date < to
            if (isStart || isEnd)  cls += ' cx-cal-day--sel'
            else if (inRange)      cls += ' cx-cal-day--in-range'
            else if (date.getTime() === today.getTime()) cls += ' cx-cal-day--today'
          }
          return (
            <button key={i} disabled={isFuture} onClick={() => handleDay(date)} className={cls}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function whatsappUrl(phone: string) {
  let num = phone.replace(/[^\d]/g, '')
  if (num.startsWith('0')) num = '58' + num.slice(1)
  return `https://wa.me/${num}`
}

export default function CajaPage() {
  const { user } = useAuth()

  // Config state
  const [loading, setLoading]       = useState(true)
  const [storeId, setStoreId]       = useState<string | null>(null)
  const [checkoutSettings, setCheckoutSettings] = useState<Record<string, unknown>>({})
  const [cajeras, setCajeras]       = useState<{ id: string; name: string; pin: string }[]>([])
  const [newName, setNewName]       = useState('')
  const [newPin, setNewPin]         = useState('')
  const [cajerasSaving, setCajerasSaving] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [showQr, setShowQr]         = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Orders state
  const [orders, setOrders]         = useState<Order[]>([])
  const [bcvRate, setBcvRate]       = useState<number>(0)
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const [dateFrom, setDateFrom]         = useState<Date>(() => startOfDay(new Date()))
  const [dateTo, setDateTo]             = useState<Date>(() => startOfDay(new Date()))
  const [showCalendar, setShowCalendar] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  const fetchOrders = useCallback(async (sid: string) => {
    const since = new Date(); since.setDate(since.getDate() - 90)
    const { data } = await supabase
      .from('orders')
      .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_verified_by,total,status,created_at')
      .eq('store_id', sid)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    setOrders(data ?? [])
  }, [])

  // Initial load
  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id, checkout_settings').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setStoreId(data.id)
        const cs = (data.checkout_settings as Record<string, unknown>) ?? {}
        setCheckoutSettings(cs)
        setCajeras((cs.cajeros as { id: string; name: string; pin: string }[]) ?? [])
        fetchOrders(data.id)
      }
      setLoading(false)
    })
  }, [user, fetchOrders])

  // Realtime orders
  useEffect(() => {
    if (!storeId) return
    const channel = supabase
      .channel(`dashboard-caja-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => fetchOrders(storeId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId, fetchOrders])

  // BCV rate
  useEffect(() => {
    fetch('/api/bcv-rate')
      .then(r => r.json())
      .then(d => { if (d.rates?.USD > 0) setBcvRate(d.rates.USD) })
      .catch(() => {})
  }, [])

  // Cajera actions
  async function addCajera() {
    if (!storeId || !newName.trim() || !newPin.trim()) return
    setCajerasSaving(true)
    const next = [...cajeras, { id: crypto.randomUUID(), name: newName.trim(), pin: newPin.trim() }]
    const newCs = { ...checkoutSettings, cajeros: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setCajeras(next)
    setNewName(''); setNewPin('')
    setCajerasSaving(false)
    showToast('Cajera agregada')
  }

  async function removeCajera(id: string) {
    if (!storeId) return
    const next = cajeras.filter(c => c.id !== id)
    const newCs = { ...checkoutSettings, cajeros: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setCajeras(next)
    showToast('Cajera eliminada')
  }

  function copyCajeroLink() {
    if (!cajeroUrl) return
    navigator.clipboard.writeText(cajeroUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
  }

  const cajeroUrl = storeId ? `https://lyte-app.com/cajero/${storeId}` : ''

  // Filtered orders
  const today = startOfDay(new Date())
  const filteredOrders = orders.filter(o => {
    if (o.status === 'cancelled') return false
    const d = startOfDay(new Date(o.created_at))
    return d >= dateFrom && d <= dateTo
  })
  const isSingleDay = dateFrom.getTime() === dateTo.getTime()
  const dateLabel = isSingleDay && dateFrom.getTime() === today.getTime()
    ? 'Hoy'
    : isSingleDay
    ? dateFrom.toLocaleDateString('es', { day: 'numeric', month: 'long' })
    : `${dateFrom.toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${dateTo.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`

  // Per-method totals
  const methodTotals = Object.values(
    filteredOrders.reduce((acc, o) => {
      const info = getCurrencyInfo(o.payment_method)
      if (!acc[info.label]) acc[info.label] = { ...info, total: 0 }
      acc[info.label].total += Number(o.total)
      return acc
    }, {} as Record<string, { label: string; currency: string; symbol: string; total: number }>)
  )

  if (loading) return <div className="cx-spinner-wrap"><div className="cx-spinner" /></div>

  return (
    <div className="cx-root">
      <div className="cx-view cx-cierre-view">

        {/* ── Pagos de hoy ── */}
        <div className="cx-breakdown-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div className="cx-breakdown-title">Pagos · {dateLabel}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowCalendar(v => !v)}
                className={`cx-settings-btn${showCalendar ? ' cx-settings-btn--active' : ''}`}
                title="Filtrar por fecha"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                </svg>
                {dateLabel}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="cx-settings-btn"
                title="Ajustes de caja"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>

          {showCalendar && (
            <CalendarPicker
              from={dateFrom}
              to={dateTo}
              onChange={(a, b) => { setDateFrom(a); setDateTo(b); setShowCalendar(false) }}
            />
          )}

          {/* Per-method totals */}
          {filteredOrders.length > 0 && (
            <div className="cx-day-totals">
              {methodTotals.map(m => {
                const isVES = m.currency === 'VES'
                const displayAmount = isVES
                  ? bcvRate > 0
                    ? `Bs ${(m.total * bcvRate).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'Bs ...'
                  : `${m.symbol}${m.total.toFixed(2)}`
                return (
                  <div key={m.label} className="cx-day-total-card">
                    <div className="cx-day-total-label">{m.label}</div>
                    <div className="cx-day-total-amount">{displayAmount}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Order list */}
          {filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 13 }}>
              Sin pedidos hoy
            </div>
          ) : (
            <div className="cx-pay-list">
              {filteredOrders.map((order, idx) => {
                const info    = getCurrencyInfo(order.payment_method)
                const amount  = Number(order.total)
                const isVES   = info.currency === 'VES'
                const displayAmount = isVES
                  ? bcvRate > 0
                    ? `Bs ${(amount * bcvRate).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'Bs ...'
                  : `${info.symbol}${amount.toFixed(2)}`
                const orderNum = filteredOrders.length - idx
                const hasProof = !!order.payment_proof_url

                return (
                  <div key={order.id} className={`cx-pay-row${hasProof ? ' cx-pay-row--proof' : ''}`} onClick={() => hasProof && setLightbox(order.payment_proof_url!)}>
                    <div className="cx-pay-num">#{orderNum}</div>
                    <div className="cx-pay-info">
                      <div className="cx-pay-name">{order.customer_name}</div>
                      <span className="cx-method-chip">{info.label}</span>
                      {order.payment_verified_by && (
                        <span className="cx-pay-verified">Verificado por {order.payment_verified_by}</span>
                      )}
                    </div>
                    <div className="cx-pay-right">
                      <div className="cx-pay-amount">{displayAmount}</div>
                      <div className="cx-pay-actions">
                        {hasProof && (
                          <div className="cx-pay-proof-icon" title="Ver comprobante">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        )}
                        {order.customer_phone && (
                          <a
                            href={whatsappUrl(order.customer_phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cx-pay-wa"
                            onClick={e => e.stopPropagation()}
                            title="Abrir WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="cx-settings-panel">
            <div className="cx-settings-header">
              <span className="cx-settings-title">Ajustes de caja</span>
              <button onClick={() => setShowSettings(false)} className="cx-settings-close">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>

            <div className="cx-settings-body">
              {/* Link */}
              <div className="cx-breakdown-section">
                <div className="cx-breakdown-title">Link de acceso para cajeros</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>Comparte este link con tus cajeros o escanea el QR desde el dispositivo de caja.</div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>{cajeroUrl}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyCajeroLink} style={{ flex: 1, background: copied ? '#10B981' : '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                    {copied ? 'Copiado' : 'Copiar link'}
                  </button>
                  <button onClick={() => setShowQr(true)} style={{ background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd"/>
                      <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM15 13a1 1 0 10-2 0v3a1 1 0 102 0v-3zM11 19a1 1 0 110-2h2a1 1 0 110 2h-2z"/>
                    </svg>
                  </button>
                  <a href={cajeroUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
                    Abrir
                  </a>
                </div>
              </div>

              {/* Cajeras */}
              <div className="cx-breakdown-section">
                <div className="cx-breakdown-title">Cajeras</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>Cada cajera tiene su propio PIN. Al ingresar, la app muestra su nombre en el encabezado.</div>
                {cajeras.length > 0 && (
                  <table className="cx-breakdown-table">
                    <thead><tr><th>Nombre</th><th>PIN</th><th></th></tr></thead>
                    <tbody>
                      {cajeras.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 500 }}>{c.name}</td>
                          <td style={{ fontFamily: 'monospace', letterSpacing: '0.1em', color: '#64748B' }}>{'•'.repeat(c.pin.length)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => removeCajera(c.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: '2px 6px' }}>Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>NOMBRE</div>
                    <input type="text" placeholder="Ej: Maria" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 90 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>PIN</div>
                    <input type="password" inputMode="numeric" placeholder="1234" value={newPin} onChange={e => setNewPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCajera()} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }} />
                  </div>
                  <button onClick={addCajera} disabled={cajerasSaving || !newName.trim() || !newPin.trim()} style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: cajerasSaving ? 0.6 : 1, flexShrink: 0 }}>Agregar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox} onClick={e => e.stopPropagation()} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}

      {/* ── QR MODAL ── */}
      {showQr && cajeroUrl && (
        <div onClick={() => setShowQr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>App de cajero</div>
            <QRCodeSVG value={cajeroUrl} size={220} bgColor="#ffffff" fgColor="#0F172A" />
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', wordBreak: 'break-all' }}>{cajeroUrl}</div>
            <button onClick={() => setShowQr(false)} style={{ width: '100%', background: '#F1F5F9', color: '#0F172A', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="cx-toast">
          <span className="cx-toast-check">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          </span>
          {toast}
        </div>
      )}
    </div>
  )
}
