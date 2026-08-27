'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFlujo } from '../../FlujoProvider'
import { money, moneyShort, parseNum } from '../../balance'
import { type Cobranza, aUSD, mesDe, mesLargo, nuevaCobranza, tasaDe } from '../model'

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function CobranzasAlMayor() {
  const { libro, setLibro, listo, setTasa } = useFlujo()
  const [mes, setMes] = useState('')

  useEffect(() => { setMes(mesDe(hoyISO())) }, [])

  const delMes = useMemo(
    () => libro.cobranzas
      .filter(c => c.fecha && mesDe(c.fecha) === mes)
      .sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha))),
    [libro.cobranzas, mes],
  )

  const total = useMemo(() => delMes.reduce((acc, c) => {
    const usd = aUSD(libro, parseNum(c.monto), c.metodoId, c.fecha)
    return usd === null ? acc : acc + usd
  }, 0), [delMes, libro])

  const clientes = useMemo(
    () => [...new Set(libro.cobranzas.map(c => c.cliente.trim()).filter(Boolean))],
    [libro.cobranzas],
  )

  function agregar() {
    const fecha = mes === mesDe(hoyISO()) ? hoyISO() : `${mes}-01`
    setLibro(l => ({ ...l, cobranzas: [...l.cobranzas, nuevaCobranza(fecha, l.metodos[0]?.id ?? '')] }))
  }

  function editar(id: string, cambios: Partial<Cobranza>) {
    setLibro(l => ({ ...l, cobranzas: l.cobranzas.map(c => (c.id === id ? { ...c, ...cambios } : c)) }))
  }

  function borrar(id: string) {
    setLibro(l => ({ ...l, cobranzas: l.cobranzas.filter(c => c.id !== id) }))
  }

  if (!listo) return <div className="bal-loading">Cargando…</div>

  const sinTasa = delMes.some(c => parseNum(c.monto) && aUSD(libro, parseNum(c.monto), c.metodoId, c.fecha) === null)

  return (
    <div className="bal-wrap">
      <header className="bal-header">
        <div>
          <div className="bal-eyebrow">Lo que pagan los clientes al mayor</div>
          <h1 className="bal-title">Cobranzas al mayor</h1>
        </div>
        <div className="bal-metafields">
          <label className="bal-field">
            <span>Mes</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 148 }} />
          </label>
          <div className="bal-field">
            <span>Total del mes</span>
            <div className="num bal-field-static">{moneyShort(total)}</div>
          </div>
        </div>
      </header>

      {sinTasa && (
        <div className="bal-alerta" style={{ marginBottom: 14 }}>
          Hay cobranzas en bolívares sin tasa cargada para su fecha. No se suman al total.
          La tasa se carga en la columna de la derecha o desde el cierre de ese día.
        </div>
      )}

      <div className="bal-block">
        <div className="bal-blockhead">
          <h2>Cobranzas {mes ? `· ${mesLargo(mes)}` : ''}</h2>
          <span className="bal-tot num">{money(total)}</span>
        </div>

        {delMes.length === 0 ? (
          <div className="bal-empty-row">No hay cobranzas cargadas en este mes.</div>
        ) : (
          <div className="bal-table-wrap">
            <table className="bal-table bal-flujo-table">
              <thead>
                <tr>
                  <th style={{ width: 128 }}>Fecha</th>
                  <th>Cliente</th>
                  <th style={{ width: 150 }}>Método</th>
                  <th className="r" style={{ width: 124 }}>Monto</th>
                  <th className="r" style={{ width: 112 }}>Tasa</th>
                  <th className="r" style={{ width: 112 }}>En USD</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {delMes.map(c => {
                  const monto = parseNum(c.monto)
                  const usd = monto ? aUSD(libro, monto, c.metodoId, c.fecha) : 0
                  const esBs = libro.metodos.find(m => m.id === c.metodoId)?.moneda === 'VES'
                  return (
                    <tr key={c.id}>
                      <td><input type="date" className="bal-cell" value={c.fecha} onChange={e => editar(c.id, { fecha: e.target.value })} /></td>
                      <td>
                        <input
                          className="bal-cell"
                          list="clientes-mayor"
                          placeholder="Nombre del cliente"
                          value={c.cliente}
                          onChange={e => editar(c.id, { cliente: e.target.value })}
                        />
                      </td>
                      <td>
                        <select className="bal-cell" value={c.metodoId} onChange={e => editar(c.id, { metodoId: e.target.value })}>
                          {libro.metodos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                      </td>
                      <td className="r">
                        <input
                          className="bal-cell num r"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={c.monto}
                          onChange={e => editar(c.id, { monto: e.target.value })}
                          onBlur={() => editar(c.id, { monto: c.monto.trim() === '' ? '' : parseNum(c.monto).toFixed(2) })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
                        />
                      </td>
                      <td className="r">
                        {esBs ? (
                          <input
                            className="bal-cell num r"
                            inputMode="decimal"
                            placeholder={tasaDe(libro, c.fecha) ? String(tasaDe(libro, c.fecha)) : '—'}
                            value={libro.tasas[c.fecha] ?? ''}
                            onChange={e => setTasa(c.fecha, e.target.value)}
                          />
                        ) : <span className="bal-delta-flat">—</span>}
                      </td>
                      <td className="r num">
                        {monto === 0 ? <span className="bal-delta-flat">—</span>
                          : usd === null ? <span className="bal-v-salida">sin tasa</span>
                          : money(usd)}
                      </td>
                      <td><button className="bal-del" onClick={() => borrar(c.id)} aria-label="Eliminar cobranza">×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <datalist id="clientes-mayor">
          {clientes.map(c => <option key={c} value={c} />)}
        </datalist>

        <button className="bal-addbtn" onClick={agregar}>+ Agregar cobranza</button>
      </div>
    </div>
  )
}
