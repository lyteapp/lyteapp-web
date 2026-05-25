'use client'

import Image from 'next/image'
import Link from 'next/link'
import PricingToggle from './components/PricingToggle'
import NavMobile from './components/NavMobile'
import { useT } from './lib/LocaleProvider'
import './landing.css'

const CheckIcon = () => (
  <svg className="check" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
  </svg>
)

export default function Home() {
  const t = useT()

  return (
    <>
      {/* NAV */}
      <nav>
        <Link href="/" className="logo">
          <span className="logo-mark">
            <Image src="/logo.png" alt="LyteApp" width={28} height={28} style={{ objectFit: 'contain' }} />
          </span>
          <span className="logo-text">
            <span className="lyte">Lyte</span><span className="app">app</span>
          </span>
        </Link>
        <ul className="nav-links">
          <li><a href="#features">{t('landing.nav.features')}</a></li>
          <li><a href="#how">{t('landing.nav.how')}</a></li>
          <li><a href="#pricing">{t('landing.nav.pricing')}</a></li>
          <li><a href="#testimonials">{t('landing.nav.stories')}</a></li>
          <li><Link href="/login" className="cta-nav">{t('landing.nav.login')}</Link></li>
        </ul>
        <NavMobile />
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-label">
          <span className="badge">{t('landing.hero.badge')}</span>
          {t('landing.hero.label')}
        </div>
        <h1>
          {t('landing.hero.title1')}<br />
          <span className="accent">{t('landing.hero.title2')}</span>
        </h1>
        <p className="hero-subtitle">{t('landing.hero.sub')}</p>
        <div className="hero-cta">
          <Link href="/registro" className="btn-primary">{t('landing.hero.cta1')}</Link>
          <a href="#features" className="btn-secondary">{t('landing.hero.cta2')}</a>
        </div>

        <div className="hero-visual">
          <div className="hero-mockup">
            <div className="hero-mockup-bar">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="hero-mockup-content">
              <div className="mock-sidebar">
                <div className="mock-side-item active"><span className="mock-side-icon" /> Dashboard</div>
                <div className="mock-side-item"><span className="mock-side-icon" /> Pedidos</div>
                <div className="mock-side-item"><span className="mock-side-icon" /> Catálogo</div>
                <div className="mock-side-item"><span className="mock-side-icon" /> Clientes</div>
                <div className="mock-side-item"><span className="mock-side-icon" /> Pagos</div>
                <div className="mock-side-item"><span className="mock-side-icon" /> Repartidores</div>
              </div>
              <div className="mock-main">
                <div className="mock-stats">
                  <div className="mock-stat">
                    <div className="mock-stat-label">Hoy</div>
                    <div className="mock-stat-value">$1,284 <span className="delta">+12%</span></div>
                  </div>
                  <div className="mock-stat">
                    <div className="mock-stat-label">Pedidos</div>
                    <div className="mock-stat-value">42 <span className="delta">+8</span></div>
                  </div>
                  <div className="mock-stat">
                    <div className="mock-stat-label">Tasa BCV</div>
                    <div className="mock-stat-value">38.42</div>
                  </div>
                </div>
                <div className="mock-orders">
                  <div className="mock-orders-title">Pedidos recientes</div>
                  <div className="mock-order-row">
                    <span className="mock-order-num">#1247</span>
                    <span>María González</span>
                    <span className="mock-order-tag">Entregado</span>
                    <span className="mock-order-amt">$24.50</span>
                  </div>
                  <div className="mock-order-row">
                    <span className="mock-order-num">#1246</span>
                    <span>Carlos Pérez</span>
                    <span className="mock-order-tag cooking">En cocina</span>
                    <span className="mock-order-amt">$18.00</span>
                  </div>
                  <div className="mock-order-row">
                    <span className="mock-order-num">#1245</span>
                    <span>Ana Rodríguez</span>
                    <span className="mock-order-tag pending">Verificando</span>
                    <span className="mock-order-amt">$32.75</span>
                  </div>
                  <div className="mock-order-row">
                    <span className="mock-order-num">#1244</span>
                    <span>Luis Hernández</span>
                    <span className="mock-order-tag">Entregado</span>
                    <span className="mock-order-amt">$12.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="float-card payment">
            <div className="pay-icon">$</div>
            <div className="pay-text">
              <strong>Pago verificado</strong>
              <span>Pago Móvil · Banesco · $24.50</span>
            </div>
          </div>

          <div className="float-card notif">
            <div className="notif-dot" />
            <div className="notif-text">
              <strong>Nuevo pedido</strong>
              <span>Listo en cocina · 8 min</span>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="trust">
        <div className="trust-label">{t('landing.trust.label')}</div>
        <div className="trust-logos">
          <span>STRIPE</span>
          <span className="lux">Supabase</span>
          <span>VERCEL</span>
          <span className="lux">Twilio</span>
          <span>OpenAI</span>
        </div>
      </section>

      {/* STATS */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-block">
            <div className="stat-num">{t('landing.stats.0.num')}<span className="unit">{t('landing.stats.0.unit')}</span></div>
            <div className="stat-desc">{t('landing.stats.0.desc')}</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">{t('landing.stats.1.num')}<span className="unit">{t('landing.stats.1.unit')}</span></div>
            <div className="stat-desc">{t('landing.stats.1.desc')}</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">{t('landing.stats.2.num')}<span className="unit">{t('landing.stats.2.unit')}</span></div>
            <div className="stat-desc">{t('landing.stats.2.desc')}</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">{t('landing.stats.3.num')}<span className="serif-i">{t('landing.stats.3.unit')}</span></div>
            <div className="stat-desc">{t('landing.stats.3.desc')}</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="section-header">
          <span className="eyebrow">{t('landing.features.eyebrow')}</span>
          <h2 className="section-title">{t('landing.features.title')} <span className="serif">{t('landing.features.titleAccent')}</span></h2>
          <p className="section-subtitle">{t('landing.features.sub')}</p>
        </div>

        <div className="features-grid">

          {/* Dual currency */}
          <div className="fcard span-8 violet">
            <div className="fc-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h4.5a2.5 2.5 0 010 5H9m0 0l6 5" />
              </svg>
            </div>
            <h3 className="fc-title">{t('landing.features.currency.title')}</h3>
            <p className="fc-desc">{t('landing.features.currency.desc')}</p>
            <div className="fc-visual">
              <div className="currency-mock">
                <div className="currency-row">
                  <span className="currency-label">Hamburguesa Clásica</span>
                  <span className="currency-val">$8.50 <span className="small">· Bs 326.57</span></span>
                </div>
                <div className="currency-row">
                  <span className="currency-label">Tequeños (12u)</span>
                  <span className="currency-val">$6.00 <span className="small">· Bs 230.52</span></span>
                </div>
                <div className="currency-row">
                  <span className="currency-label">Tasa BCV de hoy</span>
                  <span className="currency-val violet">38.42 ↑</span>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="fcard span-4">
            <div className="fc-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 6.5 2 12c0 1.7.4 3.3 1.2 4.7L2 22l5.4-1.2C8.8 21.6 10.4 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm5 14.3c-.2.6-1.2 1.1-1.7 1.2-.4 0-1 .1-1.5-.1-.4-.1-.9-.3-1.6-.6-2.7-1.2-4.5-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9 1-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.7.8 1.9.1.1.1.3 0 .5l-.3.4-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.5 1.5.3.1.5.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.3z" />
              </svg>
            </div>
            <h3 className="fc-title">{t('landing.features.wa.title')}</h3>
            <p className="fc-desc">{t('landing.features.wa.desc')}</p>
            <div className="fc-visual">
              <div className="wa-mock">
                <div className="wa-bubble">
                  <strong>Pedido #1247</strong>
                  2× Hamburguesa Clásica<br />
                  1× Coca-Cola 350ml<br />
                  <em>Total: $20.50 · Bs 787.61</em>
                  <div className="wa-meta">19:42 ✓✓</div>
                </div>
              </div>
            </div>
          </div>

          {/* KDS */}
          <div className="fcard span-6 dark">
            <div className="fc-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="14" rx="2" /><path d="M3 10h18M9 17v4M15 17v4M7 21h10" />
              </svg>
            </div>
            <h3 className="fc-title">{t('landing.features.kds.title')}</h3>
            <p className="fc-desc">{t('landing.features.kds.desc')}</p>
            <div className="fc-visual">
              <div className="kds-mock">
                <div className="kds-col">
                  <div className="kds-col-title">Nuevos</div>
                  <div className="kds-card"><div className="kds-num">#048</div><div className="kds-time">2:14</div></div>
                  <div className="kds-card"><div className="kds-num">#049</div><div className="kds-time">0:42</div></div>
                </div>
                <div className="kds-col">
                  <div className="kds-col-title">En cocina</div>
                  <div className="kds-card warn"><div className="kds-num">#046</div><div className="kds-time">8:33</div></div>
                  <div className="kds-card urgent"><div className="kds-num">#045</div><div className="kds-time">14:21</div></div>
                </div>
                <div className="kds-col">
                  <div className="kds-col-title">Listos</div>
                  <div className="kds-card"><div className="kds-num">#044</div><div className="kds-time">listo</div></div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery GPS */}
          <div className="fcard span-6">
            <div className="fc-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 className="fc-title">{t('landing.features.delivery.title')}</h3>
            <p className="fc-desc">{t('landing.features.delivery.desc')}</p>
            <div className="fc-visual">
              <div className="gps-mock">
                <svg className="gps-route" viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="route" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <path d="M 30 110 Q 100 60, 180 80 T 370 30" stroke="url(#route)" strokeWidth="3" fill="none" strokeDasharray="6 6" strokeLinecap="round" />
                  <circle cx="30" cy="110" r="6" fill="white" />
                  <circle cx="370" cy="30" r="8" fill="#7C3AED" stroke="white" strokeWidth="3" />
                </svg>
                <div className="gps-pin" style={{ top: '50%', left: '50%' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L4 9l1 11h14l1-11z" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Payment verification */}
          <div className="fcard span-12 dark">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <div className="fc-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <h3 className="fc-title">{t('landing.features.ocr.title')} <span className="serif" style={{ color: 'var(--violet-soft)' }}>{t('landing.features.ocr.titleAccent')}</span></h3>
                <p className="fc-desc">{t('landing.features.ocr.desc')}</p>
              </div>
              <div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 12px #22c55e' }} />
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>VERIFICANDO PAGO MÓVIL...</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', lineHeight: '1.8', color: 'rgba(255,255,255,0.85)' }}>
                    <div>→ Captura recibida</div>
                    <div>→ OCR: <span style={{ color: 'var(--violet-soft)' }}>Bs 945.20</span></div>
                    <div>→ Ref: <span style={{ color: 'var(--violet-soft)' }}>001234567</span></div>
                    <div>→ Banco: <span style={{ color: 'var(--violet-soft)' }}>Banesco</span></div>
                    <div style={{ color: '#22c55e', marginTop: '8px' }}>✓ MATCH · Pedido #1247</div>
                    <div style={{ color: '#22c55e' }}>✓ Enviado a cocina</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* PAGOS */}
      <section className="pagos-section" id="pagos">
        <div className="pagos-inner">
          <div className="section-header center">
            <span className="eyebrow">{t('landing.pagos.eyebrow')}</span>
            <h2 className="section-title" style={{ color: 'white' }}>{t('landing.pagos.title')} <span className="serif" style={{ color: 'var(--violet-soft)' }}>{t('landing.pagos.titleAccent')}</span></h2>
            <p className="section-subtitle" style={{ color: 'rgba(255,255,255,0.65)' }}>{t('landing.pagos.sub')}</p>
          </div>
          <div className="pagos-grid">
            {[
              { icon: 'PM', name: 'Pago Móvil', sub: 'Verificación auto' },
              { icon: 'Z', name: 'Zelle', sub: 'USD instant' },
              { icon: '₿', name: 'Binance Pay', sub: 'API oficial' },
              { icon: '₮', name: 'USDT', sub: 'TRC20 / BEP20' },
              { icon: '$', name: 'Efectivo USD', sub: 'Confirmación al entregar' },
              { icon: 'B', name: 'Transferencia Bs', sub: 'OCR comprobante' },
              { icon: 'MP', name: 'Mercado Pago', sub: 'LATAM' },
              { icon: 'PX', name: 'PIX', sub: 'Brasil' },
            ].map((p) => (
              <div key={p.name} className="pago-chip">
                <div className="pago-icon">{p.icon}</div>
                <div className="pago-info"><strong>{p.name}</strong><span>{p.sub}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <div className="how-inner">
          <div className="section-header">
            <span className="eyebrow">{t('landing.how.eyebrow')}</span>
            <h2 className="section-title">{t('landing.how.title')} <span className="serif">{t('landing.how.titleAccent')}</span></h2>
            <p className="section-subtitle">{t('landing.how.sub')}</p>
          </div>
          <div className="steps">
            <div className="step">
              <span className="step-num">01</span>
              <h3 className="step-title">{t('landing.how.step1.title')}</h3>
              <p className="step-desc">{t('landing.how.step1.desc')}</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <h3 className="step-title">{t('landing.how.step2.title')}</h3>
              <p className="step-desc">{t('landing.how.step2.desc')}</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <h3 className="step-title">{t('landing.how.step3.title')}</h3>
              <p className="step-desc">{t('landing.how.step3.desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" id="pricing">
        <div className="section-header center">
          <span className="eyebrow">{t('landing.pricing.eyebrow')}</span>
          <h2 className="section-title">{t('landing.pricing.title')} <span className="serif">{t('landing.pricing.titleAccent')}</span></h2>
          <p className="section-subtitle">{t('landing.pricing.sub')}</p>
        </div>

        <PricingToggle />

        <div className="pricing-grid">
          <div className="price-card">
            <div className="price-name">{t('landing.pricing.free.name')}</div>
            <div className="price-amount"><span className="usd">$</span>0</div>
            <div className="price-period">{t('landing.pricing.free.period')}</div>
            <Link href="/registro" className="price-cta">{t('landing.pricing.free.cta')}</Link>
            <ul className="price-features">
              <li><CheckIcon /> {t('landing.pricing.free.f1')}</li>
              <li><CheckIcon /> {t('landing.pricing.free.f2')}</li>
              <li><CheckIcon /> {t('landing.pricing.free.f3')}</li>
              <li><CheckIcon /> {t('landing.pricing.free.f4')}</li>
              <li><CheckIcon /> {t('landing.pricing.free.f5')}</li>
            </ul>
          </div>

          <div className="price-card featured">
            <span className="price-tag">{t('landing.pricing.pro.tag')}</span>
            <div className="price-name">{t('landing.pricing.pro.name')}</div>
            <div className="price-amount"><span className="usd">$</span>15</div>
            <div className="price-period">{t('landing.pricing.pro.period')}</div>
            <Link href="/registro" className="price-cta">{t('landing.pricing.pro.cta')}</Link>
            <ul className="price-features">
              <li><CheckIcon /> {t('landing.pricing.pro.f1')}</li>
              <li><CheckIcon /> {t('landing.pricing.pro.f2')}</li>
              <li><CheckIcon /> {t('landing.pricing.pro.f3')}</li>
              <li><CheckIcon /> {t('landing.pricing.pro.f4')}</li>
              <li><CheckIcon /> {t('landing.pricing.pro.f5')}</li>
              <li><CheckIcon /> {t('landing.pricing.pro.f6')}</li>
            </ul>
          </div>

          <div className="price-card">
            <div className="price-name">{t('landing.pricing.premium.name')}</div>
            <div className="price-amount"><span className="usd">$</span>35</div>
            <div className="price-period">{t('landing.pricing.premium.period')}</div>
            <Link href="/registro" className="price-cta">{t('landing.pricing.premium.cta')}</Link>
            <ul className="price-features">
              <li><CheckIcon /> {t('landing.pricing.premium.f1')}</li>
              <li><CheckIcon /> {t('landing.pricing.premium.f2')}</li>
              <li><CheckIcon /> {t('landing.pricing.premium.f3')}</li>
              <li><CheckIcon /> {t('landing.pricing.premium.f4')}</li>
              <li><CheckIcon /> {t('landing.pricing.premium.f5')}</li>
              <li><CheckIcon /> {t('landing.pricing.premium.f6')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials" id="testimonials">
        <div className="section-header center">
          <span className="eyebrow">{t('landing.test.eyebrow')}</span>
          <h2 className="section-title">{t('landing.test.title')} <span className="serif">{t('landing.test.titleAccent')}</span></h2>
        </div>
        <div className="test-grid">
          <div className="test-card">
            <p className="test-quote">{t('landing.test.0.quote')}</p>
            <div className="test-author">
              <div className="test-avatar">MF</div>
              <div className="test-info"><h4>{t('landing.test.0.name')}</h4><p>{t('landing.test.0.biz')}</p></div>
            </div>
          </div>
          <div className="test-card">
            <p className="test-quote">{t('landing.test.1.quote')}</p>
            <div className="test-author">
              <div className="test-avatar">JR</div>
              <div className="test-info"><h4>{t('landing.test.1.name')}</h4><p>{t('landing.test.1.biz')}</p></div>
            </div>
          </div>
          <div className="test-card">
            <p className="test-quote">{t('landing.test.2.quote')}</p>
            <div className="test-author">
              <div className="test-avatar">AG</div>
              <div className="test-info"><h4>{t('landing.test.2.name')}</h4><p>{t('landing.test.2.biz')}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="comparison">
        <div className="section-header">
          <span className="eyebrow">{t('landing.compare.eyebrow')}</span>
          <h2 className="section-title">{t('landing.compare.title')} <span className="serif">{t('landing.compare.titleAccent')}</span></h2>
        </div>
        <div className="compare-grid">
          <div className="compare-card others">
            <h3 className="compare-title">{t('landing.compare.others.title')}</h3>
            <ul className="compare-list">
              <li><span className="icon">✕</span> {t('landing.compare.others.0')}</li>
              <li><span className="icon">✕</span> {t('landing.compare.others.1')}</li>
              <li><span className="icon">✕</span> {t('landing.compare.others.2')}</li>
              <li><span className="icon">✕</span> {t('landing.compare.others.3')}</li>
              <li><span className="icon">✕</span> {t('landing.compare.others.4')}</li>
              <li><span className="icon">✕</span> {t('landing.compare.others.5')}</li>
            </ul>
          </div>
          <div className="compare-card us">
            <h3 className="compare-title"><span style={{ color: 'var(--violet-soft)' }}>Lyteapp</span></h3>
            <ul className="compare-list">
              <li><span className="icon">✓</span> {t('landing.compare.us.0')}</li>
              <li><span className="icon">✓</span> {t('landing.compare.us.1')}</li>
              <li><span className="icon">✓</span> {t('landing.compare.us.2')}</li>
              <li><span className="icon">✓</span> {t('landing.compare.us.3')}</li>
              <li><span className="icon">✓</span> {t('landing.compare.us.4')}</li>
              <li><span className="icon">✓</span> {t('landing.compare.us.5')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">{t('landing.cta.title')} <span className="em">{t('landing.cta.titleAccent')}</span></h2>
          <p className="cta-sub">{t('landing.cta.sub')}</p>
          <Link href="/registro" className="btn-primary" style={{ padding: '20px 44px', fontSize: '16px' }}>
            {t('landing.cta.btn')}
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <h3>Lyte<span className="app">app</span></h3>
              <p>{t('landing.footer.tagline')}</p>
            </div>
            <div className="footer-col">
              <h4>{t('landing.footer.product')}</h4>
              <ul>
                <li><a href="#features">{t('landing.footer.features')}</a></li>
                <li><a href="#pricing">{t('landing.footer.pricing')}</a></li>
                <li><a href="#how">{t('landing.footer.how')}</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>{t('landing.footer.resources')}</h4>
              <ul>
                <li><a href="#">{t('landing.footer.blog')}</a></li>
                <li><a href="#">{t('landing.footer.guides')}</a></li>
                <li><a href="#">{t('landing.footer.help')}</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>{t('landing.footer.company')}</h4>
              <ul>
                <li><a href="#">{t('landing.footer.about')}</a></li>
                <li><a href="#">{t('landing.footer.contact')}</a></li>
                <li><a href="#">{t('landing.footer.terms')}</a></li>
                <li><a href="#">{t('landing.footer.privacy')}</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div>{t('landing.footer.copy')}</div>
            <div>hola@lyte-app.com</div>
          </div>
        </div>
      </footer>
    </>
  )
}
