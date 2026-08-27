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

/* ── tipos de partida ──
   A partida's nature decides how it behaves. Cash you already hold is valued at
   what bolívares are worth and nothing else; a receivable also depends on the
   rate it will be collected at; inventory is neither. Offering every option
   everywhere was the mistake — it put a "collected at BCV" choice on a pile of
   cash, where it means nothing. */

export type TipoPartida =
  | 'efectivo' | 'cxc' | 'inventario' | 'activo_otro'
  | 'cxp' | 'prestamo' | 'pasivo_otro'

export type ConfigTipo = {
  id: TipoPartida
  label: string
  descripcion: string
  lado: 'activo' | 'pasivo'
  /** Settlement forms this kind of partida can actually take. */
  formas: Moneda[]
  /** Placeholder for a line's name, in this partida's own language. */
  ejemplo: string
  tituloDesglose: string
}

export const TIPOS: ConfigTipo[] = [
  {
    id: 'efectivo', label: 'Efectivo y bancos', lado: 'activo',
    descripcion: 'Plata que ya tenés: caja, cuentas bancarias, Zelle, USDT.',
    // No BCV here: you are holding the bolívares, not waiting to be paid in them.
    formas: ['USD', 'VES', 'USDT'],
    ejemplo: 'Ej: efectivo USD, banco BNC, Zelle',
    tituloDesglose: 'Dónde está el dinero',
  },
  {
    id: 'cxc', label: 'Cuentas por cobrar', lado: 'activo',
    descripcion: 'Plata que te deben. Lo que se cobra en bolívares a tasa BCV vale menos de lo que dice.',
    formas: ['USD', 'USD_BCV', 'VES', 'USDT'],
    ejemplo: 'Ej: cliente, número de factura',
    tituloDesglose: 'Quién debe',
  },
  {
    id: 'inventario', label: 'Inventario', lado: 'activo',
    descripcion: 'Mercancía valorada. Un renglón por categoría, con su monto.',
    formas: ['USD', 'VES'],
    ejemplo: 'Ej: inventario al mayor, al detal',
    tituloDesglose: 'Qué hay en inventario',
  },
  {
    id: 'activo_otro', label: 'Otro activo', lado: 'activo',
    descripcion: 'Cualquier otra cosa que tenga valor: equipos, depósitos, mejoras.',
    formas: ['USD', 'VES', 'USDT'],
    ejemplo: 'Ej: equipos, depósito en garantía',
    tituloDesglose: 'Desglose',
  },
  {
    id: 'cxp', label: 'Cuentas por pagar', lado: 'pasivo',
    descripcion: 'Lo que debés a proveedores. Pagar en bolívares a tasa BCV te cuesta menos de lo que dice.',
    formas: ['USD', 'USD_BCV', 'VES', 'USDT'],
    ejemplo: 'Ej: proveedor, factura',
    tituloDesglose: 'A quién le debés',
  },
  {
    id: 'prestamo', label: 'Préstamos', lado: 'pasivo',
    descripcion: 'Deudas con terceros o socios.',
    formas: ['USD', 'USD_BCV', 'VES', 'USDT'],
    ejemplo: 'Ej: nombre del acreedor',
    tituloDesglose: 'Con quién',
  },
  {
    id: 'pasivo_otro', label: 'Otro pasivo', lado: 'pasivo',
    descripcion: 'Cualquier otra obligación.',
    formas: ['USD', 'USD_BCV', 'VES', 'USDT'],
    ejemplo: 'Ej: concepto',
    tituloDesglose: 'Desglose',
  },
]

export const configTipo = (t: TipoPartida): ConfigTipo =>
  TIPOS.find(x => x.id === t) ?? TIPOS[3]

export const tiposDe = (lado: 'activo' | 'pasivo') => TIPOS.filter(t => t.lado === lado)

/** The two rates a corte needs: what bolívares are really worth, and the official one. */
export type Tasas = { mercado: number; bcv: number }

/* Amounts stay raw strings so a field can hold whatever is mid-typing;
   parseNum() is the single place that turns one into a number.

   `tasa` applies to bolívar lines only, and means exactly one thing: how many
   bolívares to the dollar this particular line converts at. Empty falls back to
   the corte's market rate. It deliberately does not touch BCV-settled lines,
   where two rates are in play and "the rate" would be ambiguous. */
export type Detalle = { id: string; nombre: string; monto: string; moneda: Moneda; tasa: string }

/* A partida is either a single amount typed straight into the sheet, or a
   breakdown that adds up. `detalles` being non-empty is what decides which:
   once there is a breakdown, `monto` is ignored. */
