'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import '../home.css'

type DeliveryRow = {
  id: string
  created_at: string
  delivered_at: string
  customer_name?: string
}

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

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

const BUCKETS = [
  { label: '0-15 min',  min: 0,  max: 15  },
  { label: '15-30 min', min: 15, max: 30  },
  { label: '30-45 min', min: 30, max: 45  },
  { label: '45-60 min', min: 45, max: 60  },
  { label: '+60 min',   min: 60, max: Infinity },
]

const today = toDateStr(new Date())

export default function AnaliticsPage() {
  const { user } = useAuth()
  const [storeId,    setStoreId]    = useState<string | null>(null)
  const [dateFrom,   setDateFrom]   = useState(today)
  const [dateTo,     setDateTo]     = useState(today)
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [openCard,   setOpenCard]   = useState(false)

  const load = useCallback(async (sid: string, from: string, to: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('deliveries')
      .select('id, created_at, delivered_at, customer_name')
      .eq('store_id', sid)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', `${from}T00:00:00`)
      .lte('delivered_at', `${to}T23:59:59`)
      .order('delivered_at', { ascending: false })
    setDeliveries((data ?? []) as DeliveryRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setStoreId(data.id)
      load(data.id, dateFrom, dateTo)
    })
  }, [user])

  useEffect(() => {
    if (storeId) load(storeId, dateFrom, dateTo)
  }, [storeId, dateFrom, dateTo, load])

  function setPreset(preset: 'today' | 'week' | 'month') {
    const d = new Date()
    if (preset === 'today') {
      setDateFrom(today); setDateTo(today)
    } else if (preset === 'week') {
      const start = new Date(d); start.setDate(d.getDate() - d.getDay())
      setDateFrom(toDateStr(start)); setDateTo(today)
    } else {
      const start = new Date(d); start.setDate(1)
      setDateFrom(toDateStr(start)); setDateTo(today)
    }
  }

  const mins = deliveries.map(d =>
    Math.round((new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 60000)
  )
  const avg   = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null
  const best  = mins.length ? Math.min(...mins) : null
  const worst = mins.length ? Math.max(...mins) : null
  const bucketCounts = BUCKETS.map(b => mins.filter(m => m >= b.min && m < b.max).length)
  const bucketMax = Math.max(...bucketCounts, 1)

  return (
    <div className="dh-content">

      {/* ── Date range header ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="dh-section-title" style={{ marginBottom: 14 }}>Analytics</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Date inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 14px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#0F172A', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
            />
            <span style={{ color: '#CBD5E1', fontSize: 13 }}>→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={e => setDateTo(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#0F172A', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
            />
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
            {([
              { key: 'today', label: 'Hoy' },
              { key: 'week',  label: 'Semana' },
              { key: 'month', label: 'Mes' },
            ] as const).map(p => {
              const active =
                p.key === 'today' ? dateFrom === today && dateTo === today :
                p.key === 'week'  ? dateFrom !== today && dateTo === today && new Date(dateFrom).getDay() === 0 && dateFrom !== toDateStr(new Date(new Date().setDate(1))) :
                false
              return (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: active ? 'white' : 'transparent',
                    color: active ? '#0F172A' : '#64748B',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tiempos card (collapsible) ── */}
      <div className="dh-card" style={{ padding: '0', marginBottom: 20, overflow: 'hidden' }}>

        {/* Card header — always visible */}
        <button
          onClick={() => setOpenCard(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Tiempos de entrega</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{loading ? '...' : `${deliveries.length} entregas`}</span>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
            style={{ transition: 'transform 0.2s', transform: openCard ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Card body */}
        {openCard && (
          <div style={{ padding: '0 24px 24px' }}>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Promedio', value: avg  !== null ? fmtMins(avg)  : '—' },
                { label: 'Mejor',    value: best !== null ? fmtMins(best) : '—' },
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
            {loading ? (
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
