'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// First-visit guided tour of the dashboard: a spotlight on each part (via
// its data-tour="…" attribute) with a friendly card. Two versions — on a
// computer the sidebar is always there; on a phone the sections live in the
// ☰ menu, so the tour points at that button first and opens/closes the menu
// itself. "Saltar" ends it from any step; once finished or skipped it's
// marked done (see onDone) and never comes back on its own.

type Step = { target?: string; emoji: string; title: string; text: string; menu?: 'open' | 'closed' }

const DESKTOP_STEPS: Step[] = [
  { emoji: '👋', title: '¡Bienvenido a Lyte!', text: 'Te mostramos en menos de un minuto dónde está todo. Puedes saltar el tutorial cuando quieras.' },
  { target: 'store', emoji: '🏪', title: 'Tu tienda', text: 'Aquí ves la tienda que estás manejando. Haz clic para cambiar entre tus tiendas o crear una nueva.' },
  { target: 'orders', emoji: '🛒', title: 'Pedidos', text: 'Cada pedido nuevo llega aquí al instante, con un sonido para que no se te escape ninguno.' },
  { target: 'caja', emoji: '💵', title: 'Caja', text: 'Registra las ventas en persona y lleva el cuadre del día.' },
  { target: 'delivery', emoji: '🛵', title: 'Delivery', text: 'Asigna repartidores, sigue las entregas en el mapa en vivo y define tus zonas y tarifas.' },
  { target: 'products', emoji: '🍰', title: 'Productos', text: 'Crea tus productos con fotos, variables (sabores, tamaños) y extras, y ordénalos por categorías.' },
  { target: 'inventario', emoji: '📦', title: 'Inventario', text: 'Controla almacenes, compras e ingredientes. Cada venta descuenta sola de tu almacén.' },
  { target: 'finanzas', emoji: '📊', title: 'Finanzas', text: 'Tus cuentas, ingresos y gastos en un solo lugar.' },
  { target: 'design', emoji: '🎨', title: 'Diseño', text: 'Personaliza cómo se ve tu tienda: vitrina, página de inicio, checkout y rastreo del pedido.' },
  { target: 'analytics', emoji: '📈', title: 'Analíticas', text: 'Mira cuánto vendes, tus productos estrella y cómo crece tu negocio.' },
  { target: 'assistant', emoji: '✨', title: 'Asistente', text: '¿Tienes dudas? Pregúntale al asistente cómo hacer cualquier cosa en Lyte.' },
  { emoji: '🎉', title: '¡Todo listo!', text: 'Ya conoces lo básico. Un buen primer paso: crea tu primer producto o diseña tu tienda.' },
]

const PHONE_STEPS: Step[] = [
  { emoji: '👋', title: '¡Bienvenido a Lyte!', text: 'Te mostramos en menos de un minuto dónde está todo. Puedes saltar el tutorial cuando quieras.', menu: 'closed' },
  { target: 'menu', emoji: '☰', title: 'Tu menú', text: 'Todas las secciones están aquí. Tócalo cuando quieras ir a otra parte. Te las mostramos.', menu: 'closed' },
  { target: 'store', emoji: '🏪', title: 'Tu tienda', text: 'La tienda que estás manejando. Tócala para cambiar entre tus tiendas o crear una nueva.', menu: 'open' },
  { target: 'orders', emoji: '🛒', title: 'Pedidos', text: 'Cada pedido nuevo llega aquí al instante, con un sonido para que no se te escape.', menu: 'open' },
  { target: 'caja', emoji: '💵', title: 'Caja', text: 'Registra ventas en persona y lleva el cuadre del día.', menu: 'open' },
  { target: 'delivery', emoji: '🛵', title: 'Delivery', text: 'Asigna repartidores y sigue las entregas en el mapa en vivo.', menu: 'open' },
  { target: 'products', emoji: '🍰', title: 'Productos', text: 'Tus productos con fotos, variables y extras, ordenados por categorías.', menu: 'open' },
  { target: 'inventario', emoji: '📦', title: 'Inventario', text: 'Almacenes, compras e ingredientes. Cada venta descuenta sola.', menu: 'open' },
  { target: 'finanzas', emoji: '📊', title: 'Finanzas', text: 'Tus cuentas, ingresos y gastos.', menu: 'open' },
  { target: 'design', emoji: '🎨', title: 'Diseño', text: 'Cómo se ve tu tienda: vitrina, inicio, checkout y rastreo. Se edita cómodo desde el teléfono.', menu: 'open' },
  { target: 'analytics', emoji: '📈', title: 'Analíticas', text: 'Cuánto vendes y tus productos estrella.', menu: 'open' },
  { target: 'assistant', emoji: '✨', title: 'Asistente', text: '¿Dudas? Toca aquí y pregúntale al asistente cómo hacer cualquier cosa.', menu: 'closed' },
  { emoji: '🎉', title: '¡Todo listo!', text: 'Ya conoces lo básico. Un buen primer paso: crea tu primer producto.', menu: 'closed' },
]

