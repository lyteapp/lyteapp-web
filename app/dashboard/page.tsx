'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/LocaleProvider'
import './home.css'

type ActiveOrder = {
  id: string
  customer_name: string
  status: string
  created_at: string
  total: number
}

const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'ready']
const STATUS_LABEL: Record<string, string> = {
  pending: 'Por confirmar', confirmed: 'Confirmado', processing: 'En proceso', ready: 'Listo',
}

function elapsed(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora'
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
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [, setTick] = useState(0)

  const loadActiveOrders = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, customer_name, status, created_at, total')
      .eq('store_id', sid)
      .not('status', 'in', '(delivered,cancelled,completed)')
      .order('created_at', { ascending: true })
    setActiveOrders((data ?? []) as ActiveOrder[])
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
      supabase.from('products').select('id', { count: 'exact' }).eq('store_id', data.id).then(({ count }) => setProductCount(count ?? 0))
      loadActiveOrders(data.id)
    })
  }, [user, loadStats, loadActiveOrders])

  useEffect(() => {
    if (!storeId) return
    loadStats(storeId, period)
  }, [storeId, period, loadStats])

  // Refresh active orders every 30s and re-render elapsed times every minute
  useEffect(() => {
    if (!storeId) return
    const orderInterval = setInterval(() => loadActiveOrders(storeId), 30000)
    const tickInterval  = setInterval(() => setTick(t => t + 1), 60000)
    return () => { clearInterval(orderInterval); clearInterval(tickInterval) }
  }, [storeId, loadActiveOrders])

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
            <Link href="/dashboard/productos" className="dh-btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t('dash.addProduct')}
            </Link>
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

        {/* Orders live */}
        <div className="dh-card dh-orders">
          <div className="dh-section-head" style={{ marginBottom: 18 }}>
            <div className="dh-section-title">{t('dash.liveOrders')} <span className="dh-meta">{t('dash.realtime')}</span></div>
            <Link href="/dashboard/pedidos" className="dh-section-link">{t('dash.openOrders')}</Link>
          </div>

          <div className="dh-pipeline">
            {STATUS_ORDER.map((st, i) => {
              const count = activeOrders.filter(o => o.status === st).length
              return (
                <div key={st} className="dh-pipe-stage">
                  <div className="dh-pipe-count">{count}</div>
                  <div className="dh-pipe-label">{STATUS_LABEL[st]}</div>
                  {i < STATUS_ORDER.length - 1 && <svg className="dh-pipe-arrow" width="8" height="12" viewBox="0 0 8 12" fill="currentColor"><path d="M0 0 L8 6 L0 12 Z"/></svg>}
                </div>
              )
            })}
          </div>

          {activeOrders.length === 0 ? (
            <div className="dh-order-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <p>{t('dash.noOrders')}</p>
              {storeSlug && <Link href={`/${storeSlug}`} target="_blank">{t('dash.viewStore')}</Link>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {activeOrders.map(order => {
                const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                const isUrgent = mins >= 20
                return (
                  <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: isUrgent ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${isUrgent ? '#FECACA' : '#E2E8F0'}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.customer_name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{STATUS_LABEL[order.status] ?? order.status}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isUrgent ? '#DC2626' : '#475569' }}>{elapsed(order.created_at)}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>${Number(order.total).toFixed(2)}</div>
                    </div>
                  </div>
                )
              })}
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
        <div className="dh-card dh-link-card">
          <div className="dh-link-icon">🔗</div>
          <div className="dh-link-title">{t('dash.publicStore')}</div>
          {storeSlug ? (
            <>
              <div className="dh-link-url">lyte-app.com/{storeSlug}</div>
              <Link href={`/${storeSlug}`} target="_blank" className="dh-link-btn">{t('dash.openStore')}</Link>
              <button className="dh-link-copy" onClick={() => navigator.clipboard.writeText(`https://lyte-app.com/${storeSlug}`)}>
                {t('dash.copyLink')}
              </button>
            </>
          ) : (
            <>
              <div className="dh-link-url" style={{ color: '#94A3B8' }}>{t('dash.setupFirst')}</div>
              <Link href="/dashboard/canal/vitrina" className="dh-link-btn">{t('dash.configure')}</Link>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
