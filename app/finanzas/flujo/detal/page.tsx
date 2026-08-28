'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFlujo } from '../../FlujoProvider'
import { money, moneyShort, parseNum } from '../../balance'
import {
  type CierreDetal, type Libro, aUSD, diaLargo, mesDe, mesLargo, nuevoCierre, tasaDe,
} from '../model'

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function CierreAlDetal() {
  const { libro, setLibro, listo, setTasa, aviso } = useFlujo()
  const [mes, setMes] = useState('')

  // Empty until mount: the route is prerendered, so deriving it from today up
  // front would bake the build date into the HTML.
  useEffect(() => { setMes(mesDe(hoyISO())) }, [])

  const delMes = useMemo(
    () => libro.cierres.filter(c => c.fecha && mesDe(c.fecha) === mes).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [libro.cierres, mes],
  )

  const totalMes = useMemo(() => delMes.reduce((acc, c) => {
    for (const l of c.lineas) {
      const usd = aUSD(libro, parseNum(l.monto), l.metodoId, c.fecha)
      if (usd !== null) acc += usd
    }
    return acc
  }, 0), [delMes, libro])

  function agregar() {
    const fecha = mes === mesDe(hoyISO()) ? hoyISO() : `${mes}-01`
    if (libro.cierres.some(c => c.fecha === fecha)) {
      aviso('Ya hay un cierre cargado para esa fecha. Editá ese en vez de duplicarlo.')
      return
    }
    setLibro(l => ({ ...l, cierres: [...l.cierres, nuevoCierre(fecha, l.metodos)] }))
  }

  function editar(id: string, cambios: Partial<CierreDetal>) {
    setLibro(l => ({ ...l, cierres: l.cierres.map(c => (c.id === id ? { ...c, ...cambios } : c)) }))
  }

  function editarLinea(id: string, metodoId: string, monto: string) {
    setLibro(l => ({
      ...l,
      cierres: l.cierres.map(c => {
        if (c.id !== id) return c
        const existe = c.lineas.some(x => x.metodoId === metodoId)
        return {
          ...c,
          lineas: existe
            ? c.lineas.map(x => (x.metodoId === metodoId ? { ...x, monto } : x))
            : [...c.lineas, { metodoId, monto }],
        }
      }),
    }))
  }

  function borrar(id: string) {
    setLibro(l => ({ ...l, cierres: l.cierres.filter(c => c.id !== id) }))
    aviso('Cierre eliminado.')
  }

  if (!listo) return <div className="bal-loading">Cargando…</div>

  return (
    <div className="bal-wrap">
      <header className="bal-header">
        <div>
          <div className="bal-eyebrow">Lo que entró por el mostrador</div>
          <h1 className="bal-title">Cierre de caja al detal</h1>
        </div>
        <div className="bal-metafields">
          <label className="bal-field">
            <span>Mes</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 148 }} />
          </label>
          <div className="bal-field">
            <span>Total del mes</span>
            <div className="num bal-field-static">{moneyShort(totalMes)}</div>
          </div>
        </div>
      </header>

      {delMes.length === 0 ? (
        <div className="bal-block">
          <div className="bal-empty-row">
            No hay cierres cargados en {mes ? mesLargo(mes) : 'este mes'}. Agregá el primero abajo.
          </div>
          <button className="bal-addbtn" onClick={agregar}>+ Nuevo cierre</button>
        </div>
      ) : (
        <>
          {delMes.map(c => (
            <Cierre
              key={c.id}
              cierre={c}
              libro={libro}
              onTasa={setTasa}
              onEditar={editar}
              onEditarLinea={editarLinea}
              onBorrar={borrar}
            />
          ))}
          <div className="bal-actions">
            <button className="bal-act bal-primary" onClick={agregar}>+ Nuevo cierre</button>
          </div>
        </>
      )}

      <p className="bal-storage-note">
        Cada cierre se convierte a dólares con la tasa de su propia fecha, no con la de hoy.
        Si se usara la de hoy, cada movimiento del bolívar reescribiría los meses ya cerrados
        y dejarían de coincidir con lo que se contó ese día.
      </p>
    </div>
  )
}

