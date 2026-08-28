'use client'

import { useMemo, useRef, useState } from 'react'
import { moneyShort } from './balance'

export type PuntoEvolucion = {
  fecha: string
  etiqueta: string
  activos: number
  pasivos: number
  capital: number
}

/* Colour follows the entity, matching the sheet: three steps of ink rather than
   three hues.

   Validated against a light surface: CVD separation 22.5 and normal-vision 22.5
   — better than every muted-colour trio tried — with all three clearing 3:1
   contrast. It fails two of the validator's checks by construction: the
   lightness band and the chroma floor, both of which exist to catch greys used
   by accident. These are deliberate, so each series also carries a dash pattern,
   which is the secondary encoding that failure obliges, on top of the legend,
   the direct labels and the figures table. */
const SERIES = [
  { key: 'activos' as const, label: 'Activos', color: '#0B0B0C', trazo: undefined },
  { key: 'capital' as const, label: 'Capital', color: '#4A4A50', trazo: '7 3' },
  { key: 'pasivos' as const, label: 'Pasivos', color: '#8A8A92', trazo: '2 3' },
]

const W = 800, H = 268
const PAD = { top: 18, right: 96, bottom: 34, left: 62 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

export default function EvolucionChart({ puntos }: { puntos: PuntoEvolucion[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activo, setActivo] = useState<number | null>(null)

  const escala = useMemo(() => {
    const tiempos = puntos.map(p => new Date(`${p.fecha}T00:00:00`).getTime())
    const tMin = Math.min(...tiempos), tMax = Math.max(...tiempos)
    const span = tMax - tMin

    const valores = puntos.flatMap(p => [p.activos, p.pasivos, p.capital])
    const vMin = Math.min(0, ...valores)
    const vMax = Math.max(0, ...valores)
    const rango = vMax - vMin || 1

    // A single corte has no span to spread across, so it sits mid-plot.
    const x = (i: number) =>
      span === 0 ? PAD.left + PLOT_W / 2 : PAD.left + ((tiempos[i] - tMin) / span) * PLOT_W
    const y = (v: number) => PAD.top + PLOT_H - ((v - vMin) / rango) * PLOT_H

    const ticks = Array.from({ length: 5 }, (_, i) => vMin + (rango / 4) * i)
    return { x, y, ticks, vMin, vMax }
  }, [puntos])

  function alMover(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const caja = svg.getBoundingClientRect()
    const px = ((e.clientX - caja.left) / caja.width) * W
    let mejor = 0, dist = Infinity
    puntos.forEach((_, i) => {
      const d = Math.abs(escala.x(i) - px)
      if (d < dist) { dist = d; mejor = i }
    })
    setActivo(mejor)
  }

  const punto = activo !== null ? puntos[activo] : null

  return (
    <div className="bal-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="bal-chart-svg"
        role="img"
        aria-label="Evolución de activos, pasivos y capital por fecha de corte"
        onMouseMove={alMover}
        onMouseLeave={() => setActivo(null)}
      >
        {/* Grilla recesiva */}
        {escala.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left} x2={PAD.left + PLOT_W}
              y1={escala.y(t)} y2={escala.y(t)}
              stroke={Math.abs(t) < 0.005 ? '#B4B4BA' : '#EAEAE7'}
              strokeWidth="1"
            />
            <text x={PAD.left - 10} y={escala.y(t) + 3.5} textAnchor="end" className="bal-chart-tick">
              {moneyShort(t)}
            </text>
          </g>
        ))}

        {/* Crosshair */}
        {activo !== null && (
          <line
            x1={escala.x(activo)} x2={escala.x(activo)}
            y1={PAD.top} y2={PAD.top + PLOT_H}
            stroke="#97979E" strokeWidth="1" strokeDasharray="3 3"
          />
        )}

        {/* Series */}
        {SERIES.map(s => {
          const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${escala.x(i)},${escala.y(p[s.key])}`).join(' ')
          const ultimo = puntos.length - 1
          return (
            <g key={s.key}>
              {puntos.length > 1 && (
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.trazo}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={escala.x(i)} cy={escala.y(p[s.key])}
                  r={activo === i ? 5.5 : 4}
                  fill={s.color}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
              {/* Etiqueta directa: identidad sin depender solo del color */}
              <text
                x={escala.x(ultimo) + 12}
                y={escala.y(puntos[ultimo][s.key]) + 3.5}
                className="bal-chart-serie"
                fill={s.color}
              >
                {s.label}
              </text>
            </g>
          )
        })}

        {/* Eje X */}
        {puntos.map((p, i) => (
          <text key={i} x={escala.x(i)} y={H - 12} textAnchor="middle" className="bal-chart-tick">
            {p.etiqueta}
          </text>
        ))}
      </svg>

      {punto && (
        <div
          className="bal-chart-tip"
          style={{
            left: `${(escala.x(activo!) / W) * 100}%`,
            transform: escala.x(activo!) > W * 0.6 ? 'translateX(-105%)' : 'translateX(5%)',
          }}
        >
          <div className="bal-chart-tip-date">{punto.etiqueta}</div>
          {SERIES.map(s => (
            <div className="bal-chart-tip-row" key={s.key}>
              <span className="bal-dot" style={{ background: s.color === '#0B0B0C' ? '#FFFFFF' : s.color }} />
              <span className="bal-chart-tip-k">{s.label}</span>
              <span className="bal-chart-tip-v num">{moneyShort(punto[s.key])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bal-legend">
        {SERIES.map(s => (
          <span className="bal-legend-item" key={s.key}>
            {/* The swatch shows the line's dash pattern, so the legend keys on the
                same two cues the plot does rather than on colour alone. */}
            <svg width="18" height="8" aria-hidden="true">
              <line
                x1="0" y1="4" x2="18" y2="4"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.trazo}
                strokeLinecap="round"
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
