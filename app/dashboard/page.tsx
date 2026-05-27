'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/LocaleProvider'
import './home.css'

const BUCKETS = [
  { label: '0–15 min', min: 0,  max: 15  },
  { label: '15–30 min', min: 15, max: 30  },
  { label: '30–45 min', min: 30, max: 45  },
  { label: '+45 min',   min: 45, max: Infinity },
]

function fmtMins(m: number) {
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function Dashboard() {
  const { user } = useAuth()
  const t = useT()
  const [storeSlug, setStoreSlug] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [orderCount, setOrderCount] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [avgTicket, setAvgTicket] = useState(0)
  const [productCount, setProductCount] = useState(0)
  const [deliveryMins, setDeliveryMins] = useState<number[]>([])

  const loadDeliveryTimes = useCallback(async (sid: string) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('deliveries')
      .select('created_at, delivered_at')
      .eq('store_id', sid)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', todayStart.toISOString())
    const mins = (data ?? []).map(d =>
      Math.round((new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 60000)
    )
    setDeliveryMins(mins)
  }, [])

  const loadStats = useCallback(async (sid: string, p: 'day' | 'week' | 'month') => {
    const start = new Date()
    if (p === 'day')   { start.setHours(0, 0, 0, 0) }
    if (p === 'week')  { start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0) }
    if (p === 'month') { start.setDate(1); start.setHours(0, 0, 0, 0) }
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total')
      .eq('store_id', sid)
      .gte('created_at', start.toISOString())
    const count = orders?.length ?? 0
    const sum   = (orders ?? []).reduce((acc, o) => acc + Number(o.total ?? 0), 0)
    setOrderCount(count)
    setTotalSales(sum)
    setAvgTicket(count > 0 ? sum / count : 0)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id,name,slug').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setStoreSlug(data.slug ?? '')
      setStoreId(data.id)
      loadStats(data.id, 'day')
      loadDeliveryTimes(data.id)
      supabase.from('products').select('id', { count: 'exact' }).eq('store_id', data.id).then(({ count }) => setProductCount(count ?? 0))
    })
  }, [user, loadStats, loadDeliveryTimes])

  useEffect(() => {
    if (!storeId) return
    loadStats(storeId, period)
  }, [storeId, period, loadStats])

  useEffect(() => {
    if (!storeId) return
    const interval = setInterval(() => loadDeliveryTimes(storeId), 60000)
    return () => clearInterval(interval)
  }, [storeId, loadDeliveryTimes])

  const avg   = deliveryMins.length ? Math.round(deliveryMins.reduce((a, b) => a + b, 0) / deliveryMins.length) : null
  const best  = deliveryMins.length ? Math.min(...deliveryMins) : null
  const worst = deliveryMins.length ? Math.max(...deliveryMins) : null
  const bucketCounts = BUCKETS.map(b => deliveryMins.filter(m => m >= b.min && m < b.max).length)
  const bucketMax = Math.max(...bucketCounts, 1)

  const firstName = user?.email?.split('@')[0] ?? ''
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="dh-content">

      {/* ── HERO ── */}
      <section className="dh-hero">
        <div className="dh-greeting">
          <div className="dh-eyebrow">{today}</div>
          <h1 className="dh-headline">
            {t('dash.hello')} {firstName}.<br />
            {orderCount > 0
              ? <em>{t('dash.ordersToday', { n: String(orderCount) })}</em>
              : <em>{t('dash.startSelling')}</em>
            }
          </h1>

          <div className="dh-cta">
            {storeSlug && (
              <Link href={`/${storeSlug}`} target="_blank" className="dh-btn-secondary">{t('dash.viewPublicStore')}</Link>
            )}
            <button className="dh-btn-ghost" onClick={() => { if (storeSlug) navigator.clipboard.writeText(`https://lyte-app.com/${storeSlug}`) }}>
              {t('dash.shareLink')}
            </button>
          </div>
        </div>
      </section>

      {/* ── KPI STRIP ── */}
      <div className="dh-section-head">
        <div className="dh-section-title">{t('dash.summary')}</div>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
          {(['day', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: period === p ? 'white' : 'transparent',
                color: period === p ? '#0F172A' : '#64748B',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="dh-kpi-grid">
        <div className="dh-kpi dh-kpi-hero">
          <div className="dh-kpi-head">
            <span className="dh-kpi-label">{t('dash.kpi.sales')}</span>
            <span className="dh-kpi-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
          </div>
          <div className="dh-kpi-value">${Math.floor(totalSales)}<span className="dh-kpi-unit">.{String(Math.round((totalSales % 1) * 100)).padStart(2, '0')}</span></div>
          <svg className="dh-spark" viewBox="0 0 200 28" preserveAspectRatio="none">
            <path d="M0,24 L40,22 L80,20 L120,16 L160,12 L200,8" stroke="#7C3AED" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
            <path d="M0,24 L40,22 L80,20 L120,16 L160,12 L200,8 L200,28 L0,28 Z" fill="url(#sf)" opacity="0.12"/>
            <defs>
              <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7C3AED"/>
                <stop offset="1" stopColor="#7C3AED" stopOpacity="0"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="dh-kpi-foot">
            <span className="dh-delta-flat">{t('dash.kpi.noSales')}</span>
          </div>
        </div>

        <div className="dh-kpi">
          <div className="dh-kpi-head">
            <span className="dh-kpi-label">{t('nav.orders')}</span>
            <span className="dh-kpi-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
            </span>
          </div>
          <div className="dh-kpi-value">{orderCount}</div>
          <div className="dh-kpi-foot">
            <span className="dh-delta-flat">{t('dash.kpi.today')}</span>
          </div>
        </div>

        <div className="dh-kpi">
          <div className="dh-kpi-head">
            <span className="dh-kpi-label">Ticket promedio</span>
            <span className="dh-kpi-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h20M5 20V10l7-7 7 7v10"/><path d="M9 20v-5h6v5"/></svg>
            </span>
          </div>
          <div className="dh-kpi-value">${avgTicket.toFixed(2)}</div>
          <div className="dh-kpi-foot">
            <span className="dh-delta-flat">Hoy</span>
          </div>
        </div>

        <div className="dh-kpi">
          <div className="dh-kpi-head">
            <span className="dh-kpi-label">{t('dash.kpi.newCustomers')}</span>
            <span className="dh-kpi-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </span>
          </div>
          <div className="dh-kpi-value">0</div>
          <div className="dh-kpi-foot">
            <span className="dh-delta-flat">{t('dash.kpi.thisMonth')}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="dh-grid">

        {/* Delivery times summary */}
        <div className="dh-card dh-orders">
          <div className="dh-section-head" style={{ marginBottom: 20 }}>
            <div className="dh-section-title">Tiempos de entrega <span className="dh-meta">hoy</span></div>
            <Link href="/dashboard/analitics" className="dh-section-link">Ver detalle</Link>
          </div>

          {/* Big avg number */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 20 }}>
            <span style={{ fontSize: 64, fontWeight: 800, color: '#0F172A', letterSpacing: '-3px', lineHeight: 1 }}>
              {avg !== null ? avg : '—'}
            </span>
            {avg !== null && (
              <span style={{ fontSize: 22, fontWeight: 600, color: '#7C3AED', marginBottom: 6 }}>min</span>
            )}
            <span style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, marginLeft: 6 }}>
              promedio · {deliveryMins.length} {deliveryMins.length === 1 ? 'entrega' : 'entregas'}
            </span>
          </div>

          {/* Best / Worst */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Mejor</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#15803D', letterSpacing: '-0.5px' }}>
                {best !== null ? fmtMins(best) : '—'}
              </div>
            </div>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Peor</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#B91C1C', letterSpacing: '-0.5px' }}>
                {worst !== null ? fmtMins(worst) : '—'}
              </div>
            </div>
          </div>

          {/* Distribution */}
          {deliveryMins.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BUCKETS.map((b, i) => {
                const count = bucketCounts[i]
                const pct = Math.round((count / bucketMax) * 100)
                return (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 76, fontSize: 11, color: '#64748B', flexShrink: 0 }}>{b.label}</div>
                    <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#7C3AED', borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ width: 20, fontSize: 11, fontWeight: 600, color: '#475569', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                  </div>
                )
              })}
            </div>
          )}

          {deliveryMins.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>
              Sin entregas completadas hoy
            </div>
          )}
        </div>

      </div>

      {/* ── BOTTOM GRID ── */}
      <div className="dh-bottom-grid">
        {/* Top products */}
        <div className="dh-card" style={{ padding: '22px 24px' }}>
          <div className="dh-section-head" style={{ marginBottom: 6 }}>
            <div className="dh-section-title">{t('dash.topProducts')}</div>
            <Link href="/dashboard/productos" className="dh-section-link">{t('dash.viewAll')}</Link>
          </div>
          {productCount === 0 ? (
            <div className="dh-bottom-empty">
              <span>{t('dash.topEmpty')}</span>
              <Link href="/dashboard/productos">{t('dash.addArrow')}</Link>
            </div>
          ) : (
            <div className="dh-top-list">
              {[1,2,3].map(i => (
                <div key={i} className="dh-top-row">
                  <div className="dh-top-rank">0{i}</div>
                  <div>
                    <div className="dh-top-name">Producto {i}</div>
                    <div className="dh-top-bar"><div className="dh-top-fill" style={{ width: `${90 - i * 20}%` }} /></div>
                  </div>
                  <div className="dh-top-meta">—<span>{t('dash.sold')}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Store link card */}
        <div className="dh-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Tu tienda publica</div>

          {storeSlug ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span style={{ flex: 1, fontSize: 12, color: '#475569', fontFamily: 'var(--font-geist-mono), monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  lyte-app.com/{storeSlug}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(`https://lyte-app.com/${storeSlug}`)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94A3B8', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
              <Link
                href={`/${storeSlug}`}
                target="_blank"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#0F172A', color: 'white', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 8 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Ver tienda
              </Link>
              <Link
                href="/dashboard/canal/vitrina/editor"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Editar diseño
              </Link>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>{t('dash.setupFirst')}</div>
              <Link href="/dashboard/canal/vitrina" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: 'white', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                {t('dash.configure')}
              </Link>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
