'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBalance } from '../../BalanceProvider'
import {
  MONEDAS, SECCIONES, aUSD, buscarPartida, money, montoDetalle, montoPartida,
  nominalPartida, nominalUSD, nuevoDetalle, parseNum, tasasDe,
  type Detalle, type Moneda,
} from '../../balance'

export default function PartidaPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16 removed the synchronous fallback: params is a Promise, and a client
  // component can't be async, so it gets unwrapped with use().
  const { id } = use(params)
  const { corte, listo, editarPartida, borrarPartida, aviso } = useBalance()
  const router = useRouter()

  const hallazgo = buscarPartida(corte, id)

  if (!listo) return <div className="bal-loading">Cargando…</div>

  if (!hallazgo) {
    return (
      <div className="bal-missing">
        <h1>Esta partida ya no existe.</h1>
        <p>Puede que la hayas eliminado, o que hayas abierto otro corte.</p>
        <Link href="/finanzas" className="bal-act bal-primary">Volver al balance</Link>
      </div>
    )
  }

  const { sec, partida } = hallazgo
  const seccion = SECCIONES.find(s => s.id === sec)!
  const desglosado = partida.detalles.length > 0
  const tasas = tasasDe(corte)

  const total = montoPartida(partida, tasas)
  const nominal = nominalPartida(partida, tasas)
  const merma = nominal - total

  /* Grouped by how each line settles. The consolidated total says what the
     partida is worth; this says how much of it collects in dollars, how much
     collects in bolívares, and what the official-rate settlement costs. */
  const porForma = MONEDAS.map(m => {
    const lineas = (desglosado ? partida.detalles : [partida]).filter(
      d => d.moneda === m.id && parseNum(d.monto) !== 0,
    )
    const sumar = (fn: (monto: number, moneda: Moneda) => number | null) =>
      lineas.reduce((a, d) => {
        const v = fn(parseNum(d.monto), d.moneda)
        return v === null ? a : a + v
      }, 0)
    return {
      forma: m,
      cantidad: lineas.length,
      original: lineas.reduce((a, d) => a + parseNum(d.monto), 0),
      nominal: sumar((mo, md) => nominalUSD(mo, md, tasas)),
      real: sumar((mo, md) => aUSD(mo, md, tasas)),
      faltan: lineas.some(d => aUSD(parseNum(d.monto), d.moneda, tasas) === null),
    }
  }).filter(g => g.cantidad > 0)

  function setDetalles(detalles: Detalle[]) {
    editarPartida(sec, id, { detalles })
  }

  /* Adding the first line carries the single amount and how it settles into it,
     so switching to a breakdown never silently drops or reclassifies a figure. */
  function agregarDetalle() {
    if (!desglosado && parseNum(partida.monto)) {
      setDetalles([{ ...nuevoDetalle(), monto: parseNum(partida.monto).toFixed(2), moneda: partida.moneda }])
      editarPartida(sec, id, { monto: '' })
      return
    }
    setDetalles([...partida.detalles, nuevoDetalle()])
  }

  function editarDetalle(detId: string, cambios: Partial<Detalle>) {
    setDetalles(partida.detalles.map(d => (d.id === detId ? { ...d, ...cambios } : d)))
  }

  function formatearDetalle(detId: string) {
    setDetalles(partida.detalles.map(d => (
      d.id === detId ? { ...d, monto: d.monto.trim() === '' ? '' : parseNum(d.monto).toFixed(2) } : d
    )))
  }

  function borrarDetalle(detId: string) {
    setDetalles(partida.detalles.filter(d => d.id !== detId))
  }

  const faltanTasas = (tasas.mercado <= 0) || (tasas.bcv <= 0 && porForma.some(g => g.forma.id === 'USD_BCV'))

  return (
    <div className="bal-wrap bal-detalle">
      <Link href="/finanzas" className="bal-breadcrumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        {seccion.titulo}
      </Link>

      <header className="bal-detalle-head">
        <input
          className="bal-detalle-name"
          value={partida.nombre}
          placeholder="Nombre de la partida"
          onChange={e => editarPartida(sec, id, { nombre: e.target.value })}
        />
        <div className="bal-detalle-total">
          <div className="bal-eyebrow">Valor real</div>
          <div className="bal-detalle-total-v num">{money(total)}</div>
          {merma > 0.005 && (
            <div className="bal-detalle-merma">
              nominal {money(nominal)} · se pierden {money(merma)}
            </div>
          )}
        </div>
      </header>

      <div className="bal-tasas-linea">
        <span>Tasas del corte:</span>
        <b className="num">BCV {tasas.bcv > 0 ? tasas.bcv : '—'}</b>
        <b className="num">Real {tasas.mercado > 0 ? tasas.mercado : '—'}</b>
        <Link href="/finanzas">Cambiar</Link>
      </div>

      {faltanTasas && (
        <div className="bal-alerta" style={{ marginBottom: 14 }}>
          Falta cargar una de las tasas del corte. Sin ellas, lo que se cobra en bolívares
          no se puede valorar y queda fuera del total.
        </div>
      )}

      {desglosado ? (
        <>
          <div className="bal-block">
            <div className="bal-blockhead">
              <h2>Desglose</h2>
              <span className="bal-tot num">{money(total)}</span>
            </div>
            <div className="bal-table-wrap">
              <table className="bal-table bal-desglose">
                <thead>
                  <tr>
                    <th>Renglón</th>
                    <th style={{ width: 172 }}>Se cobra en</th>
                    <th className="r" style={{ width: 124 }}>Monto</th>
                    <th className="r" style={{ width: 108 }}>Nominal</th>
                    <th className="r" style={{ width: 116 }}>Valor real</th>
                    <th style={{ width: 30 }} />
                  </tr>
                </thead>
                <tbody>
                  {partida.detalles.map(d => {
                    const monto = parseNum(d.monto)
                    const real = monto ? montoDetalle(d, tasas) : 0
                    const nom = monto ? nominalUSD(monto, d.moneda, tasas) : 0
                    const castigada = real !== null && nom !== null && nom - real > 0.005
                    return (
                      <tr key={d.id}>
                        <td>
                          <input
                            className="bal-cell"
                            placeholder="Ej: cliente, factura"
                            value={d.nombre}
                            onChange={e => editarDetalle(d.id, { nombre: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="bal-cell"
                            value={d.moneda}
                            onChange={e => editarDetalle(d.id, { moneda: e.target.value as Moneda })}
                          >
                            {MONEDAS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                          </select>
                        </td>
                        <td className="r">
                          <input
                            className="bal-cell num r"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={d.monto}
                            onChange={e => editarDetalle(d.id, { monto: e.target.value })}
                            onBlur={() => formatearDetalle(d.id)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarDetalle() } }}
                          />
                        </td>
                        <td className="r num bal-nominal">
                          {monto === 0 ? '—' : nom === null ? '—' : money(nom)}
                        </td>
                        <td className={`r num${castigada ? ' bal-v-salida' : ''}`}>
                          {monto === 0
                            ? <span className="bal-delta-flat">—</span>
                            : real === null
                              ? <span className="bal-v-salida">falta tasa</span>
                              : money(real)}
                        </td>
                        <td>
                          <button
                            className="bal-del"
                            onClick={() => borrarDetalle(d.id)}
                            aria-label="Eliminar renglón"
                            title="Eliminar renglón"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button className="bal-addbtn" onClick={agregarDetalle}>+ Agregar renglón</button>
          </div>

          {porForma.length > 1 && (
            <div className="bal-block" style={{ marginTop: 16 }}>
              <div className="bal-blockhead">
                <h2>Cómo se cobra</h2>
                <span className="bal-tot num">{money(total)}</span>
              </div>
              <div className="bal-table-wrap">
                <table className="bal-table">
                  <thead>
                    <tr>
                      <th>Forma de cobro</th>
                      <th className="r" style={{ width: 80 }}>Renglones</th>
                      <th className="r" style={{ width: 132 }}>Monto</th>
                      <th className="r" style={{ width: 104 }}>Nominal</th>
                      <th className="r" style={{ width: 116 }}>Valor real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porForma.map(g => (
                      <tr key={g.forma.id}>
                        <td>{g.forma.label}</td>
                        <td className="r num">{g.cantidad}</td>
                        <td className="r num">
                          {g.original.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {g.forma.simbolo}
                        </td>
                        <td className="r num bal-nominal">{money(g.nominal)}</td>
                        <td className="r num">
                          {money(g.real)}
                          {g.faltan && <span className="bal-tag bal-tag-baja">falta tasa</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bal-block">
          <div className="bal-blockhead"><h2>Monto</h2></div>
          <div className="bal-capbody">
            <div className="bal-monto-fila">
              <select
                className="bal-monto-moneda"
                value={partida.moneda}
                onChange={e => editarPartida(sec, id, { moneda: e.target.value as Moneda })}
              >
                {MONEDAS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <input
                className="bal-monto-directo num"
                inputMode="decimal"
                placeholder="0.00"
                value={partida.monto}
                onChange={e => editarPartida(sec, id, { monto: e.target.value })}
                onBlur={() => editarPartida(sec, id, {
                  monto: partida.monto.trim() === '' ? '' : parseNum(partida.monto).toFixed(2),
                })}
              />
            </div>

            <p className="bal-hint" style={{ marginTop: 10 }}>
              {MONEDAS.find(m => m.id === partida.moneda)?.ayuda}
            </p>

            {parseNum(partida.monto) !== 0 && partida.moneda !== 'USD' && (
              <div className="bal-equivalente">
                <span>Valor real</span>
                <b className="num">
                  {aUSD(parseNum(partida.monto), partida.moneda, tasas) === null
                    ? 'falta la tasa'
                    : money(aUSD(parseNum(partida.monto), partida.moneda, tasas)!)}
                </b>
              </div>
            )}

            <p className="bal-hint" style={{ marginTop: 12 }}>
              Si querés separarla — un renglón por cliente, o por forma de cobro —
              agregá un desglose y el total se calcula solo.
            </p>
            <button className="bal-act" onClick={agregarDetalle}>Agregar desglose</button>
          </div>
        </div>
      )}

      <div className="bal-actions">
        <Link href="/finanzas" className="bal-act bal-primary">Volver al balance</Link>
        <span className="bal-spacer" />
        <button
          className="bal-act bal-danger"
          onClick={() => {
            borrarPartida(sec, id)
            aviso('Partida eliminada.')
            router.push('/finanzas')
          }}
        >
          Eliminar partida
        </button>
      </div>
    </div>
  )
}
