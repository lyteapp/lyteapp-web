/* Shared model and pure helpers for the balance general. Lives apart from the
   pages because the sheet, the sidebar tree and each partida's detail page all
   need to agree on how a partida's amount is derived. */

export type SeccionId = 'ac' | 'anc' | 'pc' | 'pnc'

/* The sheet is expressed in dollars, but what it counts often isn't — and worse,
   a figure can be denominated in dollars yet be worth less than it says.

   A receivable of $100 collected in bolívares at the official rate hands over
   $100 × BCV bolívares, and those bolívares are only worth what the market pays
   for them. At 791,32 official and 950 market that $100 settles at $83,29. The
   gap is real money, so `moneda` records how a line settles, not just what it
   is written in. */
export type Moneda = 'USD' | 'USD_BCV' | 'VES' | 'USDT'

export const MONEDAS: { id: Moneda; label: string; simbolo: string; ayuda: string }[] = [
  { id: 'USD',     label: 'Dólares',          simbolo: '$',  ayuda: 'Se cobra en dólares. Vale lo que dice.' },
  { id: 'USD_BCV', label: 'Dólares a tasa BCV', simbolo: '$', ayuda: 'Monto en dólares que se cobra en bolívares a la tasa BCV. Se valora al cambio real.' },
  { id: 'VES',     label: 'Bolívares',        simbolo: 'Bs', ayuda: 'Monto ya expresado en bolívares. Se valora al cambio real.' },
  { id: 'USDT',    label: 'USDT',             simbolo: '₮',  ayuda: 'Se toma uno a uno con el dólar.' },
]

/** The two rates a corte needs: what bolívares are really worth, and the official one. */
export type Tasas = { mercado: number; bcv: number }

/* Amounts stay raw strings so a field can hold whatever is mid-typing;
   parseNum() is the single place that turns one into a number. Rates live on the
   corte, not the line: one cut-off date has one official rate and one market
   rate, and repeating them per row invites them to drift apart. */
export type Detalle = { id: string; nombre: string; monto: string; moneda: Moneda }

/* A partida is either a single amount typed straight into the sheet, or a
   breakdown that adds up. `detalles` being non-empty is what decides which:
   once there is a breakdown, `monto` is ignored. */
export type Partida = {
  id: string
  nombre: string
  monto: string
  moneda: Moneda
  detalles: Detalle[]
}

