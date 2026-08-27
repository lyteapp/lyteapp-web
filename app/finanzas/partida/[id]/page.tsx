'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBalance } from '../../BalanceProvider'
import {
  SECCIONES, buscarPartida, money, montoPartida, nuevoDetalle, parseNum,
  type Detalle,
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
  const total = montoPartida(partida)

  function setDetalles(detalles: Detalle[]) {
    editarPartida(sec, id, { detalles })
  }

  /* Adding the first detalle carries whatever single amount the partida already
     had into it, so switching to a breakdown never silently drops a number. */
  function agregarDetalle() {
    if (!desglosado && parseNum(partida.monto)) {
      setDetalles([{ ...nuevoDetalle(), monto: parseNum(partida.monto).toFixed(2) }])
      editarPartida(sec, id, { monto: '' })
      return
    }
    setDetalles([...partida.detalles, nuevoDetalle()])
  }

  function editarDetalle(detId: string, campo: 'nombre' | 'monto', valor: string) {
    setDetalles(partida.detalles.map(d => (d.id === detId ? { ...d, [campo]: valor } : d)))
  }

  function formatearDetalle(detId: string) {
    setDetalles(partida.detalles.map(d => (
      d.id === detId ? { ...d, monto: d.monto.trim() === '' ? '' : parseNum(d.monto).toFixed(2) } : d
    )))
  }

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
            <div className="bal-rows">
              {partida.detalles.map(d => (
                <div className="bal-row" key={d.id}>
                  <input
                    className="bal-row-name"
                    placeholder="Ej: efectivo, Zelle, banco en Bs"
                    value={d.nombre}
                    onChange={e => editarDetalle(d.id, 'nombre', e.target.value)}
                  />
                  <input
                    className="bal-row-amt num"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={d.monto}
                    onChange={e => editarDetalle(d.id, 'monto', e.target.value)}
                    onBlur={() => formatearDetalle(d.id)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarDetalle() } }}
                  />
                  <button
                    className="bal-del"
                    onClick={() => borrarDetalle(d.id)}
                    aria-label="Eliminar renglón"
                    title="Eliminar renglón"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button className="bal-addbtn" onClick={agregarDetalle}>+ Agregar renglón</button>
          </div>

          <p className="bal-hint">
            Mientras haya desglose, el balance general toma la suma de estos renglones.
            Si los borrás todos, la partida vuelve a ser un monto que escribís directo.
          </p>
        </>
      ) : (
        <div className="bal-block">
          <div className="bal-blockhead">
            <h2>Monto</h2>
          </div>
          <div className="bal-capbody">
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
            <p className="bal-hint" style={{ marginTop: 12 }}>
              Esta partida es un solo monto. Si querés separarla — efectivo, Zelle,
              banco en Bs — agregá un desglose y el total se calcula solo.
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
