import Image from 'next/image'
import Link from 'next/link'
import PricingToggle from './components/PricingToggle'
import './landing.css'

const CheckIcon = () => (
  <svg className="check" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
  </svg>
)

export default function Home() {
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
          <li><a href="#features">Funcionalidades</a></li>
          <li><a href="#how">Cómo funciona</a></li>
          <li><a href="#pricing">Precios</a></li>
          <li><a href="#testimonials">Historias</a></li>
          <li><Link href="/registro" className="cta-nav">Crear mi tienda →</Link></li>
        </ul>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-label">
          <span className="badge">Nuevo</span>
          Hecho para emprendedores LATAM 🌎
        </div>
        <h1>
          Tu negocio.<br />
          <span className="accent">Más liviano. Más rápido.</span>
        </h1>
        <p className="hero-subtitle">
          La plataforma todo-en-uno para vender, cobrar y entregar sin fricción. Más simple que Shopify. Más completa que un link de WhatsApp.
        </p>
        <div className="hero-cta">
          <Link href="/registro" className="btn-primary">Empezar gratis →</Link>
          <a href="#features" className="btn-secondary">Ver funcionalidades ▸</a>
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
        <div className="trust-label">Construido con tecnología de</div>
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
            <div className="stat-num">3<span className="unit">min</span></div>
            <div className="stat-desc">Tu tienda en línea</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">0<span className="unit">%</span></div>
            <div className="stat-desc">Comisión por venta</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">12<span className="unit">+</span></div>
            <div className="stat-desc">Métodos de pago locales</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">24<span className="serif-i">/7</span></div>
            <div className="stat-desc">Soporte en español</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="section-header">
          <span className="eyebrow">Todo lo que necesitas</span>
          <h2 className="section-title">Una plataforma. <span className="serif">Todo el negocio.</span></h2>
          <p className="section-subtitle">Catálogo, pedidos, cocina, repartidores, pagos y métricas. Cosido en una sola herramienta que un emprendedor puede configurar en una tarde.</p>
        </div>

        <div className="features-grid">

          {/* Doble moneda */}
          <div className="fcard span-8 violet">
            <div className="fc-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h4.5a2.5 2.5 0 010 5H9m0 0l6 5" />
              </svg>
            </div>
            <h3 className="fc-title">Doble moneda. Cero dolor de cabeza.</h3>
            <p className="fc-desc">Precios en bolívares y dólares al mismo tiempo, con tasa BCV actualizada automáticamente. El pedido guarda la tasa del momento — si mañana cambia, el pedido de ayer no.</p>
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
            <h3 className="fc-title">WhatsApp, donde ya están.</h3>
            <p className="fc-desc">Pedidos pre-formateados llegan a tu chat. Cliente sin cuenta, solo nombre y número.</p>
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
            <h3 className="fc-title">Cocina conectada. Sin papeles.</h3>
            <p className="fc-desc">El KDS vive en un tablet sin login, con columnas grandes y sonido. El pedido entra cuando se confirma el pago. El cocinero solo da clic.</p>
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
            <h3 className="fc-title">Tu repartidor. Tu control.</h3>
            <p className="fc-desc">App PWA para tus motorizados con GPS en vivo. Tú ves dónde están, tu cliente ve cuánto falta. Sin pagar comisiones a Yummy o PedidosYa.</p>
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

          {/* Verificación pagos */}
          <div className="fcard span-12 dark">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <div className="fc-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <h3 className="fc-title">Verificación de pagos. <span className="serif" style={{ color: 'var(--violet-soft)' }}>Sin tú revisar nada.</span></h3>
                <p className="fc-desc">El cliente sube la captura de Pago Móvil o Zelle, nuestro OCR extrae monto y referencia, hace match con el pedido y confirma. Si todo cuadra, va directo a cocina sin que tú toques nada.</p>
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

      {/* PAGOS VENEZUELA */}
      <section className="pagos-section" id="pagos">
        <div className="pagos-inner">
          <div className="section-header center">
            <span className="eyebrow">Pagos locales</span>
            <h2 className="section-title" style={{ color: 'white' }}>Cobra como vendes. <span className="serif" style={{ color: 'var(--violet-soft)' }}>En tu moneda.</span></h2>
            <p className="section-subtitle" style={{ color: 'rgba(255,255,255,0.65)' }}>Soportamos los métodos que tus clientes usan de verdad. Sin Stripe, sin tarjetas gringas, sin comisiones del 3% extra.</p>
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
            <span className="eyebrow">Cómo funciona</span>
            <h2 className="section-title">En tres pasos <span className="serif">estás vendiendo.</span></h2>
            <p className="section-subtitle">Sin desarrolladores, sin instalaciones, sin tarjeta de crédito. Solo tu negocio y un café al lado.</p>
          </div>
          <div className="steps">
            <div className="step">
              <span className="step-num">01</span>
              <h3 className="step-title">Crea tu tienda</h3>
              <p className="step-desc">Registro con email, eliges nombre, subes logo. Tu URL personalizada en menos de tres minutos. Sin RIF, sin papeleo.</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <h3 className="step-title">Configura productos y pagos</h3>
              <p className="step-desc">Agrega tu catálogo con fotos y variantes. Activa los métodos de pago que usas. Define zonas de delivery.</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <h3 className="step-title">Comparte y cobra</h3>
              <p className="step-desc">Comparte tu link en Instagram, WhatsApp, TikTok. Los pedidos llegan, los pagos se verifican, la cocina prepara, el motorizado entrega. Tú lees el dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" id="pricing">
        <div className="section-header center">
          <span className="eyebrow">Precios honestos</span>
          <h2 className="section-title">Empieza gratis. <span className="serif">Crece sin sorpresas.</span></h2>
          <p className="section-subtitle">Sin comisión por venta. Sin contratos anuales. Cancela cuando quieras.</p>
        </div>

        <PricingToggle />

        <div className="pricing-grid">
          <div className="price-card">
            <div className="price-name">Free</div>
            <div className="price-amount"><span className="usd">$</span>0</div>
            <div className="price-period">Para siempre. En serio.</div>
            <Link href="/registro" className="price-cta">Empezar gratis</Link>
            <ul className="price-features">
              <li><CheckIcon /> Hasta 50 pedidos al mes</li>
              <li><CheckIcon /> 1 repartidor activo</li>
              <li><CheckIcon /> Pagos locales (Pago Móvil, Zelle, USDT)</li>
              <li><CheckIcon /> Subdominio mitienda.lyte-app.com</li>
              <li><CheckIcon /> Sin comisión por venta</li>
            </ul>
          </div>

          <div className="price-card featured">
            <span className="price-tag">Más popular</span>
            <div className="price-name">Pro</div>
            <div className="price-amount"><span className="usd">$</span>15</div>
            <div className="price-period">USD / mes · facturación anual</div>
            <Link href="/registro" className="price-cta">Probar 14 días</Link>
            <ul className="price-features">
              <li><CheckIcon /> Pedidos ilimitados</li>
              <li><CheckIcon /> Hasta 5 repartidores con GPS</li>
              <li><CheckIcon /> KDS (pantalla de cocina)</li>
              <li><CheckIcon /> Dominio propio</li>
              <li><CheckIcon /> Reportes avanzados + exportable</li>
              <li><CheckIcon /> Sin marca Lyteapp</li>
            </ul>
          </div>

          <div className="price-card">
            <div className="price-name">Premium</div>
            <div className="price-amount"><span className="usd">$</span>35</div>
            <div className="price-period">USD / mes · facturación anual</div>
            <Link href="/registro" className="price-cta">Hablar con ventas</Link>
            <ul className="price-features">
              <li><CheckIcon /> Todo del plan Pro</li>
              <li><CheckIcon /> Verificación auto Pago Móvil (SMS)</li>
              <li><CheckIcon /> Zelle vía Gmail OAuth</li>
              <li><CheckIcon /> WhatsApp Business API</li>
              <li><CheckIcon /> Repartidores ilimitados</li>
              <li><CheckIcon /> Soporte prioritario en español</li>
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials" id="testimonials">
        <div className="section-header center">
          <span className="eyebrow">Historias reales</span>
          <h2 className="section-title">Negocios que ya <span className="serif">se hicieron livianos.</span></h2>
        </div>
        <div className="test-grid">
          <div className="test-card">
            <p className="test-quote">&ldquo;Pasé de revisar capturas de Pago Móvil a las 11 PM a no tocar mi teléfono. La verificación automática me devolvió las noches.&rdquo;</p>
            <div className="test-author">
              <div className="test-avatar">MF</div>
              <div className="test-info"><h4>María Fernanda Rojas</h4><p>Dulcería Mafer · Valencia, VE</p></div>
            </div>
          </div>
          <div className="test-card">
            <p className="test-quote">&ldquo;Mostrar precios en bolívares y dólares al mismo tiempo cambió todo. Mis clientes en Miami me pagan por Zelle y no tengo que calcular nada manual.&rdquo;</p>
            <div className="test-author">
              <div className="test-avatar">JR</div>
              <div className="test-info"><h4>Jesús Ramírez</h4><p>Streetwear JR · Caracas, VE</p></div>
            </div>
          </div>
          <div className="test-card">
            <p className="test-quote">&ldquo;Empecé en el plan free, llegué a 50 pedidos en dos semanas, me pasé a Pro sin pensarlo. El KDS solo ya vale los $15.&rdquo;</p>
            <div className="test-author">
              <div className="test-avatar">AG</div>
              <div className="test-info"><h4>Andrea Guerra</h4><p>Bowls de Andrea · Mérida, VE</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="comparison">
        <div className="section-header">
          <span className="eyebrow">Por qué Lyteapp</span>
          <h2 className="section-title">Más liviano que la competencia. <span className="serif">Punto.</span></h2>
        </div>
        <div className="compare-grid">
          <div className="compare-card others">
            <h3 className="compare-title">Otras plataformas</h3>
            <ul className="compare-list">
              <li><span className="icon">✕</span> Comisión del 20-30% por venta</li>
              <li><span className="icon">✕</span> No aceptan Pago Móvil ni Zelle</li>
              <li><span className="icon">✕</span> Te exigen RIF y registro fiscal</li>
              <li><span className="icon">✕</span> Cocina y delivery son addons que pagas aparte</li>
              <li><span className="icon">✕</span> Soporte en inglés o portugués</li>
              <li><span className="icon">✕</span> Diseño plantilla, idéntico a otras tiendas</li>
            </ul>
          </div>
          <div className="compare-card us">
            <h3 className="compare-title"><span style={{ color: 'var(--violet-soft)' }}>Lyteapp</span></h3>
            <ul className="compare-list">
              <li><span className="icon">✓</span> 0% comisión por venta. Para siempre.</li>
              <li><span className="icon">✓</span> 12+ métodos de pago locales con verificación auto</li>
              <li><span className="icon">✓</span> Empiezas hoy sin RIF, como vendes ya</li>
              <li><span className="icon">✓</span> Catálogo, cocina, repartidores y pagos en uno</li>
              <li><span className="icon">✓</span> Soporte 100% en español, con paisanos</li>
              <li><span className="icon">✓</span> Diseño moderno, tu marca al frente</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Tu negocio merece <span className="em">crecer ligero.</span></h2>
          <p className="cta-sub">Crea tu tienda en Lyteapp gratis. Sin tarjeta de crédito. Sin letra pequeña. Tres minutos y estás vendiendo.</p>
          <Link href="/registro" className="btn-primary" style={{ padding: '20px 44px', fontSize: '16px' }}>
            Crear mi tienda ahora →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <h3>Lyte<span className="app">app</span></h3>
              <p>Your business. Lighter. Faster. La plataforma todo-en-uno hecha para emprendedores latinoamericanos.</p>
            </div>
            <div className="footer-col">
              <h4>Producto</h4>
              <ul>
                <li><a href="#features">Funcionalidades</a></li>
                <li><a href="#pricing">Precios</a></li>
                <li><a href="#how">Cómo funciona</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Recursos</h4>
              <ul>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Guías</a></li>
                <li><a href="#">Centro de ayuda</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Empresa</h4>
              <ul>
                <li><a href="#">Sobre nosotros</a></li>
                <li><a href="#">Contacto</a></li>
                <li><a href="#">Términos</a></li>
                <li><a href="#">Privacidad</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div>© 2026 Lyteapp. Hecho con cuidado para LATAM.</div>
            <div>hola@lyte-app.com</div>
          </div>
        </div>
      </footer>
    </>
  )
}
