'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SeccionId = 'ac' | 'anc' | 'pc' | 'pnc'

// `monto` stays a raw string so the field can hold whatever the user is
// mid-typing; parseNum() is the single place that turns it into a number.
type Partida = { id: string; nombre: string; monto: string }

type Corte = {
  empresa: string
  fecha: string
  capitalManual: string | null
  ac: Partida[]
  anc: Partida[]
  pc: Partida[]
  pnc: Partida[]
}

const SECCIONES: { id: SeccionId; titulo: string; lado: 'activo' | 'pasivo' }[] = [
  { id: 'ac',  titulo: 'Activos corrientes',     lado: 'activo' },
  { id: 'anc', titulo: 'Activos no corrientes',  lado: 'activo' },
  { id: 'pc',  titulo: 'Pasivos corrientes',     lado: 'pasivo' },
  { id: 'pnc', titulo: 'Pasivos no corrientes',  lado: 'pasivo' },
]

const CLAVE = 'lyte:balance-general:cortes'

const nuevaPartida = (): Partida => ({
  id: Math.random().toString(36).slice(2),
  nombre: '',
  monto: '',
})

// `fecha` starts empty on purpose: this page is prerendered, so seeding it with
// new Date() would bake the build date into the HTML and then disagree with the
// client's date at hydration. It gets filled in on mount instead.
const corteVacio = (): Corte => ({
  empresa: '',
  fecha: '',
  capitalManual: null,
  ac:  [nuevaPartida()],
  anc: [nuevaPartida()],
  pc:  [nuevaPartida()],
  pnc: [nuevaPartida()],
})

const hoy = () => new Date().toISOString().slice(0, 10)

/* Accepts both 1.234,56 and 1,234.56 — whichever separator appears last is
   treated as the decimal one. */
function parseNum(txt: string | null | undefined): number {
  if (txt == null) return 0
  const t = String(txt).replace(/[^0-9,.\-]/g, '').trim()
  if (!t) return 0
  const lastC = t.lastIndexOf(','), lastD = t.lastIndexOf('.')
  const norm = lastC > lastD
    ? t.replace(/\./g, '').replace(',', '.')
    : t.replace(/,/g, '')
  const v = parseFloat(norm)
  return isFinite(v) ? v : 0
}

function money(n: number): string {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '−$' : '$') + s
}

function moneyShort(n: number): string {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return (n < 0 ? '−$' : '$') + s
}

