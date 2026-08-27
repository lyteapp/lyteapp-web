'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useFlujo } from '../FlujoProvider'
import { money, moneyShort, parseNum } from '../balance'
import {
  ETIQUETA_ORIGEN, type Origen, diaCorto, mesDe, mesLargo, mesesConDatos, metodoDe, resumenMes,
} from './model'

const hoyISO = () => new Date().toISOString().slice(0, 10)

const FUENTES: { origen: Origen; href: string; titulo: string; sentido: 'entrada' | 'salida' }[] = [
  { origen: 'detal', href: '/finanzas/flujo/detal',  titulo: 'Cierre al detal',    sentido: 'entrada' },
  { origen: 'mayor', href: '/finanzas/flujo/mayor',  titulo: 'Cobranzas al mayor', sentido: 'entrada' },
  { origen: 'gasto', href: '/finanzas/flujo/gastos', titulo: 'Gastos',             sentido: 'salida'  },
]

export default function FlujoResumen() {
  const { libro, setLibro, listo } = useFlujo()
  const [mes, setMes] = useState('')

  // Empty until mount: the route is prerendered, so today's date can't be baked in.
  useEffect(() => { setMes(mesDe(hoyISO())) }, [])

  const r = useMemo(() => (mes ? resumenMes(libro, mes) : null), [libro, mes])

  const meses = useMemo(() => {
    const conDatos = mesesConDatos(libro)
    return mes && !conDatos.includes(mes) ? [mes, ...conDatos] : conDatos
  }, [libro, mes])

  if (!listo || !r) return <div className="bal-loading">Cargando…</div>

  const neto = r.entradas - r.salidas
  const negativo = r.saldoFinal < 0

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
              style={{ width: 128, textAlign: 'right' }}
            />
          </label>
        </div>
      </header>

      <section className="bal-summary">
        <div className="bal-eyebrow" style={{ marginBottom: 10 }}>{mes ? mesLargo(mes) : ''}</div>

        <div className="bal-cards bal-cards-4">
          <div className="bal-card">
            <div className="bal-eyebrow">Saldo inicial</div>
            <div className="bal-card-v num">{moneyShort(r.saldoApertura)}</div>
            <div className="bal-card-foot"><span className="bal-card-from">arrastrado de meses anteriores</span></div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-entrada" /><span className="bal-eyebrow">Entradas</span></div>
            <div className="bal-card-v num bal-v-entrada">{moneyShort(r.entradas)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-salida" /><span className="bal-eyebrow">Salidas</span></div>
            <div className="bal-card-v num bal-v-salida">{moneyShort(r.salidas)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-eyebrow">Saldo final</div>
            <div className={`bal-card-v num${negativo ? ' bal-v-salida' : ''}`}>{moneyShort(r.saldoFinal)}</div>
            <div className="bal-card-foot">
              {neto === 0
                ? <span className="bal-delta-flat">sin movimiento neto</span>
                : <span className={neto > 0 ? 'bal-delta-up' : 'bal-delta-down'}>
                    {neto > 0 ? '↑' : '↓'} {moneyShort(Math.abs(neto))} en el mes
                  </span>}
            </div>
          </div>
        </div>

        {r.sinTasa.length > 0 && (
          <div className="bal-alerta">
            Hay {r.sinTasa.length} {r.sinTasa.length === 1 ? 'monto' : 'montos'} en bolívares sin tasa cargada para su
            fecha. No están incluidos en ninguno de los totales de arriba.
          </div>
        )}

        {negativo && r.sinTasa.length === 0 && (
          <div className="bal-alerta">
            El saldo final queda en negativo. Suele significar que falta cargar el saldo inicial histórico.
          </div>
        )}
      </section>

      {/* ── DE DÓNDE VIENE ── */}
      <div className="bal-fuentes">
        {FUENTES.map(f => (
          <Link href={f.href} className="bal-fuente" key={f.origen}>
            <div className="bal-eyebrow">{f.titulo}</div>
            <div className={`bal-fuente-v num ${f.sentido === 'entrada' ? 'bal-v-entrada' : 'bal-v-salida'}`}>
              {f.sentido === 'entrada' ? '+' : '−'}{moneyShort(r.porOrigen[f.origen])}
            </div>
            <div className="bal-fuente-link">Abrir</div>
          </Link>
        ))}
      </div>

      {/* ── MOVIMIENTOS ── */}
      <div className="bal-block" style={{ marginTop: 18 }}>
        <div className="bal-blockhead">
          <h2>Movimientos del mes</h2>
          <span className="bal-tot num">{money(r.saldoFinal)}</span>
        </div>

        {r.lineas.length === 0 ? (
          <div className="bal-empty-row">
            Todavía no hay nada cargado en este mes. Empezá por el cierre al detal o por los gastos.
          </div>
        ) : (
          <div className="bal-table-wrap">
            <table className="bal-table">
              <thead>
                <tr>
                  <th style={{ width: 76 }}>Fecha</th>
                  <th style={{ width: 132 }}>Origen</th>
                  <th>Detalle</th>
                  <th style={{ width: 120 }}>Método</th>
                  <th className="r" style={{ width: 116 }}>Monto USD</th>
                  <th className="r" style={{ width: 112 }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {r.lineas.map(({ linea, saldo }) => (
                  <tr key={linea.id}>
                    <td>{diaCorto(linea.fecha)}</td>
                    <td><span className={`bal-origen bal-origen-${linea.origen}`}>{ETIQUETA_ORIGEN[linea.origen]}</span></td>
                    <td>{linea.descripcion}</td>
                    <td className="bal-metodo-col">{metodoDe(libro, linea.metodoId)?.nombre ?? '—'}</td>
                    <td className={`r num ${linea.tipo === 'entrada' ? 'bal-v-entrada' : 'bal-v-salida'}`}>
                      {linea.tipo === 'entrada' ? '+' : '−'}{money(linea.usd ?? 0).replace('$', '$')}
                    </td>
                    <td className={`r num${saldo < 0 ? ' bal-v-salida' : ''}`}>{money(saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {r.sinTasa.length > 0 && (
        <div className="bal-block" style={{ marginTop: 16 }}>
          <div className="bal-blockhead">
            <h2>Sin tasa de cambio</h2>
            <span className="bal-tot num">{r.sinTasa.length}</span>
          </div>
          <div className="bal-empty-row">
            Montos en bolívares cuya fecha no tiene tasa cargada. No suman a ningún total hasta que la pongas.
          </div>
          <div className="bal-table-wrap">
            <table className="bal-table">
              <tbody>
                {r.sinTasa.map(l => (
                  <tr key={l.id}>
                    <td style={{ width: 76 }}>{diaCorto(l.fecha)}</td>
                    <td><span className={`bal-origen bal-origen-${l.origen}`}>{ETIQUETA_ORIGEN[l.origen]}</span></td>
                    <td>{l.descripcion}</td>
                    <td className="r num">{l.monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</td>
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
        <Link href="/finanzas/flujo/detal" className="bal-act">Cierre al detal</Link>
        <Link href="/finanzas/flujo/mayor" className="bal-act">Cobranzas</Link>
        <Link href="/finanzas/flujo/gastos" className="bal-act">Gastos</Link>
      </div>

      <p className="bal-storage-note">
        Todo se consolida en dólares con la tasa de cada fecha. El flujo de caja se guarda por
        ahora en este navegador, igual que el balance.
      </p>
    </div>
  )
}