const PAD = 6 // spotlight margin around the target

export default function DashboardTour({ phone, onMenu, onDone }: {
  /** Phone layout (sidebar tucked in the ☰ drawer) */
  phone: boolean
  /** Open/close the phone menu drawer for the steps that need it */
  onMenu: (open: boolean) => void
  onDone: () => void
}) {
  const steps = phone ? PHONE_STEPS : DESKTOP_STEPS
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const cardRef = useRef<HTMLDivElement>(null)
  const step = steps[Math.min(i, steps.length - 1)]

  // Put the menu where the step needs it, then find (and scroll to) its target
  useEffect(() => {
    if (phone && step.menu) onMenu(step.menu === 'open')
    let raf = 0
    const t = setTimeout(() => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // re-measure while the smooth scroll / drawer slide settles
      let n = 0
      const tick = () => { setRect(el.getBoundingClientRect()); if (++n < 30) raf = requestAnimationFrame(tick) }
      tick()
    }, phone && step.menu ? 320 : 60)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [i, phone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step.target])

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [i, rect])

  const finish = useCallback(() => {
    if (phone) onMenu(false)
    onDone()
  }, [phone, onMenu, onDone])
  const next = () => (i >= steps.length - 1 ? finish() : setI(i + 1))
  const back = () => setI(Math.max(0, i - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Card placement: centred with no target; beside the sidebar item on a
  // computer (below it if it's at the right edge); above/below on a phone
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const cardW = Math.min(phone ? 340 : 320, vw - 32)
  let cardStyle: React.CSSProperties
  if (!rect) {
    cardStyle = { left: (vw - cardW) / 2, top: Math.max(16, (vh - cardH) / 2) }
  } else if (!phone && rect.right + 16 + cardW < vw - 16) {
    cardStyle = { left: rect.right + 18, top: Math.min(vh - cardH - 16, Math.max(16, rect.top + rect.height / 2 - cardH / 2)) }
  } else {
    const below = rect.bottom + PAD + 14
    const top = below + cardH < vh - 16 ? below : Math.max(16, rect.top - PAD - 14 - cardH)
    const left = Math.min(vw - cardW - 16, Math.max(16, rect.left + rect.width / 2 - cardW / 2))
    cardStyle = { left, top }
  }

  const last = i === steps.length - 1
  return (
    <div className={`db-tour${phone ? ' phone' : ''}`} role="dialog" aria-modal="true" aria-label="Tutorial">
      {rect
        ? <div className="db-tour-spot" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
        : <div className="db-tour-dim" />}
      <div ref={cardRef} key={i} className="db-tour-card" style={{ ...cardStyle, width: cardW }}>
        <div className="db-tour-emoji" aria-hidden="true">{step.emoji}</div>
        <div className="db-tour-title">{step.title}</div>
        <div className="db-tour-text">{step.text}</div>
        <div className="db-tour-dots" aria-label={`Paso ${i + 1} de ${steps.length}`}>
          {steps.map((_, k) => <span key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}
        </div>
        <div className="db-tour-actions">
          {!last && <button type="button" className="db-tour-skip" onClick={finish}>Saltar tutorial</button>}
          <span style={{ flex: 1 }} />
          {i > 0 && !last && <button type="button" className="db-tour-back" onClick={back}>Atrás</button>}
          <button type="button" className="db-tour-next" onClick={next}>
            {i === 0 ? '¡Empecemos!' : last ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