/* Kept at module scope on purpose: declared inside the page it would be a new
   component type on every render, so React would remount it and the inputs
   would lose focus on each keystroke. */
function Cierre({ cierre, libro, onTasa, onEditar, onEditarLinea, onBorrar }: {
  cierre: CierreDetal
  libro: Libro
  onTasa: (fecha: string, valor: string) => void
  onEditar: (id: string, c: Partial<CierreDetal>) => void
  onEditarLinea: (id: string, metodoId: string, monto: string) => void
  onBorrar: (id: string) => void
}) {
  const tasa = tasaDe(libro, cierre.fecha)
  const tasaPropia = libro.tasas[cierre.fecha] ?? ''

  const necesitaTasa = libro.metodos.some(m => {
    if (m.moneda !== 'VES') return false
    const l = cierre.lineas.find(x => x.metodoId === m.id)
    return !!parseNum(l?.monto ?? '')
  })

  let total = 0
  let faltante = false
  for (const l of cierre.lineas) {
    const monto = parseNum(l.monto)
    if (!monto) continue
    const usd = aUSD(libro, monto, l.metodoId, cierre.fecha)
    if (usd === null) faltante = true
    else total += usd
  }

  return (
    <div className="bal-block" style={{ marginTop: 16 }}>
      <div className="bal-blockhead">
        <h2>{cierre.fecha ? diaLargo(cierre.fecha) : 'Sin fecha'}</h2>
        <span className="bal-tot num">{money(total)}</span>
      </div>

      <div className="bal-cierre-meta">
        <label className="bal-mini-field">
          <span>Fecha</span>
          <input type="date" value={cierre.fecha} onChange={e => onEditar(cierre.id, { fecha: e.target.value })} />
        </label>
        <label className="bal-mini-field">
          <span>Tasa Bs/USD</span>
          <input
            className="num"
            inputMode="decimal"
            placeholder={tasa ? String(tasa) : '0.00'}
            value={tasaPropia}
            onChange={e => onTasa(cierre.fecha, e.target.value)}
          />
        </label>
        <label className="bal-mini-field bal-mini-grow">
          <span>Nota</span>
          <input placeholder="Opcional" value={cierre.nota} onChange={e => onEditar(cierre.id, { nota: e.target.value })} />
        </label>
        <button className="bal-del" onClick={() => onBorrar(cierre.id)} aria-label="Eliminar cierre" title="Eliminar cierre">×</button>
      </div>

      {necesitaTasa && !tasa && (
        <div className="bal-alerta" style={{ margin: '0 16px 12px' }}>
          Falta la tasa de este día. Los montos en bolívares no se suman hasta que la cargues.
        </div>
      )}

      <div className="bal-table-wrap">
        <table className="bal-table">
          <thead>
            <tr>
              <th>Método de pago</th>
              <th className="r" style={{ width: 140 }}>Monto</th>
              <th className="r" style={{ width: 120 }}>En USD</th>
            </tr>
          </thead>
          <tbody>
            {libro.metodos.map(m => {
              const linea = cierre.lineas.find(x => x.metodoId === m.id)
              const monto = parseNum(linea?.monto ?? '')
              const usd = monto ? aUSD(libro, monto, m.id, cierre.fecha) : 0
              return (
                <tr key={m.id}>
                  <td>
                    {m.nombre}
                    <span className="bal-moneda">{m.moneda}</span>
                  </td>
                  <td className="r">
                    <input
                      className="bal-cell num r"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={linea?.monto ?? ''}
                      onChange={e => onEditarLinea(cierre.id, m.id, e.target.value)}
                      onBlur={e => onEditarLinea(cierre.id, m.id, e.target.value.trim() === '' ? '' : parseNum(e.target.value).toFixed(2))}
                    />
                  </td>
                  <td className="r num">
                    {monto === 0
                      ? <span className="bal-delta-flat">—</span>
                      : usd === null
                        ? <span className="bal-v-salida">sin tasa</span>
                        : money(usd)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {faltante && (
        <div className="bal-empty-row bal-v-salida">
          El total no incluye los montos en bolívares porque falta la tasa del día.
        </div>
      )}
    </div>
  )
}
