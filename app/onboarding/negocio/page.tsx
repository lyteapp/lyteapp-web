'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const RUBROS = [
  { id: 'comida', icon: '🍕', label: 'Comida y restaurantes' },
  { id: 'ropa', icon: '👗', label: 'Ropa y moda' },
  { id: 'belleza', icon: '💄', label: 'Belleza y spa' },
  { id: 'tech', icon: '📱', label: 'Tecnología' },
  { id: 'hogar', icon: '🏠', label: 'Hogar y deco' },
  { id: 'reposteria', icon: '🎂', label: 'Repostería y postres' },
  { id: 'cafe', icon: '☕', label: 'Café y bebidas' },
  { id: 'deporte', icon: '💪', label: 'Deporte y fitness' },
  { id: 'salud', icon: '🧘', label: 'Salud y bienestar' },
  { id: 'joyeria', icon: '💍', label: 'Joyería y accesorios' },
  { id: 'mascotas', icon: '🐾', label: 'Mascotas' },
  { id: 'flores', icon: '🌸', label: 'Flores y plantas' },
  { id: 'arte', icon: '🎨', label: 'Arte y artesanía' },
  { id: 'libros', icon: '📚', label: 'Libros y educación' },
  { id: 'fotografia', icon: '📷', label: 'Fotografía y diseño' },
  { id: 'automotriz', icon: '🚗', label: 'Automotriz' },
  { id: 'regalos', icon: '🎁', label: 'Regalos y detalles' },
  { id: 'servicios', icon: '🔧', label: 'Servicios técnicos' },
  { id: 'cursos', icon: '🎓', label: 'Cursos y coaching' },
  { id: 'digital', icon: '🖥️', label: 'Servicios digitales' },
  { id: 'delivery', icon: '🛵', label: 'Delivery y logística' },
  { id: 'ecommerce', icon: '🛍️', label: 'Tienda en línea' },
  { id: 'viajes', icon: '✈️', label: 'Viajes y turismo' },
  { id: 'musica', icon: '🎵', label: 'Música y entretenimiento' },
]

const STEPS = 6

export default function NegocioPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [otroText, setOtroText] = useState('')

  function toggle(id: string) {
    setSelected(prev => prev === id ? null : id)
  }

  function handleNext() {
    const rubro = selected === 'otro' ? otroText : (RUBROS.find(r => r.id === selected)?.label ?? '')
    if (rubro) localStorage.setItem('ob_rubro', rubro)
    router.push('/onboarding/plan')
  }

  const canContinue = selected !== null && (selected !== 'otro' || otroText.trim().length > 0)

  return (
    <div className="ob-screen">
      <div className="ob-brand">Lyte<span>app</span></div>

      <div className="ob-progress">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className={`ob-dot ${i === 0 ? 'active' : ''}`} />
        ))}
      </div>

      <div className="ob-card">
        <div className="ob-step-label">Paso 1 de {STEPS}</div>
        <h1 className="ob-title">¿Qué tipo de negocio tienes?</h1>
        <p className="ob-sub">Selecciona el que mejor te describa. Lo usamos para personalizar tu experiencia desde el primer día.</p>

        <div className="ob-rubro-grid">
          {RUBROS.map(r => (
            <button
              key={r.id}
              className={`ob-rubro-chip${selected === r.id ? ' selected' : ''}`}
              onClick={() => toggle(r.id)}
            >
              {r.label}
            </button>
          ))}

          <button
            className={`ob-rubro-chip ob-rubro-otro${selected === 'otro' ? ' selected' : ''}`}
            onClick={() => setSelected('otro')}
          >
            <span className="ob-rubro-icon">✏️</span>
            <input
              className="ob-rubro-otro-input"
              placeholder="Otro — escribe tu rubro"
              value={otroText}
              onClick={(e) => { e.stopPropagation(); setSelected('otro') }}
              onChange={(e) => setOtroText(e.target.value)}
            />
          </button>
        </div>

        <div className="ob-actions">
          <button className="ob-btn-skip" onClick={() => router.push('/onboarding/plan')}>
            Omitir por ahora
          </button>
          <button
            className="ob-btn-primary"
            onClick={handleNext}
            disabled={!canContinue}
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  )
}
