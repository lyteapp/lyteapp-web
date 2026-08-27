'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useBalance } from '../BalanceProvider'
import EvolucionChart, { type PuntoEvolucion } from '../EvolucionChart'
import { calcular, compararCortes, fechaLarga, money, moneyShort } from '../balance'

const etiquetaCorta = (iso: string) => {
  const p = iso.split('-')
  if (p.length !== 3) return iso
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(p[2], 10)} ${meses[parseInt(p[1], 10) - 1] ?? ''}`
}

export default function Comparacion() {
  const { cortes, listo } = useBalance()

  const fechas = useMemo(() => Object.keys(cortes).sort(), [cortes])

  const puntos: PuntoEvolucion[] = useMemo(() => fechas.map(f => {
    const t = calcular(cortes[f])
    return {
      fecha: f,
      etiqueta: etiquetaCorta(f),
      activos: t.activos,
      pasivos: t.pasivos,
      capital: t.capital,
    }
  }), [fechas, cortes])

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Defaults to the two most recent cortes, which is the comparison you almost
  // always want; the selects override it.
  const fDesde = desde || fechas[fechas.length - 2] || ''
  const fHasta = hasta || fechas[fechas.length - 1] || ''

  const diff = useMemo(() => {
    if (!fDesde || !fHasta || fDesde === fHasta) return null
    if (!cortes[fDesde] || !cortes[fHasta]) return null
    return compararCortes(cortes[fDesde], cortes[fHasta])
  }, [fDesde, fHasta, cortes])

  const resumenDiff = useMemo(() => {
    if (!fDesde || !fHasta || !cortes[fDesde] || !cortes[fHasta]) return null
    return { a: calcular(cortes[fDesde]), b: calcular(cortes[fHasta]) }
  }, [fDesde, fHasta, cortes])

  if (!listo) return <div className="bal-loading">Cargando…</div>

  if (fechas.length === 0) {
    return (
      <div className="bal-missing">
        <h1>Todavía no hay cortes guardados.</h1>
        <p>
          La comparación necesita al menos dos balances guardados con fechas distintas.
          Armá uno, guardalo, y cuando hagas el siguiente vas a poder verlos enfrentados.
        </p>
        <Link href="/finanzas" className="bal-act bal-primary">Ir al balance</Link>
      </div>
    )
  }

  return (
    <div className="bal-wrap">
      <header className="bal-header">
        <div>
          <div className="bal-eyebrow">Cómo viene el negocio</div>
          <h1 className="bal-title">Comparación</h1>
        </div>
      </header>

      {/* ── EVOLUCIÓN ── */}
      <section className="bal-summary">
        <div className="bal-eyebrow" style={{ marginBottom: 4 }}>
          Evolución {fechas.length === 1 ? '· un solo corte' : `· ${fechas.length} cortes`}
        </div>

        {fechas.length === 1 ? (
          <p className="bal-hint" style={{ marginTop: 8 }}>
            Con un solo corte no hay tendencia que mostrar todavía. Guardá el próximo
            y acá vas a ver cómo se mueven activos, pasivos y capital.
          </p>
        ) : (
          <EvolucionChart puntos={puntos} />
        )}

        {/* La tabla no es opcional: es la que hace legibles las cifras que el
            color por sí solo no alcanza a distinguir. */}
        <div className="bal-table-wrap">
          <table className="bal-table">
            <thead>
              <tr>
                <th>Fecha de corte</th>
                <th className="r">Activos</th>
                <th className="r">Pasivos</th>
                <th className="r">Capital</th>
                <th className="r">Endeudamiento</th>
              </tr>
            </thead>
            <tbody>
              {[...fechas].reverse().map(f => {
                const t = calcular(cortes[f])
                return (
                  <tr key={f}>
                    <td>{fechaLarga(f)}</td>
                    <td className="r num">{moneyShort(t.activos)}</td>
                    <td className="r num">{moneyShort(t.pasivos)}</td>
                    <td className="r num">{moneyShort(t.capital)}</td>
                    <td className="r num">{t.endeudamiento !== null ? `${t.endeudamiento.toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DOS CORTES ── */}
      {fechas.length < 2 ? null : (
        <>
          <div className="bal-compare-head">
            <div className="bal-eyebrow">Comparar dos cortes</div>
            <div className="bal-compare-picks">
              <select className="bal-act" value={fDesde} onChange={e => setDesde(e.target.value)}>
                {fechas.map(f => <option key={f} value={f}>{fechaLarga(f)}</option>)}
              </select>
              <span className="bal-compare-arrow">→</span>
              <select className="bal-act" value={fHasta} onChange={e => setHasta(e.target.value)}>
                {fechas.map(f => <option key={f} value={f}>{fechaLarga(f)}</option>)}
              </select>
            </div>
          </div>

          {fDesde === fHasta ? (
            <p className="bal-hint">Elegí dos fechas distintas para ver las diferencias.</p>
          ) : (
            <>
              {resumenDiff && (
                <div className="bal-cards bal-cards-diff">
                  <Tarjeta titulo="Activos" a={resumenDiff.a.activos} b={resumenDiff.b.activos} />
                  <Tarjeta titulo="Pasivos" a={resumenDiff.a.pasivos} b={resumenDiff.b.pasivos} invertido />
                  <Tarjeta titulo="Capital" a={resumenDiff.a.capital} b={resumenDiff.b.capital} />
                </div>
              )}

              {diff?.map(({ sec, filas, totalA, totalB }) => (
                <div className={`bal-block bal-side-${sec.lado}`} key={sec.id} style={{ marginTop: 16 }}>
                  <div className="bal-blockhead">
                    <h2>{sec.titulo}</h2>
                    <span className="bal-tot num">
                      {money(totalA)} → {money(totalB)}
                    </span>
                  </div>

                  {filas.length === 0 ? (
                    <div className="bal-empty-row">Sin partidas en ninguno de los dos cortes.</div>
                  ) : (
                    <div className="bal-table-wrap">
                      <table className="bal-table">
                        <thead>
                          <tr>
                            <th>Partida</th>
                            <th className="r">{etiquetaCorta(fDesde)}</th>
                            <th className="r">{etiquetaCorta(fHasta)}</th>
                            <th className="r">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((f, i) => (
                            <tr key={i} className={f.estado === 'igual' ? 'bal-sin-cambio' : undefined}>
                              <td>
                                {f.nombre || <em>Sin nombre</em>}
                                {f.estado === 'nueva' && <span className="bal-tag bal-tag-nueva">nueva</span>}
                                {f.estado === 'eliminada' && <span className="bal-tag bal-tag-baja">ya no está</span>}
                              </td>
                              <td className="r num">{money(f.montoA)}</td>
                              <td className="r num">{money(f.montoB)}</td>
                              <td className="r num">
                                {f.estado === 'igual' ? (
                                  <span className="bal-delta-flat">sin cambio</span>
                                ) : (
                                  <span className={f.delta > 0 ? 'bal-delta-up' : 'bal-delta-down'}>
                                    {f.delta > 0 ? '+' : '−'}{money(Math.abs(f.delta)).replace('−', '').replace('$', '$')}
                                    {f.pct !== null && <span className="bal-delta-pct"> {f.pct > 0 ? '+' : '−'}{Math.abs(f.pct).toFixed(0)}%</span>}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Tarjeta({ titulo, a, b, invertido }: { titulo: string; a: number; b: number; invertido?: boolean }) {
  const delta = b - a
  const pct = a !== 0 ? (delta / Math.abs(a)) * 100 : null
  const plano = Math.abs(delta) < 0.005
  // For liabilities, going up is the bad direction — the arrow still points the
  // way the number moved, but the colour reflects what it means.
  const bueno = invertido ? delta < 0 : delta > 0

  return (
    <div className="bal-card">
      <div className="bal-eyebrow">{titulo}</div>
      <div className="bal-card-v num">{moneyShort(b)}</div>
      <div className="bal-card-foot">
        {plano ? (
          <span className="bal-delta-flat">sin cambio</span>
        ) : (
          <span className={bueno ? 'bal-delta-up' : 'bal-delta-down'}>
            {delta > 0 ? '↑' : '↓'} {moneyShort(Math.abs(delta))}
            {pct !== null && <span className="bal-delta-pct"> {Math.abs(pct).toFixed(0)}%</span>}
          </span>
        )}
        <span className="bal-card-from">desde {moneyShort(a)}</span>
      </div>
    </div>
  )
}
