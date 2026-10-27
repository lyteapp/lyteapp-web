'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { TourStep } from './tours'

// A guided tour (see tours.ts): a spotlight on each step's element with a
// friendly card. On phones it can open/close the ☰ menu drawer for the
// steps that need it. Steps whose element isn't on screen are skipped.
// "Saltar" ends it from any step; onDone marks it as seen.

const PAD = 6 // spotlight margin around the target

function findTarget(sel?: string): HTMLElement | null {
  if (!sel) return null
  const el = document.querySelector<HTMLElement>(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export default function DashboardTour({ steps, phone, onMenu, onDone }: {
  steps: TourStep[]
  /** Phone layout (sidebar tucked in the ☰ drawer) */
  phone: boolean
  /** Open/close the phone menu drawer for the steps that need it */
  onMenu: (open: boolean) => void
  onDone: () => void
}) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const cardRef = useRef<HTMLDivElement>(null)
  const dir = useRef<1 | -1>(1)
  const step = steps[Math.min(i, steps.length - 1)]

  // Put the menu where the step needs it, then find (and scroll to) its
  // target — or move past the step when its element isn't there
  useEffect(() => {
    if (phone && step.menu) onMenu(step.menu === 'open')
    let raf = 0
    const t = setTimeout(() => {
      const el = findTarget(step.sel)
      if (step.sel && !el) {
        if (dir.current === -1 && i > 0) setI(i - 1)
        else if (i < steps.length - 1) { dir.current = 1; setI(i + 1) }
        else finish()
        return
      }
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // re-measure while the smooth scroll / drawer slide settles
      let n = 0
      const tick = () => { setRect(el.getBoundingClientRect()); if (++n < 30) raf = requestAnimationFrame(tick) }
      tick()
    }, phone && step.menu ? 320 : 80)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [i, phone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => {
      const el = findTarget(step.sel)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step.sel])

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [i, rect])

  function finish() {
    if (phone && steps.some(st => st.menu)) onMenu(false)
    onDone()
  }
  const next = () => { dir.current = 1; if (i >= steps.length - 1) finish(); else setI(i + 1) }
  const back = () => { dir.current = -1; setI(Math.max(0, i - 1)) }

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
            {last ? (steps.length === 1 ? 'Entendido' : 'Terminar') : i === 0 && !step.sel ? 'Empecemos' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
