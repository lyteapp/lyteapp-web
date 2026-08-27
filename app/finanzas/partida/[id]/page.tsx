'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBalance } from '../../BalanceProvider'
import {
  MONEDAS, SECCIONES, buscarPartida, money, montoDetalle, montoPartida, nuevoDetalle,
  parseNum, tasaEfectiva, aUSD,
  type Detalle, type Moneda,
} from '../../balance'

export default function PartidaPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16 removed the synchronous fallback: params is a Promise, and a client
  // component can't be async, so it gets unwrapped with use().
  const { id } = use(params)
  const { corte, listo, editarPartida, borrarPartida, aviso } = useBalance()
  const router = useRouter()

  const hallazgo = buscarPartida(corte, id)

  if (!listo) {
    return <div className="bal-loading">Cargando…</div>
  }

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
  const tasaCorte = parseNum(corte.tasa)
  const total = montoPartida(partida, tasaCorte)

  function setDetalles(detalles: Detalle[]) {
    editarPartida(sec, id, { detalles })
  }

  /* Adding the first detalle carries whatever single amount the partida already
     had into it, so switching to a breakdown never silently drops a number. */
  function agregarDetalle() {
    if (!desglosado && parseNum(partida.monto)) {
      setDetalles([detalleDesdeMonto()])
      editarPartida(sec, id, { monto: '', tasa: '' })
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

  /* Carries the currency over so a breakdown born from a single amount doesn't
     silently become dollars. */
  const detalleDesdeMonto = (): Detalle => ({
    ...nuevoDetalle(),
    monto: parseNum(partida.monto).toFixed(2),
    moneda: partida.moneda,
    tasa: partida.tasa,
  })

  function borrarDetalle(detId: string) {
    setDetalles(partida.detalles.filter(d => d.id !== detId))
  }

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
          <div className="bal-eyebrow">Total</div>
          <div className="bal-detalle-total-v num">{money(total)}</div>
        </div>
      </header>

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
                    <th style={{ width: 108 }}>Moneda</th>
                    <th className="r" style={{ width: 124 }}>Monto</th>
                    <th className="r" style={{ width: 112 }}>Tasa</th>
                    <th className="r" style={{ width: 112 }}>En USD</th>
                    <th style={{ width: 30 }} />
                  </tr>
                </thead>
                <tbody>
                  {partida.detalles.map(d => {
                    const monto = parseNum(d.monto)
                    const usd = monto ? montoDetalle(d, tasaCorte) : 0
                    const convierte = d.moneda === 'VES'
                    return (
                      <tr key={d.id}>
                        <td>
                          <input
                            className="bal-cell"
                            placeholder="Ej: efectivo en dólares, banco BNC"
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
                        <td className="r">
                          {convierte ? (
                            <input
                              className="bal-cell num r"
                              inputMode="decimal"
                              placeholder={tasaCorte ? String(tasaCorte) : 'Bs/USD'}
                              value={d.tasa}
                              onChange={e => editarDetalle(d.id, { tasa: e.target.value })}
                            />
                          ) : <span className="bal-delta-flat">—</span>}
                        </td>
                        <td className="r num">
                          {monto === 0
                            ? <span className="bal-delta-flat">—</span>
                            : usd === null
                              ? <span className="bal-v-salida">falta tasa</span>
                              : money(usd)}
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

          <p className="bal-hint">
            Lo que está en dólares se toma tal cual. Lo que está en bolívares se divide por
            la tasa: la de su propio renglón si la ponés, y si no la del corte
            {tasaCorte ? ` (${tasaCorte} Bs/USD)` : ', que todavía no cargaste'}.
            Un monto en bolívares sin tasa no se suma — aparece como “falta tasa” en vez de
            colarse al total como si fuera cero.
          </p>
        </>
      ) : (
        <div className="bal-block">
          <div className="bal-blockhead">
            <h2>Monto</h2>
          </div>
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

            {partida.moneda === 'VES' && (
              <div className="bal-monto-fila" style={{ marginTop: 10 }}>
                <span className="bal-monto-etiqueta">Tasa Bs/USD</span>
                <input
                  className="bal-monto-directo num"
                  inputMode="decimal"
                  placeholder={tasaCorte ? String(tasaCorte) : 'Sin tasa del corte'}
                  value={partida.tasa}
                  onChange={e => editarPartida(sec, id, { tasa: e.target.value })}
                />
              </div>
            )}

            {partida.moneda === 'VES' && (
              <div className="bal-equivalente">
                <span>Equivale a</span>
                <b className="num">
                  {!parseNum(partida.monto)
                    ? '—'
                    : tasaEfectiva(partida.tasa, tasaCorte) > 0
                      ? money(aUSD(parseNum(partida.monto), 'VES', partida.tasa, tasaCorte)!)
                      : 'falta la tasa'}
                </b>
              </div>
            )}

            <p className="bal-hint" style={{ marginTop: 12 }}>
              Esta partida es un solo monto. Si querés separarla — efectivo en dólares,
              banco BNC en bolívares, Zelle — agregá un desglose y el total se calcula solo.
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