export type Corte = {
  empresa: string
  fecha: string
  /** Bs per USD the market actually pays (Binance/paralelo). Values every bolívar. */
  tasaMercado: string
  /** Official Bs per USD. Only decides how many bolívares a BCV-settled figure yields. */
  tasaBcv: string
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

export const nuevaPartida = (): Partida => ({ id: nuevoId(), nombre: '', monto: '', moneda: 'USD', detalles: [] })
export const nuevoDetalle = (): Detalle => ({ id: nuevoId(), nombre: '', monto: '', moneda: 'USD' })

/* `fecha` starts empty on purpose: the sheet is prerendered, so seeding it with
   new Date() would bake the build date into the HTML and then disagree with the
   client's date at hydration. Pages fill it in on mount. */
export const corteVacio = (): Corte => ({
  empresa: '',
  fecha: '',
  tasaMercado: '',
  tasaBcv: '',
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

/* ── conversión a dólares ── */

export const tasasDe = (c: Corte): Tasas => ({
  mercado: parseNum(c.tasaMercado),
  bcv: parseNum(c.tasaBcv),
})

/* What a figure is really worth in dollars.

   `USD_BCV` is the case that isn't obvious: the amount is written in dollars but
   settles in bolívares at the official rate, so it yields `monto × bcv`
   bolívares, and those are worth `÷ mercado`. Net effect: the nominal amount is
   scaled by bcv/mercado. When the official rate lags the market — which is the
   whole reason to track it — that scale is below 1 and the receivable is worth
   less than its face value.

   Returns null when a needed rate is missing. Null is not zero: an unknown rate
   left as nothing would quietly understate the sheet, so callers surface it. */
export function aUSD(monto: number, moneda: Moneda, tasas: Tasas): number | null {
  if (moneda === 'USD' || moneda === 'USDT') return monto
  if (moneda === 'VES') return tasas.mercado > 0 ? monto / tasas.mercado : null
  // USD_BCV
  if (tasas.mercado > 0 && tasas.bcv > 0) return (monto * tasas.bcv) / tasas.mercado
  return null
}

/** Face value: what the line says, before the settlement discount. */
export function nominalUSD(monto: number, moneda: Moneda, tasas: Tasas): number | null {
  if (moneda === 'VES') return tasas.mercado > 0 ? monto / tasas.mercado : null
  return monto
}

export const montoDetalle = (d: Detalle, tasas: Tasas) => aUSD(parseNum(d.monto), d.moneda, tasas)

/** A partida's real value in USD. Lines that can't be converted are left out. */
export function montoPartida(p: Partida, tasas: Tasas): number {
  if (p.detalles.length) {
    return p.detalles.reduce((acc, d) => {
      const v = montoDetalle(d, tasas)
      return v === null ? acc : acc + v
    }, 0)
  }
  return aUSD(parseNum(p.monto), p.moneda, tasas) ?? 0
}

/** True when something here needs a rate that isn't loaded. */
export function partidaSinTasa(p: Partida, tasas: Tasas): boolean {
  if (p.detalles.length) {
    return p.detalles.some(d => parseNum(d.monto) !== 0 && montoDetalle(d, tasas) === null)
  }
  return parseNum(p.monto) !== 0 && aUSD(parseNum(p.monto), p.moneda, tasas) === null
}

/** What the partida would be worth if every line settled at face value. */
export function nominalPartida(p: Partida, tasas: Tasas): number {
  const lineas = p.detalles.length ? p.detalles : [{ monto: p.monto, moneda: p.moneda }]
  return lineas.reduce((acc, d) => {
    const v = nominalUSD(parseNum(d.monto), d.moneda, tasas)
    return v === null ? acc : acc + v
  }, 0)
}

export const totalSeccion = (rows: Partida[], tasas: Tasas) =>
  rows.reduce((acc, p) => acc + montoPartida(p, tasas), 0)

export function calcular(corte: Corte) {
  const tasas = tasasDe(corte)
  const ac = totalSeccion(corte.ac, tasas), anc = totalSeccion(corte.anc, tasas)
  const pc = totalSeccion(corte.pc, tasas), pnc = totalSeccion(corte.pnc, tasas)
  const activos = ac + anc
  const pasivos = pc + pnc
  const manual = corte.capitalManual !== null
  const capital = manual ? parseNum(corte.capitalManual) : activos - pasivos
  const base = Math.abs(pasivos) + Math.abs(capital)
  const pctPasivo = base ? (Math.abs(pasivos) / base) * 100 : 0
  return {
    ac, anc, pc, pnc, activos, pasivos, capital, manual,
    tasas,
    /* Surfaced so the sheet can say a figure is missing rather than show a
       total that quietly excludes it. */
    sinTasa: IDS.flatMap(id => corte[id].filter(p => partidaSinTasa(p, tasas))),
    /* Face value minus real value: what the BCV settlement spread costs across
       the whole sheet. Zero when nothing settles at the official rate. */
    mermaBcv: IDS.reduce((acc, id) => acc + corte[id].reduce(
      (a, p) => a + (nominalPartida(p, tasas) - montoPartida(p, tasas)), 0), 0),
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
function emparejar(a: Partida[], b: Partida[], tasaA: Tasas, tasaB: Tasas): FilaComparacion[] {
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
    const montoA = montoPartida(pa, tasaA)
    if (pb) {
      usados.add(pb.id)
      const montoB = montoPartida(pb, tasaB)
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
    const montoB = montoPartida(pb, tasaB)
    filas.push({
      nombre: pb.nombre, montoA: 0, montoB, delta: montoB,
      pct: null, estado: 'nueva',
    })
  }

  return filas.filter(f => f.nombre || f.montoA || f.montoB)
}

export function compararCortes(a: Corte, b: Corte) {
  // Each corte converts at its own cut-off rate, never at a shared one.
  const tasaA = tasasDe(a), tasaB = tasasDe(b)
  return SECCIONES.map(sec => {
    const filas = emparejar(a[sec.id], b[sec.id], tasaA, tasaB)
    return {
      sec,
      filas,
      totalA: totalSeccion(a[sec.id], tasaA),
      totalB: totalSeccion(b[sec.id], tasaB),
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
const moneda = (v: unknown): Moneda =>
  (v === 'VES' || v === 'USDT' || v === 'USD_BCV' ? v : 'USD')

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
              moneda: moneda(x.moneda),
            }
          })
        : []
      return {
        id: typeof p.id === 'string' ? p.id : nuevoId(),
        nombre: typeof p.nombre === 'string' ? p.nombre : '',
        monto: typeof p.monto === 'string' ? p.monto : '',
        moneda: moneda(p.moneda),
        detalles,
      }
    })
  }

  return {
    empresa: typeof o.empresa === 'string' ? o.empresa : '',
    fecha: typeof o.fecha === 'string' ? o.fecha : '',
    /* Cortes saved before the split had one rate, which was the one bolívares
       were valued at — so it becomes the market rate, not the official one. */
    tasaMercado: typeof o.tasaMercado === 'string' ? o.tasaMercado
      : typeof o.tasa === 'string' ? o.tasa : '',
    tasaBcv: typeof o.tasaBcv === 'string' ? o.tasaBcv : '',
    capitalManual: typeof o.capitalManual === 'string' ? o.capitalManual : null,
    ac: partidas(o.ac),
    anc: partidas(o.anc),
    pc: partidas(o.pc),
    pnc: partidas(o.pnc),
  }
}
