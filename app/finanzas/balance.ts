/* Shared model and pure helpers for the balance general. Lives apart from the
   pages because the sheet, the sidebar tree and each partida's detail page all
   need to agree on how a partida's amount is derived. */

export type SeccionId = 'ac' | 'anc' | 'pc' | 'pnc'

/* Amounts stay raw strings so a field can hold whatever is mid-typing;
   parseNum() is the single place that turns one into a number. */
export type Detalle = { id: string; nombre: string; monto: string }

/* A partida is either a single amount typed straight into the sheet, or a
   breakdown that adds up. `detalles` being non-empty is what decides which:
   once there is a breakdown, `monto` is ignored. */
export type Partida = { id: string; nombre: string; monto: string; detalles: Detalle[] }

export type Corte = {
  empresa: string
  fecha: string
  capitalManual: string | null
  ac: Partida[]
  anc: Partida[]
  pc: Partida[]
  pnc: Partida[]
}

export const SECCIONES: { id: SeccionId; titulo: string; corto: string; lado: 'activo' | 'pasivo' }[] = [
  { id: 'ac',  titulo: 'Activos corrientes',    corto: 'Act. corrientes',    lado: 'activo' },
  { id: 'anc', titulo: 'Activos no corrientes', corto: 'Act. no corrientes', lado: 'activo' },
  { id: 'pc',  titulo: 'Pasivos corrientes',    corto: 'Pas. corrientes',    lado: 'pasivo' },
  { id: 'pnc', titulo: 'Pasivos no corrientes', corto: 'Pas. no corrientes', lado: 'pasivo' },
]

export const IDS: SeccionId[] = ['ac', 'anc', 'pc', 'pnc']

let contador = 0
export const nuevoId = () => `p${Date.now().toString(36)}${(contador++).toString(36)}`

export const nuevaPartida = (): Partida => ({ id: nuevoId(), nombre: '', monto: '', detalles: [] })
export const nuevoDetalle = (): Detalle => ({ id: nuevoId(), nombre: '', monto: '' })

/* `fecha` starts empty on purpose: the sheet is prerendered, so seeding it with
   new Date() would bake the build date into the HTML and then disagree with the
   client's date at hydration. Pages fill it in on mount. */
export const corteVacio = (): Corte => ({
  empresa: '',
  fecha: '',
  capitalManual: null,
  ac: [nuevaPartida()],
  anc: [nuevaPartida()],
  pc: [nuevaPartida()],
  pnc: [nuevaPartida()],
})

export const hoy = () => new Date().toISOString().slice(0, 10)

/* Accepts both 1.234,56 and 1,234.56 — whichever separator appears last is
   treated as the decimal one. */
export function parseNum(txt: string | null | undefined): number {
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

export function money(n: number): string {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '−$' : '$') + s
}

export function moneyShort(n: number): string {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return (n < 0 ? '−$' : '$') + s
}

