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

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = { day: 'Dia', week: 'Semana', month: 'Mes' }

function periodStart(p: Period): Date {
  const d = new Date()
  if (p === 'day')   { d.setHours(0, 0, 0, 0) }
  if (p === 'week')  { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0) }
  if (p === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
  return d
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

const BUCKETS = [
  { label: '0-15 min',  min: 0,   max: 15  },
  { label: '15-30 min', min: 15,  max: 30  },
  { label: '30-45 min', min: 30,  max: 45  },
  { label: '45-60 min', min: 45,  max: 60  },
  { label: '+60 min',   min: 60,  max: Infinity },
]

export default function AnaliticsPage() {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('day')
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (sid: string, p: Period) => {
    setLoading(true)
    const start = periodStart(p)
    const { data } = await supabase
      .from('deliveries')
      .select('id, created_at, delivered_at, customer_name')
      .eq('store_id', sid)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', start.toISOString())
      .order('delivered_at', { ascending: false })
    setDeliveries((data ?? []) as DeliveryRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setStoreId(data.id)
      load(data.id, period)
    })
  }, [user])

  useEffect(() => {
    if (storeId) load(storeId, period)
  }, [storeId, period, load])

  const mins = deliveries.map(d =>
    Math.round((new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 60000)
  )
  const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null
  const best = mins.length ? Math.min(...mins) : null
  const worst = mins.length ? Math.max(...mins) : null

  const bucketCounts = BUCKETS.map(b => mins.filter(m => m >= b.min && m < b.max).length)
  const bucketMax = Math.max(...bucketCounts, 1)

  return (
    <div className="dh-content">

      {/* Period selector */}
      <div className="dh-section-head" style={{ marginBottom: 20 }}>
        <div className="dh-section-title">Analytics</div>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: period === p ? 'white' : 'transparent',
                color: period === p ? '#0F172A' : '#64748B',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Tiempos card */}
      <div className="dh-card" style={{ padding: '22px 24px', marginBottom: 20 }}>
        <div className="dh-section-head" style={{ marginBottom: 20 }}>
          <div className="dh-section-title">Tiempos de entrega</div>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{deliveries.length} entregas</span>
        </div>

        {/* Summary stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Promedio', value: avg !== null ? fmtMins(avg) : '—' },
            { label: 'Mejor',    value: best !== null ? fmtMins(best) : '—' },
            { label: 'Peor',     value: worst !== null ? fmtMins(worst) : '—' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Distribution bar chart */}
        {deliveries.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distribucion</div>
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
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>Cargando...</div>
        ) : deliveries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>Sin entregas en este periodo</div>
        ) : (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle</div>
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

    </div>
  )
}
