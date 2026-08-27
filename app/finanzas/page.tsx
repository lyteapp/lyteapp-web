'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBalance } from './BalanceProvider'
import {
  SECCIONES, calcular, fechaLarga, money, moneyShort, montoPartida, parseNum, totalSeccion,
  type Partida, type SeccionId,
} from './balance'

export default function BalanceGeneral() {
  const {
    corte, setCorte, cortes, guardar, abrir, eliminar, empezarEnBlanco, nuevoDesdeEste,
    agregarPartida, editarPartida, borrarPartida,
  } = useBalance()
  const router = useRouter()

  const t = useMemo(() => calcular(corte), [corte])

  function descargarCSV() {
    const campo = (v: string | number) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lineas: string[] = []
    lineas.push('Balance General')
    lineas.push(['Empresa', corte.empresa].map(campo).join(','))
    lineas.push(['Fecha de corte', fechaLarga(corte.fecha)].map(campo).join(','))
    lineas.push('')
    lineas.push(['Sección', 'Partida', 'Renglón', 'Monto USD'].map(campo).join(','))

    for (const s of SECCIONES) {
      for (const p of corte[s.id]) {
        if (!p.nombre && !montoPartida(p)) continue
        if (p.detalles.length) {
          for (const d of p.detalles) {
            if (!d.nombre && !parseNum(d.monto)) continue
            lineas.push([s.titulo, p.nombre, d.nombre, parseNum(d.monto).toFixed(2)].map(campo).join(','))
          }
          lineas.push([s.titulo, `${p.nombre} — subtotal`, '', montoPartida(p).toFixed(2)].map(campo).join(','))
        } else {
          lineas.push([s.titulo, p.nombre, '', montoPartida(p).toFixed(2)].map(campo).join(','))
        }
      }
      lineas.push([`${s.titulo} — total`, '', '', totalSeccion(corte[s.id]).toFixed(2)].map(campo).join(','))
    }

    lineas.push('')
    lineas.push(['TOTAL ACTIVOS', '', '', t.activos.toFixed(2)].map(campo).join(','))
    lineas.push(['TOTAL PASIVOS', '', '', t.pasivos.toFixed(2)].map(campo).join(','))
    lineas.push(['CAPITAL', '', '', t.capital.toFixed(2)].map(campo).join(','))

    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance-general-${corte.fecha || 'sin-fecha'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const fechasGuardadas = Object.keys(cortes).sort().reverse()
  const cuadra = Math.abs(t.descuadre) < 0.005

  return (
    <div className="bal-wrap">
      <header className="bal-header">
        <div>
          <div className="bal-eyebrow">Estado de situación financiera</div>
          <h1 className="bal-title">Balance general</h1>
        </div>
        <div className="bal-metafields">
          <label className="bal-field">
            <span>Empresa</span>
            <input
              value={corte.empresa}
              placeholder="Nombre de la empresa"
              onChange={e => setCorte(c => ({ ...c, empresa: e.target.value }))}
            />
          </label>
          <label className="bal-field bal-field-fecha">
            <span>Fecha de corte</span>
            <input
              type="date"
              value={corte.fecha}
              onChange={e => setCorte(c => ({ ...c, fecha: e.target.value }))}
            />
          </label>
        </div>
      </header>

      {/* ── RESUMEN ── */}
      <section className="bal-summary">
        <div className="bal-cards">
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-activo" /><span className="bal-eyebrow">Total activos</span></div>
            <div className="bal-card-v num">{moneyShort(t.activos)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-pasivo" /><span className="bal-eyebrow">Total pasivos</span></div>
            <div className="bal-card-v num">{moneyShort(t.pasivos)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-capital" /><span className="bal-eyebrow">Capital</span></div>
            <div className="bal-card-v num">{moneyShort(t.capital)}</div>
          </div>
        </div>

        <div className="bal-beam">
          <div className="bal-eyebrow">Cómo se financian los activos</div>
          <div className="bal-beambar">
            <span className="bal-beam-p" style={{ width: `${t.pctPasivo.toFixed(2)}%` }} />
            <span className="bal-beam-c" style={{ width: `${t.pctCapital.toFixed(2)}%` }} />
          </div>
          <div className="bal-beamlegend">
            <span><span className="bal-dot bal-dot-pasivo" /> Deuda de terceros <b className="num">{t.pctPasivo.toFixed(1)}%</b></span>
            <span><span className="bal-dot bal-dot-capital" /> Capital propio <b className="num">{t.pctCapital.toFixed(1)}%</b></span>
          </div>
        </div>

        <div className="bal-ratios">
          <div className="bal-ratio">
            <div className="bal-eyebrow">Capital de trabajo</div>
            <div className="bal-ratio-v num">{moneyShort(t.capitalTrabajo)}</div>
            <div className="bal-ratio-h">Activo corriente − pasivo corriente</div>
          </div>
          <div className="bal-ratio">
            <div className="bal-eyebrow">Razón corriente</div>
            <div className="bal-ratio-v num">{t.razonCorriente !== null ? t.razonCorriente.toFixed(2) : '—'}</div>
            <div className="bal-ratio-h">Veces que cubres la deuda de corto plazo</div>
          </div>
          <div className="bal-ratio">
            <div className="bal-eyebrow">Endeudamiento</div>
            <div className="bal-ratio-v num">{t.endeudamiento !== null ? `${t.endeudamiento.toFixed(1)}%` : '—'}</div>
            <div className="bal-ratio-h">Pasivos sobre activos</div>
          </div>
        </div>
      </section>

      {/* ── LIBRO ── */}
      <div className="bal-ledger">
        <div className="bal-col">
          {SECCIONES.filter(s => s.lado === 'activo').map(sec => (
            <Bloque key={sec.id} sec={sec} partidas={corte[sec.id]}
              onEditar={editarPartida} onBorrar={borrarPartida}
              onAgregar={s => { const p = agregarPartida(s); router.push(`/finanzas/partida/${p.id}`) }} />
          ))}
        </div>

        <div className="bal-col">
          {SECCIONES.filter(s => s.lado === 'pasivo').map(sec => (
            <Bloque key={sec.id} sec={sec} partidas={corte[sec.id]}
              onEditar={editarPartida} onBorrar={borrarPartida}
              onAgregar={s => { const p = agregarPartida(s); router.push(`/finanzas/partida/${p.id}`) }} />
          ))}

          <div className="bal-block bal-side-capital">
            <div className="bal-blockhead"><h2>Capital</h2></div>
            <div className="bal-capbody">
              <div className="bal-capval num">{money(t.capital)}</div>
              <div className="bal-capnote">
                {t.manual
                  ? 'Capital registrado a mano. El cuadre compara activos contra pasivos más capital.'
                  : 'Calculado como activos totales menos pasivos totales.'}
              </div>

              <label className="bal-switch">
                <input
                  type="checkbox"
                  checked={t.manual}
                  onChange={e => setCorte(c => ({
                    ...c,
                    capitalManual: e.target.checked ? (t.activos - t.pasivos).toFixed(2) : null,
                  }))}
                />
                Registrar el capital manualmente y verificar el cuadre
              </label>

              {t.manual && (
                <div className="bal-capmanual">
                  <input
                    className="num"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={corte.capitalManual ?? ''}
                    onChange={e => setCorte(c => ({ ...c, capitalManual: e.target.value }))}
                    onBlur={() => setCorte(c => ({
                      ...c,
                      capitalManual: c.capitalManual === null ? null : parseNum(c.capitalManual).toFixed(2),
                    }))}
                  />
                  <div className={`bal-cuadre${cuadra ? ' ok' : ' bad'}`}>
                    <span>{cuadra ? 'Cuadra' : 'Descuadre'}</span>
                    <b className="num">{money(t.descuadre)}</b>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ACCIONES ── */}
      <div className="bal-actions">
        <button className="bal-act bal-primary" onClick={guardar}>Guardar corte</button>
        <select className="bal-act" value="" onChange={e => { if (e.target.value) abrir(e.target.value) }}>
          <option value="">{fechasGuardadas.length ? 'Abrir corte guardado…' : 'No hay cortes guardados'}</option>
          {fechasGuardadas.map(f => <option key={f} value={f}>{fechaLarga(f)}</option>)}
        </select>
        <button className="bal-act" onClick={eliminar}>Eliminar corte</button>
        <button className="bal-act" onClick={nuevoDesdeEste} title="Copia esta estructura con la fecha de hoy">
          Nuevo corte desde este
        </button>
        <Link href="/finanzas/comparacion" className="bal-act">Comparar cortes</Link>
        <span className="bal-spacer" />
        <button className="bal-act" onClick={descargarCSV}>Descargar CSV</button>
        <button className="bal-act" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="bal-act" onClick={empezarEnBlanco}>Empezar en blanco</button>
      </div>

      <p className="bal-storage-note">
        Los cortes se guardan por ahora en este navegador. Cuando conectemos la base de
        datos van a quedar en la nube y los vas a ver desde cualquier dispositivo.
      </p>
    </div>
  )
}

function Bloque({
  sec, partidas, onEditar, onBorrar, onAgregar,
}: {
  sec: { id: SeccionId; titulo: string; lado: 'activo' | 'pasivo' }
  partidas: Partida[]
  onEditar: (sec: SeccionId, id: string, cambios: Partial<Partida>) => void
  onBorrar: (sec: SeccionId, id: string) => void
  onAgregar: (sec: SeccionId) => void
}) {
  return (
    <div className={`bal-block bal-side-${sec.lado}`}>
      <div className="bal-blockhead">
        <h2>{sec.titulo}</h2>
        <span className="bal-tot num">{money(totalSeccion(partidas))}</span>
      </div>

      <div className="bal-rows">
        {partidas.map(p => {
          const desglosado = p.detalles.length > 0
          return (
            <div className="bal-row" key={p.id}>
              <input
                className="bal-row-name"
                placeholder="Nombre de la partida"
                value={p.nombre}
                onChange={e => onEditar(sec.id, p.id, { nombre: e.target.value })}
              />

              {desglosado ? (
                /* Derived from the breakdown, so it is shown rather than typed —
                   the link is the way in to change it. */
                <Link href={`/finanzas/partida/${p.id}`} className="bal-row-derived num" title="Ver desglose">
                  {money(montoPartida(p))}
                  <span className="bal-row-count">{p.detalles.length}</span>
                </Link>
              ) : (
                <input
                  className="bal-row-amt num"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={p.monto}
                  onChange={e => onEditar(sec.id, p.id, { monto: e.target.value })}
                  onBlur={() => onEditar(sec.id, p.id, {
                    monto: p.monto.trim() === '' ? '' : parseNum(p.monto).toFixed(2),
                  })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAgregar(sec.id) } }}
                />
              )}

              <Link href={`/finanzas/partida/${p.id}`} className="bal-open" aria-label="Abrir partida" title="Abrir partida">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>

              <button className="bal-del" onClick={() => onBorrar(sec.id, p.id)} aria-label="Eliminar partida" title="Eliminar partida">
                ×
              </button>
            </div>
          )
        })}
      </div>

      <button className="bal-addbtn" onClick={() => onAgregar(sec.id)}>+ Agregar partida</button>
    </div>
  )
}
