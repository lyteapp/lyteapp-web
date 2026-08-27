'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { money, moneyShort, parseNum } from '../balance'
import {
  CATEGORIAS_SUGERIDAS, CLAVE_FLUJO, type Libro, type Movimiento, type TipoMov,
  diaCorto, libroVacio, mesDe, mesLargo, mesesConDatos, normalizarLibro,
  nuevoMovimiento, ordenar,
} from './model'

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function FlujoDeCaja() {
  const [libro, setLibro] = useState<Libro>(libroVacio)
  // Gates the first write so the empty initial state can't overwrite what's stored.
  const [listo, setListo] = useState(false)
  // Empty until mount: the route is prerendered, so deriving it from today's
  // date up front would bake the build date into the HTML.
  const [mes, setMes] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE_FLUJO)
      if (raw) setLibro(normalizarLibro(JSON.parse(raw)))
    } catch { /* corrupto o modo privado: se arranca vacío */ }
    setMes(mesDe(hoyISO()))
    setListo(true)
  }, [])

  useEffect(() => {
    if (!listo) return
    try { localStorage.setItem(CLAVE_FLUJO, JSON.stringify(libro)) } catch { /* cuota llena */ }
  }, [libro, listo])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function aviso(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  const ordenados = useMemo(() => ordenar(libro.movimientos), [libro.movimientos])

  const vista = useMemo(() => {
    const inicio = parseNum(libro.saldoInicial)
    const primerDia = `${mes}-01`

    // Everything before the month rolls into its opening balance, so you never
    // type a saldo inicial per month — it falls out of the history.
    let saldoApertura = inicio
    for (const m of ordenados) {
      if (m.fecha && m.fecha < primerDia) {
        saldoApertura += m.tipo === 'entrada' ? parseNum(m.monto) : -parseNum(m.monto)
      }
    }

    const delMes = ordenados.filter(m => m.fecha && mesDe(m.fecha) === mes)
    let corriente = saldoApertura
    const filas = delMes.map(m => {
      corriente += m.tipo === 'entrada' ? parseNum(m.monto) : -parseNum(m.monto)
      return { mov: m, saldo: corriente }
    })

    const entradas = delMes.filter(m => m.tipo === 'entrada').reduce((a, m) => a + parseNum(m.monto), 0)
    const salidas  = delMes.filter(m => m.tipo === 'salida').reduce((a, m) => a + parseNum(m.monto), 0)

    // Sin fecha no entra en ningún mes: se listan aparte para que no desaparezcan.
    const sinFecha = ordenados.filter(m => !m.fecha)

    return { saldoApertura, filas, entradas, salidas, saldoFinal: saldoApertura + entradas - salidas, sinFecha }
  }, [ordenados, libro.saldoInicial, mes])

  const categorias = useMemo(() => {
    const usadas = libro.movimientos.map(m => m.categoria.trim()).filter(Boolean)
    return [...new Set([...usadas, ...CATEGORIAS_SUGERIDAS])]
  }, [libro.movimientos])

  const meses = useMemo(() => {
    const conDatos = mesesConDatos(libro.movimientos)
    return mes && !conDatos.includes(mes) ? [mes, ...conDatos] : conDatos
  }, [libro.movimientos, mes])

  function agregar(tipo: TipoMov) {
    const fecha = mes === mesDe(hoyISO()) ? hoyISO() : `${mes}-01`
    setLibro(l => ({ ...l, movimientos: [...l.movimientos, nuevoMovimiento(fecha, tipo)] }))
  }

  function editar(id: string, cambios: Partial<Movimiento>) {
    setLibro(l => ({ ...l, movimientos: l.movimientos.map(m => (m.id === id ? { ...m, ...cambios } : m)) }))
  }

  function borrar(id: string) {
    setLibro(l => ({ ...l, movimientos: l.movimientos.filter(m => m.id !== id) }))
  }

  function descargarCSV() {
    const campo = (v: string | number) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lineas = [
      'Flujo de caja',
      ['Mes', mesLargo(mes)].map(campo).join(','),
      ['Saldo inicial del mes', vista.saldoApertura.toFixed(2)].map(campo).join(','),
      '',
      ['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Monto', 'Saldo'].map(campo).join(','),
      ...vista.filas.map(f => [
        f.mov.fecha, f.mov.concepto, f.mov.categoria, f.mov.tipo,
        (f.mov.tipo === 'salida' ? -parseNum(f.mov.monto) : parseNum(f.mov.monto)).toFixed(2),
        f.saldo.toFixed(2),
      ].map(campo).join(',')),
      '',
      ['Entradas', vista.entradas.toFixed(2)].map(campo).join(','),
      ['Salidas', vista.salidas.toFixed(2)].map(campo).join(','),
      ['Saldo final', vista.saldoFinal.toFixed(2)].map(campo).join(','),
    ]
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flujo-de-caja-${mes}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (!listo) return <div className="bal-loading">Cargando…</div>

  const negativo = vista.saldoFinal < 0

  return (
    <div className="bal-wrap">
      <header className="bal-header">
        <div>
          <div className="bal-eyebrow">Entradas y salidas de dinero</div>
          <h1 className="bal-title">Flujo de caja</h1>
        </div>
        <div className="bal-metafields">
          <label className="bal-field">
            <span>Mes</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 148 }} />
          </label>
          <label className="bal-field">
            <span>Saldo inicial histórico</span>
            <input
              className="num"
              inputMode="decimal"
              placeholder="0.00"
              value={libro.saldoInicial}
              onChange={e => setLibro(l => ({ ...l, saldoInicial: e.target.value }))}
              onBlur={() => setLibro(l => ({
                ...l, saldoInicial: l.saldoInicial.trim() === '' ? '' : parseNum(l.saldoInicial).toFixed(2),
              }))}
              style={{ width: 132, textAlign: 'right' }}
            />
          </label>
        </div>
      </header>

      {/* ── RESUMEN DEL MES ── */}
      <section className="bal-summary">
        <div className="bal-eyebrow" style={{ marginBottom: 10 }}>{mes ? mesLargo(mes) : ''}</div>

        <div className="bal-cards bal-cards-4">
          <div className="bal-card">
            <div className="bal-eyebrow">Saldo inicial</div>
            <div className="bal-card-v num">{moneyShort(vista.saldoApertura)}</div>
            <div className="bal-card-foot"><span className="bal-card-from">arrastrado de meses anteriores</span></div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-entrada" /><span className="bal-eyebrow">Entradas</span></div>
            <div className="bal-card-v num bal-v-entrada">{moneyShort(vista.entradas)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-salida" /><span className="bal-eyebrow">Salidas</span></div>
            <div className="bal-card-v num bal-v-salida">{moneyShort(vista.salidas)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-eyebrow">Saldo final</div>
            <div className={`bal-card-v num${negativo ? ' bal-v-salida' : ''}`}>{moneyShort(vista.saldoFinal)}</div>
            <div className="bal-card-foot">
              {vista.entradas - vista.salidas === 0 ? (
                <span className="bal-delta-flat">sin movimiento neto</span>
              ) : (
                <span className={vista.entradas - vista.salidas > 0 ? 'bal-delta-up' : 'bal-delta-down'}>
                  {vista.entradas - vista.salidas > 0 ? '↑' : '↓'} {moneyShort(Math.abs(vista.entradas - vista.salidas))} en el mes
                </span>
              )}
            </div>
          </div>
        </div>

        {negativo && (
          <div className="bal-alerta">
            El saldo final del mes queda en negativo. Revisá el saldo inicial histórico o si falta cargar alguna entrada.
          </div>
        )}

        {vista.filas.length > 1 && <SaldoChart filas={vista.filas} apertura={vista.saldoApertura} />}
      </section>

      {/* ── MOVIMIENTOS ── */}
      <div className="bal-block">
        <div className="bal-blockhead">
          <h2>Movimientos {mes ? `· ${mesLargo(mes)}` : ''}</h2>
          <span className="bal-tot num">{money(vista.saldoFinal)}</span>
        </div>

        {vista.filas.length === 0 ? (
          <div className="bal-empty-row">
            No hay movimientos cargados en este mes. Agregá una entrada o una salida abajo.
          </div>
        ) : (
          <div className="bal-table-wrap">
            <table className="bal-table bal-flujo-table">
              <thead>
                <tr>
                  <th style={{ width: 128 }}>Fecha</th>
                  <th>Concepto</th>
                  <th style={{ width: 150 }}>Categoría</th>
                  <th className="r" style={{ width: 126 }}>Monto</th>
                  <th className="r" style={{ width: 118 }}>Saldo</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {vista.filas.map(({ mov, saldo }) => (
                  <tr key={mov.id}>
                    <td>
                      <input
                        type="date"
                        className="bal-cell"
                        value={mov.fecha}
                        onChange={e => editar(mov.id, { fecha: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="bal-cell"
                        placeholder="Ej: pago a proveedor"
                        value={mov.concepto}
                        onChange={e => editar(mov.id, { concepto: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="bal-cell"
                        list="flujo-categorias"
                        placeholder="Categoría"
                        value={mov.categoria}
                        onChange={e => editar(mov.id, { categoria: e.target.value })}
                      />
                    </td>
                    <td className="r">
                      <div className="bal-monto-cell">
                        <button
                          className={`bal-signo bal-signo-${mov.tipo}`}
                          onClick={() => editar(mov.id, { tipo: mov.tipo === 'entrada' ? 'salida' : 'entrada' })}
                          title={mov.tipo === 'entrada' ? 'Es una entrada — click para cambiar a salida' : 'Es una salida — click para cambiar a entrada'}
                        >
                          {mov.tipo === 'entrada' ? '+' : '−'}
                        </button>
                        <input
                          className="bal-cell num r"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={mov.monto}
                          onChange={e => editar(mov.id, { monto: e.target.value })}
                          onBlur={() => editar(mov.id, { monto: mov.monto.trim() === '' ? '' : parseNum(mov.monto).toFixed(2) })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(mov.tipo) } }}
                        />
                      </div>
                    </td>
                    <td className={`r num${saldo < 0 ? ' bal-v-salida' : ''}`}>{money(saldo)}</td>
                    <td>
                      <button className="bal-del" onClick={() => borrar(mov.id)} aria-label="Eliminar movimiento" title="Eliminar movimiento">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <datalist id="flujo-categorias">
          {categorias.map(c => <option key={c} value={c} />)}
        </datalist>

        <div className="bal-add-row">
          <button className="bal-addbtn bal-add-entrada" onClick={() => agregar('entrada')}>+ Entrada</button>
          <button className="bal-addbtn bal-add-salida" onClick={() => agregar('salida')}>− Salida</button>
        </div>
      </div>

      {vista.sinFecha.length > 0 && (
        <div className="bal-block" style={{ marginTop: 16 }}>
          <div className="bal-blockhead">
            <h2>Sin fecha</h2>
            <span className="bal-tot num">{vista.sinFecha.length}</span>
          </div>
          <div className="bal-empty-row">
            Estos movimientos no tienen fecha, así que no entran en ningún mes ni suman al saldo.
            Ponéles una fecha para que cuenten.
          </div>
          <div className="bal-table-wrap">
            <table className="bal-table">
              <tbody>
                {vista.sinFecha.map(m => (
                  <tr key={m.id}>
                    <td style={{ width: 128 }}>
                      <input type="date" className="bal-cell" value={m.fecha} onChange={e => editar(m.id, { fecha: e.target.value })} />
                    </td>
                    <td>{m.concepto || <em>Sin concepto</em>}</td>
                    <td className="r num">{money(parseNum(m.monto))}</td>
                    <td style={{ width: 30 }}>
                      <button className="bal-del" onClick={() => borrar(m.id)} aria-label="Eliminar movimiento">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bal-actions">
        {meses.length > 1 && (
          <select className="bal-act" value={mes} onChange={e => setMes(e.target.value)}>
            {meses.map(m => <option key={m} value={m}>{mesLargo(m)}</option>)}
          </select>
        )}
        <span className="bal-spacer" />
        <button className="bal-act" onClick={descargarCSV}>Descargar CSV</button>
        <button className="bal-act" onClick={() => window.print()}>Imprimir / PDF</button>
        <button
          className="bal-act bal-danger"
          onClick={() => {
            if (!vista.filas.length) { aviso('No hay movimientos de este mes para borrar.'); return }
            const ids = new Set(vista.filas.map(f => f.mov.id))
            setLibro(l => ({ ...l, movimientos: l.movimientos.filter(m => !ids.has(m.id)) }))
            aviso('Movimientos del mes eliminados.')
          }}
        >
          Vaciar el mes
        </button>
      </div>

      <p className="bal-storage-note">
        El flujo de caja se guarda por ahora en este navegador, igual que el balance.
        Cuando conectemos la base de datos va a quedar en la nube.
      </p>

      {toast && <div className="bal-toast">{toast}</div>}
    </div>
  )
}

/* Un solo dato — el saldo día a día — así que no lleva leyenda: el título ya lo
   nombra. Es la forma de "cómo vengo" que el resumen en tarjetas no muestra. */
function SaldoChart({ filas, apertura }: { filas: { mov: Movimiento; saldo: number }[]; apertura: number }) {
  const W = 800, H = 132
  const PAD = { top: 12, right: 14, bottom: 18, left: 62 }
  const PW = W - PAD.left - PAD.right
  const PH = H - PAD.top - PAD.bottom

  const puntos = [{ etiqueta: '', saldo: apertura }, ...filas.map(f => ({ etiqueta: diaCorto(f.mov.fecha), saldo: f.saldo }))]
  const valores = puntos.map(p => p.saldo)
  const vMin = Math.min(0, ...valores)
  const vMax = Math.max(0, ...valores)
  const rango = vMax - vMin || 1

  const x = (i: number) => PAD.left + (puntos.length === 1 ? PW / 2 : (i / (puntos.length - 1)) * PW)
  const y = (v: number) => PAD.top + PH - ((v - vMin) / rango) * PH

  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.saldo)}`).join(' ')
  const area = `${d} L${x(puntos.length - 1)},${y(vMin)} L${x(0)},${y(vMin)} Z`

  return (
    <div className="bal-chart" style={{ marginTop: 16 }}>
      <div className="bal-eyebrow" style={{ marginBottom: 4 }}>Saldo a lo largo del mes</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="bal-chart-svg" role="img" aria-label="Saldo de caja a lo largo del mes">
        {[vMin, vMin + rango / 2, vMax].map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + PW} y1={y(t)} y2={y(t)}
              stroke={Math.abs(t) < 0.005 ? '#CBD5E1' : '#EDF1F0'} strokeWidth="1" />
            <text x={PAD.left - 10} y={y(t) + 3.5} textAnchor="end" className="bal-chart-tick">{moneyShort(t)}</text>
          </g>
        ))}
        <path d={area} fill="#7C3AED" opacity="0.08" />
        <path d={d} fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.saldo)} r="3.5" fill="#7C3AED" stroke="white" strokeWidth="1.5">
            <title>{p.etiqueta ? `${p.etiqueta}: ${moneyShort(p.saldo)}` : `Inicio: ${moneyShort(p.saldo)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
