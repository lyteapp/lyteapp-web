'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/LocaleProvider'
import './home.css'

export default function Dashboard() {
  const { user } = useAuth()
  const t = useT()
  const [storeSlug, setStoreSlug] = useState('')
  const [orderCount, setOrderCount] = useState(0)
  const [productCount, setProductCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id,name,slug').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setStoreSlug(data.slug ?? '')
      supabase.from('orders').select('id', { count: 'exact' }).eq('store_id', data.id).then(({ count }) => setOrderCount(count ?? 0))
      supabase.from('products').select('id', { count: 'exact' }).eq('store_id', data.id).then(({ count }) => setProductCount(count ?? 0))
    })
  }, [user])

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
          <p className="dh-sub">
            {orderCount > 0 ? t('dash.subWithOrders') : t('dash.subNoOrders')}
          </p>
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
        <Link href="/dashboard/pedidos" className="dh-section-link">{t('dash.viewDetail')}</Link>
      </div>

      <div className="dh-kpi-grid">
        <div className="dh-kpi dh-kpi-hero">
          <div className="dh-kpi-head">
            <span className="dh-kpi-label">{t('dash.kpi.sales')}</span>
            <span className="dh-kpi-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
          </div>
          <div className="dh-kpi-value">$0<span className="dh-kpi-unit">.00</span></div>
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
            <span className="dh-kpi-label">{t('nav.products')}</span>
            <span className="dh-kpi-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </span>
          </div>
          <div className="dh-kpi-value">{productCount}</div>
          <div className="dh-kpi-foot">
            <Link href="/dashboard/productos" className="dh-kpi-link">{t('dash.kpi.addLink')}</Link>
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
            {([
              'dash.pipe.toConfirm',
              'dash.pipe.confirmed',
              'dash.pipe.ready',
              'dash.pipe.onWay',
              'dash.pipe.delivered',
            ] as const).map((key, i) => (
              <div key={i} className="dh-pipe-stage">
                <div className="dh-pipe-count">0</div>
                <div className="dh-pipe-label">{t(key)}</div>
                {i < 4 && <svg className="dh-pipe-arrow" width="8" height="12" viewBox="0 0 8 12" fill="currentColor"><path d="M0 0 L8 6 L0 12 Z"/></svg>}
              </div>
            ))}
          </div>

          <div className="dh-order-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p>{t('dash.noOrders')}</p>
            {storeSlug && <Link href={`/${storeSlug}`} target="_blank">{t('dash.viewStore')}</Link>}
          </div>
        </div>

        {/* Side column */}
        <div className="dh-side-col">
          {/* Quick actions */}
          <div className="dh-card" style={{ padding: '20px' }}>
            <div className="dh-section-title" style={{ marginBottom: 14 }}>{t('dash.quickActions')}</div>
            <div className="dh-quick-actions">
              <Link href="/dashboard/productos" className="dh-quick-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {t('dash.newProduct')}
              </Link>
              <Link href="/dashboard/canal/vitrina" className="dh-quick-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {t('dash.editStorefront')}
              </Link>
              <Link href="/dashboard/canal/apariencia" className="dh-quick-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                {t('nav.apariencia')}
              </Link>
              <Link href="/dashboard/configuracion" className="dh-quick-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                {t('dash.step.configPayments')}
              </Link>
            </div>
          </div>
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