function fechaLarga(iso: string): string {
  const p = iso.split('-')
  if (p.length !== 3) return iso || 'Sin fecha'
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(p[2], 10)} de ${meses[parseInt(p[1], 10) - 1] ?? p[1]} ${p[0]}`
}

function leerCortes(): Record<string, Corte> {
  try {
    const raw = localStorage.getItem(CLAVE)
    return raw ? (JSON.parse(raw) as Record<string, Corte>) : {}
  } catch {
    return {}
  }
}

export default function BalanceGeneral() {
  const [corte, setCorte] = useState<Corte>(corteVacio)
  const [cortes, setCortes] = useState<Record<string, Corte>>({})
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCortes(leerCortes())
    setCorte(c => (c.fecha ? c : { ...c, fecha: hoy() }))
  }, [])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const aviso = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  /* ── totales ── */
  const totales = useMemo(() => {
    const suma = (rows: Partida[]) => rows.reduce((acc, r) => acc + parseNum(r.monto), 0)
    const ac = suma(corte.ac), anc = suma(corte.anc)
    const pc = suma(corte.pc), pnc = suma(corte.pnc)
    const activos = ac + anc
    const pasivos = pc + pnc
    const manual = corte.capitalManual !== null
    const capital = manual ? parseNum(corte.capitalManual) : activos - pasivos
    const base = Math.abs(pasivos) + Math.abs(capital)
    const pctPasivo = base ? (Math.abs(pasivos) / base) * 100 : 0
    return {
      ac, anc, pc, pnc, activos, pasivos, capital, manual,
      pctPasivo,
      pctCapital: 100 - pctPasivo,
      descuadre: activos - (pasivos + capital),
      capitalTrabajo: ac - pc,
      razonCorriente: pc ? ac / pc : null,
      endeudamiento: activos ? (pasivos / activos) * 100 : null,
    }
  }, [corte])

  const totalDe = (id: SeccionId) => totales[id]

  /* ── edición de partidas ── */
  function editarPartida(sec: SeccionId, id: string, campo: 'nombre' | 'monto', valor: string) {
    setCorte(c => ({ ...c, [sec]: c[sec].map(p => (p.id === id ? { ...p, [campo]: valor } : p)) }))
  }

  function formatearMonto(sec: SeccionId, id: string) {
    setCorte(c => ({
      ...c,
      [sec]: c[sec].map(p => {
        if (p.id !== id) return p
        return { ...p, monto: p.monto.trim() === '' ? '' : parseNum(p.monto).toFixed(2) }
      }),
    }))
  }

  function agregarPartida(sec: SeccionId) {
    setCorte(c => ({ ...c, [sec]: [...c[sec], nuevaPartida()] }))
  }

  function borrarPartida(sec: SeccionId, id: string) {
    setCorte(c => ({ ...c, [sec]: c[sec].filter(p => p.id !== id) }))
  }

  /* ── cortes guardados ── */
  function guardar() {
    if (!corte.fecha) { aviso('Ponle una fecha de corte antes de guardar.'); return }
    const next = { ...cortes, [corte.fecha]: corte }
    try {
      localStorage.setItem(CLAVE, JSON.stringify(next))
      setCortes(next)
      aviso(`Corte del ${fechaLarga(corte.fecha)} guardado.`)
    } catch {
      aviso('No se pudo guardar. Descarga el CSV para no perder el trabajo.')
    }
  }

  function abrir(fecha: string) {
    const c = cortes[fecha]
    if (!c) return
    setCorte(c)
    aviso(`Abriste el corte del ${fechaLarga(fecha)}.`)
  }

  function eliminar() {
    if (!corte.fecha || !cortes[corte.fecha]) { aviso('No hay un corte guardado con esa fecha.'); return }
    const next = { ...cortes }
    delete next[corte.fecha]
    try {
      localStorage.setItem(CLAVE, JSON.stringify(next))
      setCortes(next)
      aviso(`Se eliminó el corte del ${fechaLarga(corte.fecha)}.`)
    } catch {
      aviso('No se pudo eliminar.')
    }
  }

  function empezarEnBlanco() {
    setCorte(c => ({ ...corteVacio(), empresa: c.empresa, fecha: c.fecha }))
    aviso('Listo, tienes un balance en blanco.')
  }

  /* ── exportar ── */
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
    lineas.push(['Sección', 'Partida', 'Monto USD'].map(campo).join(','))

    for (const s of SECCIONES) {
      for (const p of corte[s.id]) {
        if (!p.nombre && !parseNum(p.monto)) continue
        lineas.push([s.titulo, p.nombre, parseNum(p.monto).toFixed(2)].map(campo).join(','))
      }
      lineas.push([`${s.titulo} — total`, '', totalDe(s.id).toFixed(2)].map(campo).join(','))
    }

    lineas.push('')
    lineas.push(['TOTAL ACTIVOS', '', totales.activos.toFixed(2)].map(campo).join(','))
    lineas.push(['TOTAL PASIVOS', '', totales.pasivos.toFixed(2)].map(campo).join(','))
    lineas.push(['CAPITAL', '', totales.capital.toFixed(2)].map(campo).join(','))

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
  const cuadra = Math.abs(totales.descuadre) < 0.005

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
            <div className="bal-card-v num">{moneyShort(totales.activos)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-pasivo" /><span className="bal-eyebrow">Total pasivos</span></div>
            <div className="bal-card-v num">{moneyShort(totales.pasivos)}</div>
          </div>
          <div className="bal-card">
            <div className="bal-card-k"><span className="bal-dot bal-dot-capital" /><span className="bal-eyebrow">Capital</span></div>
            <div className="bal-card-v num">{moneyShort(totales.capital)}</div>
          </div>
        </div>

        <div className="bal-beam">
          <div className="bal-eyebrow">Cómo se financian los activos</div>
          <div className="bal-beambar">
            <span className="bal-beam-p" style={{ width: `${totales.pctPasivo.toFixed(2)}%` }} />
            <span className="bal-beam-c" style={{ width: `${totales.pctCapital.toFixed(2)}%` }} />
          </div>
          <div className="bal-beamlegend">
            <span><span className="bal-dot bal-dot-pasivo" /> Deuda de terceros <b className="num">{totales.pctPasivo.toFixed(1)}%</b></span>
            <span><span className="bal-dot bal-dot-capital" /> Capital propio <b className="num">{totales.pctCapital.toFixed(1)}%</b></span>
          </div>
        </div>

        <div className="bal-ratios">
          <div className="bal-ratio">
            <div className="bal-eyebrow">Capital de trabajo</div>
            <div className="bal-ratio-v num">{moneyShort(totales.capitalTrabajo)}</div>
            <div className="bal-ratio-h">Activo corriente − pasivo corriente</div>
          </div>
          <div className="bal-ratio">
            <div className="bal-eyebrow">Razón corriente</div>
            <div className="bal-ratio-v num">{totales.razonCorriente !== null ? totales.razonCorriente.toFixed(2) : '—'}</div>
            <div className="bal-ratio-h">Veces que cubres la deuda de corto plazo</div>
          </div>
          <div className="bal-ratio">
            <div className="bal-eyebrow">Endeudamiento</div>
            <div className="bal-ratio-v num">{totales.endeudamiento !== null ? `${totales.endeudamiento.toFixed(1)}%` : '—'}</div>
            <div className="bal-ratio-h">Pasivos sobre activos</div>
          </div>
        </div>
      </section>

      {/* ── LIBRO ── */}
      <div className="bal-ledger">
        <div className="bal-col">
          {SECCIONES.filter(s => s.lado === 'activo').map(sec => (
            <Bloque
              key={sec.id}
              sec={sec}
              partidas={corte[sec.id]}
              total={totalDe(sec.id)}
              onEditar={editarPartida}
              onFormatear={formatearMonto}
              onBorrar={borrarPartida}
              onAgregar={agregarPartida}
            />
          ))}
        </div>

        <div className="bal-col">
          {SECCIONES.filter(s => s.lado === 'pasivo').map(sec => (
            <Bloque
              key={sec.id}
              sec={sec}
              partidas={corte[sec.id]}
              total={totalDe(sec.id)}
              onEditar={editarPartida}
              onFormatear={formatearMonto}
              onBorrar={borrarPartida}
              onAgregar={agregarPartida}
            />
          ))}

          <div className="bal-block bal-side-capital">
            <div className="bal-blockhead">
              <h2>Capital</h2>
            </div>
            <div className="bal-capbody">
              <div className="bal-capval num">{money(totales.capital)}</div>
              <div className="bal-capnote">
                {totales.manual
                  ? 'Capital registrado a mano. El cuadre compara activos contra pasivos más capital.'
                  : 'Calculado como activos totales menos pasivos totales.'}
              </div>

              <label className="bal-switch">
                <input
                  type="checkbox"
                  checked={totales.manual}
                  onChange={e => setCorte(c => ({
                    ...c,
                    capitalManual: e.target.checked
                      ? (totales.activos - totales.pasivos).toFixed(2)
                      : null,
                  }))}
                />
                Registrar el capital manualmente y verificar el cuadre
              </label>

              {totales.manual && (
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
                    <b className="num">{money(totales.descuadre)}</b>
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
        <select
          className="bal-act"
          value=""
          onChange={e => { if (e.target.value) abrir(e.target.value) }}
        >
          <option value="">
            {fechasGuardadas.length ? 'Abrir corte guardado…' : 'No hay cortes guardados'}
          </option>
          {fechasGuardadas.map(f => <option key={f} value={f}>{fechaLarga(f)}</option>)}
        </select>
        <button className="bal-act" onClick={eliminar}>Eliminar corte</button>
        <span className="bal-spacer" />
        <button className="bal-act" onClick={descargarCSV}>Descargar CSV</button>
        <button className="bal-act" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="bal-act" onClick={empezarEnBlanco}>Empezar en blanco</button>
      </div>

      <p className="bal-storage-note">
        Los cortes se guardan por ahora en este navegador. Cuando conectemos la base de
        datos van a quedar en la nube y los vas a ver desde cualquier dispositivo.
      </p>

      {toast && <div className="bal-toast">{toast}</div>}
    </div>
  )
}

function Bloque({
  sec, partidas, total, onEditar, onFormatear, onBorrar, onAgregar,
}: {
  sec: { id: SeccionId; titulo: string; lado: 'activo' | 'pasivo' }
  partidas: Partida[]
  total: number
  onEditar: (sec: SeccionId, id: string, campo: 'nombre' | 'monto', valor: string) => void
  onFormatear: (sec: SeccionId, id: string) => void
  onBorrar: (sec: SeccionId, id: string) => void
  onAgregar: (sec: SeccionId) => void
}) {
  return (
    <div className={`bal-block bal-side-${sec.lado}`}>
      <div className="bal-blockhead">
        <h2>{sec.titulo}</h2>
        <span className="bal-tot num">{money(total)}</span>
      </div>
      <div className="bal-rows">
        {partidas.map(p => (
          <div className="bal-row" key={p.id}>
            <input
              className="bal-row-name"
              placeholder="Nombre de la partida"
              value={p.nombre}
              onChange={e => onEditar(sec.id, p.id, 'nombre', e.target.value)}
            />
            <input
              className="bal-row-amt num"
              inputMode="decimal"
              placeholder="0.00"
              value={p.monto}
              onChange={e => onEditar(sec.id, p.id, 'monto', e.target.value)}
              onBlur={() => onFormatear(sec.id, p.id)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAgregar(sec.id) } }}
            />
            <button
              className="bal-del"
              onClick={() => onBorrar(sec.id, p.id)}
              aria-label="Eliminar partida"
              title="Eliminar partida"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="bal-addbtn" onClick={() => onAgregar(sec.id)}>+ Agregar partida</button>
    </div>
  )
}
