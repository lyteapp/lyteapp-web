'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFlujo } from '../../FlujoProvider'
import { money, moneyShort, parseNum } from '../../balance'
import { CATEGORIAS_GASTO, type Gasto, aUSD, mesDe, mesLargo, nuevoGasto, tasaDe } from '../model'

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function Gastos() {
  const { libro, setLibro, listo, setTasa } = useFlujo()
  const [mes, setMes] = useState('')

  useEffect(() => { setMes(mesDe(hoyISO())) }, [])

  const delMes = useMemo(
    () => libro.gastos
      .filter(g => g.fecha && mesDe(g.fecha) === mes)
      .sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha))),
    [libro.gastos, mes],
  )

  const total = useMemo(() => delMes.reduce((acc, g) => {
    const usd = aUSD(libro, parseNum(g.monto), g.metodoId, g.fecha)
    return usd === null ? acc : acc + usd
  }, 0), [delMes, libro])

  /* Ordered by weight so the biggest line of the month is the first thing read. */
  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const g of delMes) {
      const usd = aUSD(libro, parseNum(g.monto), g.metodoId, g.fecha)
      if (usd === null) continue
      const k = g.categoria.trim() || 'Sin categoría'
      mapa.set(k, (mapa.get(k) ?? 0) + usd)
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [delMes, libro])

  const categorias = useMemo(
    () => [...new Set([...libro.gastos.map(g => g.categoria.trim()).filter(Boolean), ...CATEGORIAS_GASTO])],
    [libro.gastos],
  )

  function agregar() {
    const fecha = mes === mesDe(hoyISO()) ? hoyISO() : `${mes}-01`
    setLibro(l => ({ ...l, gastos: [...l.gastos, nuevoGasto(fecha, l.metodos[0]?.id ?? '')] }))
  }

  function editar(id: string, cambios: Partial<Gasto>) {
    setLibro(l => ({ ...l, gastos: l.gastos.map(g => (g.id === id ? { ...g, ...cambios } : g)) }))
  }

  function borrar(id: string) {
    setLibro(l => ({ ...l, gastos: l.gastos.filter(g => g.id !== id) }))
  }

  if (!listo) return <div className="bal-loading">Cargando…</div>

  const maxCat = Math.max(...porCategoria.map(c => c[1]), 1)

  return (
    <div className="bal-wrap">
      <header className="bal-header">
        <div>
          <div className="bal-eyebrow">Lo que sale de la caja</div>
          <h1 className="bal-title">Gastos</h1>
        </div>
        <div className="bal-metafields">
          <label className="bal-field">
            <span>Mes</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 148 }} />
          </label>
          <div className="bal-field">
            <span>Total del mes</span>
            <div className="num bal-field-static bal-v-salida">{moneyShort(total)}</div>
          </div>
        </div>
      </header>

      {porCategoria.length > 0 && (
        <section className="bal-summary">
          <div className="bal-eyebrow" style={{ marginBottom: 10 }}>En qué se fue el dinero</div>
          <div className="bal-catbars">
            {porCategoria.map(([nombre, monto]) => (
              <div className="bal-catbar" key={nombre}>
                <div className="bal-catbar-name">{nombre}</div>
                <div className="bal-catbar-track">
                  <div className="bal-catbar-fill" style={{ width: `${(monto / maxCat) * 100}%` }} />
                </div>
                <div className="bal-catbar-v num">{moneyShort(monto)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bal-block">
        <div className="bal-blockhead">
          <h2>Gastos {mes ? `· ${mesLargo(mes)}` : ''}</h2>
          <span className="bal-tot num bal-v-salida">{money(total)}</span>
        </div>

        {delMes.length === 0 ? (
          <div className="bal-empty-row">No hay gastos cargados en este mes.</div>
        ) : (
          <div className="bal-table-wrap">
            <table className="bal-table bal-flujo-table">
              <thead>
                <tr>
                  <th style={{ width: 128 }}>Fecha</th>
                  <th>Concepto</th>
                  <th style={{ width: 144 }}>Categoría</th>
                  <th style={{ width: 138 }}>Método</th>
                  <th className="r" style={{ width: 120 }}>Monto</th>
                  <th className="r" style={{ width: 108 }}>Tasa</th>
                  <th className="r" style={{ width: 108 }}>En USD</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {delMes.map(g => {
                  const monto = parseNum(g.monto)
                  const usd = monto ? aUSD(libro, monto, g.metodoId, g.fecha) : 0
                  const esBs = libro.metodos.find(m => m.id === g.metodoId)?.moneda === 'VES'
                  return (
                    <tr key={g.id}>
                      <td><input type="date" className="bal-cell" value={g.fecha} onChange={e => editar(g.id, { fecha: e.target.value })} /></td>
                      <td>
                        <input
                          className="bal-cell"
                          placeholder="Ej: pago a proveedor"
                          value={g.concepto}
                          onChange={e => editar(g.id, { concepto: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="bal-cell"
                          list="categorias-gasto"
                          placeholder="Categoría"
                          value={g.categoria}
                          onChange={e => editar(g.id, { categoria: e.target.value })}
                        />
                      </td>
                      <td>
                        <select className="bal-cell" value={g.metodoId} onChange={e => editar(g.id, { metodoId: e.target.value })}>
                          {libro.metodos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                      </td>
                      <td className="r">
                        <input
                          className="bal-cell num r"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={g.monto}
                          onChange={e => editar(g.id, { monto: e.target.value })}
                          onBlur={() => editar(g.id, { monto: g.monto.trim() === '' ? '' : parseNum(g.monto).toFixed(2) })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
                        />
                      </td>
                      <td className="r">
                        {esBs ? (
                          <input
                            className="bal-cell num r"
                            inputMode="decimal"
                            placeholder={tasaDe(libro, g.fecha) ? String(tasaDe(libro, g.fecha)) : '—'}
                            value={libro.tasas[g.fecha] ?? ''}
                            onChange={e => setTasa(g.fecha, e.target.value)}
                          />
                        ) : <span className="bal-delta-flat">—</span>}
                      </td>
                      <td className="r num">
                        {monto === 0 ? <span className="bal-delta-flat">—</span>
                          : usd === null ? <span className="bal-v-salida">sin tasa</span>
                          : money(usd)}
                      </td>
                      <td><button className="bal-del" onClick={() => borrar(g.id)} aria-label="Eliminar gasto">×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <datalist id="categorias-gasto">
          {categorias.map(c => <option key={c} value={c} />)}
        </datalist>

        <button className="bal-addbtn bal-add-salida" onClick={agregar}>+ Agregar gasto</button>
      </div>
    </div>
  )
}