export function fechaLarga(iso: string): string {
  const p = iso.split('-')
  if (p.length !== 3) return iso || 'Sin fecha'
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(p[2], 10)} de ${meses[parseInt(p[1], 10) - 1] ?? p[1]} ${p[0]}`
}

/** A partida's amount: the breakdown's sum when there is one, else its own field. */
export function montoPartida(p: Partida): number {
  return p.detalles.length
    ? p.detalles.reduce((acc, d) => acc + parseNum(d.monto), 0)
    : parseNum(p.monto)
}

export const totalSeccion = (rows: Partida[]) => rows.reduce((acc, p) => acc + montoPartida(p), 0)

export function calcular(corte: Corte) {
  const ac = totalSeccion(corte.ac), anc = totalSeccion(corte.anc)
  const pc = totalSeccion(corte.pc), pnc = totalSeccion(corte.pnc)
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
}

/** Finds a partida across every section. */
export function buscarPartida(corte: Corte, id: string): { sec: SeccionId; partida: Partida } | null {
  for (const sec of IDS) {
    const partida = corte[sec].find(p => p.id === id)
    if (partida) return { sec, partida }
  }
  return null
}

/* ── comparación entre cortes ── */

/* Strips accents too, so "Préstamo" and "Prestamo" match. */
const normalizarNombre = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export type EstadoFila = 'igual' | 'cambio' | 'nueva' | 'eliminada'

export type FilaComparacion = {
  nombre: string
  montoA: number
  montoB: number
  delta: number
  /** null when there is nothing to grow from — a new partida has no % change. */
  pct: number | null
  estado: EstadoFila
}

/* Partidas are matched by identity first, so a corte duplicated from an earlier
   one lines up exactly even after a rename. Falling back to the normalised name
   is what lets two independently-typed cortes still be compared, accepting that
   "Efectivo " and "efectivo" are the same line. */
function emparejar(a: Partida[], b: Partida[]): FilaComparacion[] {
  const filas: FilaComparacion[] = []
  const usados = new Set<string>()

  const porId = new Map(b.map(p => [p.id, p]))
  const porNombre = new Map<string, Partida>()
  for (const p of b) {
    const k = normalizarNombre(p.nombre)
    if (k && !porNombre.has(k)) porNombre.set(k, p)
  }

  for (const pa of a) {
    const pb = porId.get(pa.id) ?? (pa.nombre ? porNombre.get(normalizarNombre(pa.nombre)) : undefined)
    const montoA = montoPartida(pa)
    if (pb) {
      usados.add(pb.id)
      const montoB = montoPartida(pb)
      const delta = montoB - montoA
      filas.push({
        nombre: pb.nombre || pa.nombre,
        montoA, montoB, delta,
        pct: montoA !== 0 ? (delta / Math.abs(montoA)) * 100 : null,
        estado: Math.abs(delta) < 0.005 ? 'igual' : 'cambio',
      })
    } else {
      filas.push({
        nombre: pa.nombre, montoA, montoB: 0, delta: -montoA,
        pct: null, estado: 'eliminada',
      })
    }
  }

  for (const pb of b) {
    if (usados.has(pb.id)) continue
    const montoB = montoPartida(pb)
    filas.push({
      nombre: pb.nombre, montoA: 0, montoB, delta: montoB,
      pct: null, estado: 'nueva',
    })
  }

  return filas.filter(f => f.nombre || f.montoA || f.montoB)
}

export function compararCortes(a: Corte, b: Corte) {
  return SECCIONES.map(sec => {
    const filas = emparejar(a[sec.id], b[sec.id])
    return {
      sec,
      filas,
      totalA: totalSeccion(a[sec.id]),
      totalB: totalSeccion(b[sec.id]),
    }
  })
}

/** Copies a corte's structure forward, keeping partida identity so the two compare exactly. */
export function duplicarCorte(c: Corte, fecha: string): Corte {
  return { ...c, fecha, ac: [...c.ac], anc: [...c.anc], pc: [...c.pc], pnc: [...c.pnc] }
}

/* Saved cortes predate `detalles`, and a hand-edited localStorage blob can be
   anything at all — so everything is coerced back into shape on read rather
   than trusted. */
export function normalizarCorte(raw: unknown): Corte {
  const base = corteVacio()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const partidas = (v: unknown): Partida[] => {
    if (!Array.isArray(v)) return []
    return v.map(item => {
      const p = (item ?? {}) as Record<string, unknown>
      const detalles = Array.isArray(p.detalles)
        ? p.detalles.map(d => {
            const x = (d ?? {}) as Record<string, unknown>
            return {
              id: typeof x.id === 'string' ? x.id : nuevoId(),
              nombre: typeof x.nombre === 'string' ? x.nombre : '',
              monto: typeof x.monto === 'string' ? x.monto : '',
            }
          })
        : []
      return {
        id: typeof p.id === 'string' ? p.id : nuevoId(),
        nombre: typeof p.nombre === 'string' ? p.nombre : '',
        monto: typeof p.monto === 'string' ? p.monto : '',
        detalles,
      }
    })
  }

  return {
    empresa: typeof o.empresa === 'string' ? o.empresa : '',
    fecha: typeof o.fecha === 'string' ? o.fecha : '',
    capitalManual: typeof o.capitalManual === 'string' ? o.capitalManual : null,
    ac: partidas(o.ac),
    anc: partidas(o.anc),
    pc: partidas(o.pc),
    pnc: partidas(o.pnc),
  }
}