export type Partida = {
  id: string
  nombre: string
  tipo: TipoPartida
  monto: string
  moneda: Moneda
  tasa: string
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

/* A partida opens in the form its kind normally takes. Receivables and payables
   here are usually settled in bolívares at the official rate, so they start
   there instead of on plain dollars, which would silently convert nothing. */
export const monedaPorDefecto = (tipo: TipoPartida): Moneda =>
  (tipo === 'cxc' || tipo === 'cxp' ? 'USD_BCV' : 'USD')

export const nuevaPartida = (tipo: TipoPartida = 'activo_otro'): Partida =>
  ({ id: nuevoId(), nombre: '', tipo, monto: '', moneda: monedaPorDefecto(tipo), tasa: '', detalles: [] })
export const nuevoDetalle = (moneda: Moneda = 'USD'): Detalle =>
  ({ id: nuevoId(), nombre: '', monto: '', moneda, tasa: '' })

/* `fecha` starts empty on purpose: the sheet is prerendered, so seeding it with
   new Date() would bake the build date into the HTML and then disagree with the
   client's date at hydration. Pages fill it in on mount. */
export const corteVacio = (): Corte => ({
  empresa: '',
  fecha: '',
  tasaMercado: '',
  tasaBcv: '',
  capitalManual: null,
  /* Empty: a partida can't exist before its kind is chosen, so the sheet starts
     bare instead of seeding rows of an arbitrary type. */
  ac: [],
  anc: [],
  pc: [],
  pnc: [],
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
export function aUSD(monto: number, moneda: Moneda, tasas: Tasas, tasaLinea = ''): number | null {
  if (moneda === 'USD' || moneda === 'USDT') return monto
  if (moneda === 'VES') {
    const propia = parseNum(tasaLinea)
    const tasa = propia > 0 ? propia : tasas.mercado
    return tasa > 0 ? monto / tasa : null
  }
  // USD_BCV: both rates come from the corte — see the note on Detalle.tasa.
  if (tasas.mercado > 0 && tasas.bcv > 0) return (monto * tasas.bcv) / tasas.mercado
  return null
}

/** Face value: what the line says, before the settlement discount. */
export function nominalUSD(monto: number, moneda: Moneda, tasas: Tasas, tasaLinea = ''): number | null {
  if (moneda === 'VES') return aUSD(monto, 'VES', tasas, tasaLinea)
  return monto
}

export const montoDetalle = (d: Detalle, tasas: Tasas) => aUSD(parseNum(d.monto), d.moneda, tasas, d.tasa)

/** A partida's real value in USD. Lines that can't be converted are left out. */
export function montoPartida(p: Partida, tasas: Tasas): number {
  if (p.detalles.length) {
    return p.detalles.reduce((acc, d) => {
      const v = montoDetalle(d, tasas)
      return v === null ? acc : acc + v
    }, 0)
  }
  return aUSD(parseNum(p.monto), p.moneda, tasas, p.tasa) ?? 0
}

/** True when something here needs a rate that isn't loaded. */
export function partidaSinTasa(p: Partida, tasas: Tasas): boolean {
  if (p.detalles.length) {
    return p.detalles.some(d => parseNum(d.monto) !== 0 && montoDetalle(d, tasas) === null)
  }
  return parseNum(p.monto) !== 0 && aUSD(parseNum(p.monto), p.moneda, tasas, p.tasa) === null
}

/** What the partida would be worth if every line settled at face value. */
export function nominalPartida(p: Partida, tasas: Tasas): number {
  const lineas = p.detalles.length ? p.detalles : [{ monto: p.monto, moneda: p.moneda, tasa: p.tasa }]
  return lineas.reduce((acc, d) => {
    const v = nominalUSD(parseNum(d.monto), d.moneda, tasas, d.tasa)
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
    /* The BCV spread cuts opposite ways. On an asset it is a loss: you are owed
       $100 and collect bolívares worth $83. On a liability it is a saving: you
       owe $100 and settle it with bolívares that cost you $83. Netting them into
       one figure would hide both. */
    mermaActivos: (['ac', 'anc'] as SeccionId[]).reduce((acc, id) => acc + corte[id].reduce(
      (a, p) => a + (nominalPartida(p, tasas) - montoPartida(p, tasas)), 0), 0),
    ahorroPasivos: (['pc', 'pnc'] as SeccionId[]).reduce((acc, id) => acc + corte[id].reduce(
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

  const partidas = (v: unknown, ladoPorDefecto: 'activo' | 'pasivo'): Partida[] => {
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
              tasa: typeof x.tasa === 'string' ? x.tasa : '',
            }
          })
        : []
      /* Partidas saved before kinds existed default by the section they sit in,
         which is the closest true statement available. */
      const tipo: TipoPartida = TIPOS.some(t => t.id === p.tipo)
        ? (p.tipo as TipoPartida)
        : (ladoPorDefecto === 'pasivo' ? 'pasivo_otro' : 'activo_otro')
      return {
        id: typeof p.id === 'string' ? p.id : nuevoId(),
        nombre: typeof p.nombre === 'string' ? p.nombre : '',
        tipo,
        monto: typeof p.monto === 'string' ? p.monto : '',
        moneda: moneda(p.moneda),
        tasa: typeof p.tasa === 'string' ? p.tasa : '',
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
    ac: partidas(o.ac, 'activo'),
    anc: partidas(o.anc, 'activo'),
    pc: partidas(o.pc, 'pasivo'),
    pnc: partidas(o.pnc, 'pasivo'),
  }
}
