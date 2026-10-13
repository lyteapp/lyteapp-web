'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import LyteLogo from '../components/LyteLogo'

const LOGO_H = 68
const MIN_SHOW_MS = 700
// When the loader first appeared, so a fast load still shows the logo long
// enough to read (shared across the loading → ready remount).
let shownAt = 0

// Full-screen LyteApp logo while the dashboard loads. Once `ready`, the
// logo flies from the center into its spot in the sidebar (shrinking to
// size) as the backdrop fades away; if the sidebar logo isn't on screen
// (mobile, where the sidebar is tucked away) it just shrinks and fades.
export default function DashboardLoader({ ready }: { ready: boolean }) {
  const logoRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)

  useLayoutEffect(() => {
    if (!shownAt) shownAt = performance.now()
    if (!ready) return
    const logo = logoRef.current, bg = bgRef.current
    if (!logo || !bg) return
    let cancelled = false
    const target = document.querySelector<HTMLElement>('.db-brand-link > *')

    const fly = () => {
      if (cancelled) return
      // Stop the pulse first so the start position is measured at rest.
      logo.classList.remove('db-loader-pulse')
      void logo.offsetWidth
      const from = logo.getBoundingClientRect()
      const to = target?.getBoundingClientRect()
      const onScreen = !!to && to.width > 0 && to.right > 0 && to.left < window.innerWidth
      const ease = 'cubic-bezier(0.65, 0, 0.35, 1)'
      logo.style.transition = `transform 0.75s ${ease}, opacity 0.45s ease`
      bg.style.transition = 'opacity 0.5s ease 0.25s'
      if (onScreen && to) {
        target!.style.visibility = 'hidden'
        const dx = (to.left + to.width / 2) - (from.left + from.width / 2)
        const dy = (to.top + to.height / 2) - (from.top + from.height / 2)
        const s = to.height / from.height
        logo.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`
      } else {
        logo.style.transform = 'scale(0.6)'
        logo.style.opacity = '0'
      }
      bg.style.opacity = '0'
      setTimeout(() => {
        if (target) target.style.visibility = ''
        if (!cancelled) setDone(true)
      }, 800)
    }

    const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - shownAt))
    const timer = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(fly)), wait)
    return () => { cancelled = true; clearTimeout(timer); if (target) target.style.visibility = '' }
  }, [ready])

  if (done) return null
  return (
    <>
      <div ref={bgRef} className="db-loader-bg" aria-hidden="true" />
      <div className="db-loader-center" aria-label="Cargando">
        <div ref={logoRef} className="db-loader-pulse">
          <LyteLogo height={LOGO_H} tone="accent" />
        </div>
      </div>
    </>
  )
}
