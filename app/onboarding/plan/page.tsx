'use client'

import { useRouter } from 'next/navigation'

const STEPS = 6

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'Para siempre. En serio.',
    features: ['Hasta 30 productos', 'Hasta 50 pedidos / mes', 'Pagos locales incluidos', 'Tu tienda en lyte-app.com'],
    cta: 'Empezar gratis →',
    featured: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: 'USD / mes',
    tag: 'Más popular',
    features: ['Productos ilimitados', 'Hasta 500 pedidos / mes', 'Dominio propio', 'Soporte por WhatsApp'],
    cta: 'Próximamente',
    featured: true,
    disabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: 'USD / mes',
    features: ['Todo de Starter', 'Analytics avanzados', 'Sin marca Lyteapp', 'KDS pantalla de cocina'],
    cta: 'Próximamente',
    featured: false,
    disabled: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$49',
    period: 'USD / mes',
    features: ['Todo de Pro', 'Verificación auto de pagos', 'WhatsApp Business API', 'Soporte prioritario 24/7'],
    cta: 'Próximamente',
    featured: false,
    disabled: true,
  },
]

export default function PlanPage() {
  const router = useRouter()

  function selectPlan(planId: string) {
    localStorage.setItem('ob_plan', planId)
    router.push('/onboarding/tienda')
  }

  return (
    <div className="ob-screen">
      <div className="ob-brand">Lyte<span>app</span></div>

      <div className="ob-progress">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className={`ob-dot ${i === 1 ? 'active' : i < 1 ? 'done' : ''}`} />
        ))}
      </div>

      <div className="ob-card" style={{ maxWidth: 680 }}>
        <div className="ob-step-label">Paso 2 de {STEPS}</div>
        <h1 className="ob-title">Bienvenido a Lyteapp.</h1>
        <p className="ob-sub">
          Aquí tu negocio vende, cobra y crece sin fricción. Elige el plan que va contigo — empieza gratis y sube cuando estés listo. Sin contratos, sin sorpresas.
        </p>

        <div className="ob-plans">
          {PLANS.map(plan => (
            <div key={plan.id} className={`ob-plan${plan.featured ? ' featured' : ''}`}>
              {plan.tag && <span className="ob-plan-tag">{plan.tag}</span>}
              <div className="ob-plan-name">{plan.name}</div>
              <div className="ob-plan-price">{plan.price}</div>
              <div className="ob-plan-period">{plan.period}</div>
              <div className="ob-plan-features">
                {plan.features.map(f => (
                  <div key={f} className="ob-plan-feature">{f}</div>
                ))}
              </div>
              <button
                className="ob-plan-cta"
                onClick={() => !plan.disabled && selectPlan(plan.id)}
                disabled={plan.disabled}
                style={plan.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 16 }}>
          0% comisión por venta · Sin tarjeta de crédito · Cancela cuando quieras
        </p>
      </div>
    </div>
  )
}
