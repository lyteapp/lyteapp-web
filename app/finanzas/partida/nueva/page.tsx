'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBalance } from '../../BalanceProvider'
import { SECCIONES, tiposDe, type SeccionId } from '../../balance'

/* useSearchParams needs a Suspense boundary in a prerendered route. */
export default function NuevaPartidaPage() {
  return (
    <Suspense fallback={<div className="bal-loading">Cargando…</div>}>
      <NuevaPartida />
    </Suspense>
  )
}

function NuevaPartida() {
  const params = useSearchParams()
  const router = useRouter()
  const { agregarPartida } = useBalance()

  const secParam = params.get('sec')
  const seccion = SECCIONES.find(s => s.id === secParam)

  if (!seccion) {
    return (
      <div className="bal-missing">
        <h1>No sé en qué sección crearla.</h1>
        <p>Volvé al balance y usá el botón de agregar de la sección que corresponda.</p>
        <Link href="/finanzas" className="bal-act bal-primary">Volver al balance</Link>
      </div>
    )
  }

  const sec = seccion.id as SeccionId

  return (
    <div className="bal-wrap bal-detalle">
      <Link href="/finanzas" className="bal-breadcrumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        {seccion.titulo}
      </Link>

      <header style={{ marginBottom: 20 }}>
        <div className="bal-eyebrow">Nueva partida en {seccion.titulo.toLowerCase()}</div>
        <h1 className="bal-title">¿Qué vas a cargar?</h1>
        <p className="bal-hint" style={{ marginTop: 8, maxWidth: 560 }}>
          Cada tipo se comporta distinto. El efectivo que ya tenés se valora al cambio real
          y nada más; una cuenta por cobrar además depende de a qué tasa te la van a pagar.
        </p>
      </header>

      <div className="bal-tipos">
        {tiposDe(seccion.lado).map(t => (
          <button
            key={t.id}
            className="bal-tipo"
            onClick={() => {
              const p = agregarPartida(sec, t.id)
              router.replace(`/finanzas/partida/${p.id}`)
            }}
          >
            <div className="bal-tipo-label">{t.label}</div>
            <div className="bal-tipo-desc">{t.descripcion}</div>
            <div className="bal-tipo-formas">
              {t.formas.includes('USD_BCV')
                ? 'Distingue lo que se cobra en dólares de lo que se cobra en bolívares a BCV'
                : 'Renglones con su moneda'}
            </div>
          </button>
        ))}
      </div>

      <div className="bal-actions">
        <Link href="/finanzas" className="bal-act">Cancelar</Link>
      </div>
    </div>
  )
}
