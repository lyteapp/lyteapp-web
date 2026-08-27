/* Model and pure helpers for the cash system. Independent of the balance sheet:
   the two are separate books that don't read each other.

   The shape follows how the money actually moves in the business — retail
   register closings and wholesale collections come in, expenses go out — rather
   than one undifferentiated ledger, because each source is filled in by a
   different routine at a different moment of the day. */

export type Moneda = 'VES' | 'USD' | 'USDT'

export type Metodo = { id: string; nombre: string; moneda: Moneda }

/* Seeded with what a counter in Venezuela actually takes. The list is editable,
   so this is a starting point, not a closed set. */
export const METODOS_BASE: Metodo[] = [
  { id: 'efectivo-usd', nombre: 'Efectivo USD',    moneda: 'USD'  },
  { id: 'efectivo-bs',  nombre: 'Efectivo Bs',     moneda: 'VES'  },
  { id: 'punto',        nombre: 'Punto de venta',  moneda: 'VES'  },
  { id: 'pago-movil',   nombre: 'Pago móvil',      moneda: 'VES'  },
  { id: 'transfer-bs',  nombre: 'Transferencia Bs',moneda: 'VES'  },
  { id: 'zelle',        nombre: 'Zelle',           moneda: 'USD'  },
  { id: 'usdt',         nombre: 'USDT',            moneda: 'USDT' },
]

export type LineaCierre = { metodoId: string; monto: string }

/** One day's retail register close, broken down by how the money came in. */
export type CierreDetal = {
  id: string
  fecha: string
  lineas: LineaCierre[]
  nota: string
}

/** A wholesale customer paying — on account, so it arrives apart from the counter. */
export type Cobranza = {
  id: string
  fecha: string
  cliente: string
  metodoId: string
  monto: string
  nota: string
}

export type Gasto = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  metodoId: string
  monto: string
  /** Set when the expense came from settling an account payable. */
  cuentaId?: string
}

/* A single generic movement, kept for anything that isn't a closing, a
   collection or an expense — so there's always somewhere to put an oddity
   instead of forcing it into the wrong bucket. */
export type Movimiento = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  tipo: 'entrada' | 'salida'
  metodoId: string
  monto: string
}

export type Libro = {
  saldoInicial: string
  metodos: Metodo[]
  /** Bs per USD, by date. Read by whatever is dated that day. */
  tasas: Record<string, string>
  cierres: CierreDetal[]
  cobranzas: Cobranza[]
  gastos: Gasto[]
  movimientos: Movimiento[]
}

export const CLAVE_FLUJO = 'lyte:flujo-caja'

export const CATEGORIAS_GASTO = [
  'Proveedores', 'Sueldos', 'Alquiler', 'Servicios', 'Impuestos',
  'Transporte', 'Mantenimiento', 'Combustible', 'Empaques', 'Comisiones',
  'Pago de préstamo', 'Retiro de socio', 'Otros',
]

let contador = 0
export const nuevoId = () => `f${Date.now().toString(36)}${(contador++).toString(36)}`

export const libroVacio = (): Libro => ({
  saldoInicial: '',
  metodos: METODOS_BASE.map(m => ({ ...m })),
  tasas: {},
  cierres: [],
  cobranzas: [],
  gastos: [],
  movimientos: [],
})

export const nuevoCierre = (fecha: string, metodos: Metodo[]): CierreDetal => ({
  id: nuevoId(), fecha, nota: '',
  lineas: metodos.map(m => ({ metodoId: m.id, monto: '' })),
})

export const nuevaCobranza = (fecha: string, metodoId: string): Cobranza => ({
  id: nuevoId(), fecha, cliente: '', metodoId, monto: '', nota: '',
})

export const nuevoGasto = (fecha: string, metodoId: string): Gasto => ({
  id: nuevoId(), fecha, concepto: '', categoria: '', metodoId, monto: '',
})

export const nuevoMovimiento = (fecha: string, tipo: 'entrada' | 'salida', metodoId: string): Movimiento => ({
  id: nuevoId(), fecha, concepto: '', categoria: '', tipo, metodoId, monto: '',
})

/* ── fechas ── */
export const mesDe = (iso: string) => iso.slice(0, 7)

export const mesLargo = (mes: string) => {
  const [a, m] = mes.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${meses[parseInt(m, 10) - 1] ?? m} ${a}`
}

export const diaCorto = (iso: string) => {
  const p = iso.split('-')
  if (p.length !== 3) return iso
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(p[2], 10)} ${meses[parseInt(p[1], 10) - 1] ?? ''}`
}

export const diaLargo = (iso: string) => {
  const p = iso.split('-')
  if (p.length !== 3) return iso || 'Sin fecha'
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(p[2], 10)} de ${meses[parseInt(p[1], 10) - 1] ?? p[1]}`
}

/* ── conversión ── */

/* Amounts are converted with the rate of the day they happened, never today's.
   Otherwise every past month silently rewrites itself each time the bolívar
   moves, and a closed month stops matching what was counted that day. */
export function tasaDe(libro: Libro, fecha: string): number {
  const t = parseFloat((libro.tasas[fecha] ?? '').replace(',', '.'))
  if (isFinite(t) && t > 0) return t
  // Falls back to the closest earlier rate, so one missing day doesn't zero out.
  const anteriores = Object.keys(libro.tasas).filter(f => f <= fecha).sort()
  for (let i = anteriores.length - 1; i >= 0; i--) {
    const v = parseFloat((libro.tasas[anteriores[i]] ?? '').replace(',', '.'))
    if (isFinite(v) && v > 0) return v
  }
  return 0
}

export const metodoDe = (libro: Libro, id: string) =>
  libro.metodos.find(m => m.id === id) ?? null

/** Converts one amount to USD. Returns null when a Bs figure has no rate to use. */
export function aUSD(libro: Libro, monto: number, metodoId: string, fecha: string): number | null {
  const metodo = metodoDe(libro, metodoId)
  const moneda = metodo?.moneda ?? 'USD'
  if (moneda === 'USD' || moneda === 'USDT') return monto
  const tasa = tasaDe(libro, fecha)
  if (!tasa) return null
  return monto / tasa
}

/* ── normalización ── */

const texto = (v: unknown, def = '') => (typeof v === 'string' ? v : def)

/* Anything read back from storage is coerced into shape rather than trusted: a
   blob can be hand-edited, and an older one predates fields added since. */
export function normalizarLibro(raw: unknown): Libro {
  const base = libroVacio()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const metodos: Metodo[] = Array.isArray(o.metodos) && o.metodos.length
    ? o.metodos.map(item => {
        const m = (item ?? {}) as Record<string, unknown>
        const moneda = m.moneda === 'VES' || m.moneda === 'USDT' ? m.moneda : 'USD'
        return { id: texto(m.id) || nuevoId(), nombre: texto(m.nombre, 'Sin nombre'), moneda: moneda as Moneda }
      })
    : base.metodos

  const idsValidos = new Set(metodos.map(m => m.id))
  const metodoSeguro = (v: unknown) => {
    const id = texto(v)
    return idsValidos.has(id) ? id : metodos[0]?.id ?? ''
  }

  const tasas: Record<string, string> = {}
  if (o.tasas && typeof o.tasas === 'object') {
    for (const [k, v] of Object.entries(o.tasas as Record<string, unknown>)) {
      if (typeof v === 'string') tasas[k] = v
    }
  }

  const arr = <T,>(v: unknown, fn: (o: Record<string, unknown>) => T): T[] =>
    Array.isArray(v) ? v.map(x => fn((x ?? {}) as Record<string, unknown>)) : []

  return {
    saldoInicial: texto(o.saldoInicial),
    metodos,
    tasas,
    cierres: arr(o.cierres, c => ({
      id: texto(c.id) || nuevoId(),
      fecha: texto(c.fecha),
      nota: texto(c.nota),
      lineas: Array.isArray(c.lineas)
        ? c.lineas.map(l => {
            const x = (l ?? {}) as Record<string, unknown>
            return { metodoId: metodoSeguro(x.metodoId), monto: texto(x.monto) }
          })
        : [],
    })),
    cobranzas: arr(o.cobranzas, c => ({
      id: texto(c.id) || nuevoId(),
      fecha: texto(c.fecha),
      cliente: texto(c.cliente),
      metodoId: metodoSeguro(c.metodoId),
      monto: texto(c.monto),
      nota: texto(c.nota),
    })),
    gastos: arr(o.gastos, g => ({
      id: texto(g.id) || nuevoId(),
      fecha: texto(g.fecha),
      concepto: texto(g.concepto),
      categoria: texto(g.categoria),
      metodoId: metodoSeguro(g.metodoId),
      monto: texto(g.monto),
      cuentaId: typeof g.cuentaId === 'string' ? g.cuentaId : undefined,
    })),
    /* Movements predate metodoId — an old one lands on the first method rather
       than being dropped. */
    movimientos: arr(o.movimientos, m => ({
      id: texto(m.id) || nuevoId(),
      fecha: texto(m.fecha),
      concepto: texto(m.concepto),
      categoria: texto(m.categoria),
      tipo: m.tipo === 'salida' ? 'salida' : 'entrada',
      metodoId: metodoSeguro(m.metodoId),
      monto: texto(m.monto),
    })),
  }
}

/* ── vista unificada ──
   The three sources are filled in separately but have to be read together to
   get a saldo. This flattens them into one shape, carrying the origin so the
   summary can still say where each figure came from. */

export type Origen = 'detal' | 'mayor' | 'gasto' | 'otro'

export type Linea = {
  id: string
  fecha: string
  tipo: 'entrada' | 'salida'
  origen: Origen
  descripcion: string
  metodoId: string
  monto: number
  /** null when a bolívar figure has no rate for its date — it can't be totalled. */
  usd: number | null
}

export const ETIQUETA_ORIGEN: Record<Origen, string> = {
  detal: 'Cierre al detal',
  mayor: 'Cobranza al mayor',
  gasto: 'Gasto',
  otro: 'Otro movimiento',
}

const num = (s: string) => {
  const t = String(s ?? '').replace(/[^0-9,.\-]/g, '').trim()
  if (!t) return 0
  const lastC = t.lastIndexOf(','), lastD = t.lastIndexOf('.')
  const norm = lastC > lastD ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  const v = parseFloat(norm)
  return isFinite(v) ? v : 0
}

export function lineasDe(libro: Libro): Linea[] {
  const out: Linea[] = []

  for (const c of libro.cierres) {
    for (const l of c.lineas) {
      const monto = num(l.monto)
      if (!monto) continue
      out.push({
        id: `${c.id}:${l.metodoId}`,
        fecha: c.fecha,
        tipo: 'entrada',
        origen: 'detal',
        descripcion: metodoDe(libro, l.metodoId)?.nombre ?? 'Método',
        metodoId: l.metodoId,
        monto,
        usd: aUSD(libro, monto, l.metodoId, c.fecha),
      })
    }
  }

  for (const c of libro.cobranzas) {
    const monto = num(c.monto)
    if (!monto) continue
    out.push({
      id: c.id, fecha: c.fecha, tipo: 'entrada', origen: 'mayor',
      descripcion: c.cliente || 'Sin cliente',
      metodoId: c.metodoId, monto,
      usd: aUSD(libro, monto, c.metodoId, c.fecha),
    })
  }

  for (const g of libro.gastos) {
    const monto = num(g.monto)
    if (!monto) continue
    out.push({
      id: g.id, fecha: g.fecha, tipo: 'salida', origen: 'gasto',
      descripcion: g.concepto || g.categoria || 'Sin concepto',
      metodoId: g.metodoId, monto,
      usd: aUSD(libro, monto, g.metodoId, g.fecha),
    })
  }

  for (const m of libro.movimientos) {
    const monto = num(m.monto)
    if (!monto) continue
    out.push({
      id: m.id, fecha: m.fecha, tipo: m.tipo, origen: 'otro',
      descripcion: m.concepto || 'Sin concepto',
      metodoId: m.metodoId, monto,
      usd: aUSD(libro, monto, m.metodoId, m.fecha),
    })
  }

  return out.sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha)))
}

export type ResumenMes = {
  saldoApertura: number
  entradas: number
  salidas: number
  saldoFinal: number
  porOrigen: Record<Origen, number>
  lineas: { linea: Linea; saldo: number }[]
  /** Bolívar figures in the month with no rate for their date — excluded from every total. */
  sinTasa: Linea[]
  sinFecha: Linea[]
}

export function resumenMes(libro: Libro, mes: string): ResumenMes {
  const todas = lineasDe(libro)
  const primerDia = `${mes}-01`

  let saldoApertura = num(libro.saldoInicial)
  for (const l of todas) {
    if (l.fecha && l.fecha < primerDia && l.usd !== null) {
      saldoApertura += l.tipo === 'entrada' ? l.usd : -l.usd
    }
  }

  const delMes = todas.filter(l => l.fecha && mesDe(l.fecha) === mes)
  const sinTasa = delMes.filter(l => l.usd === null)
  const usables = delMes.filter(l => l.usd !== null)

  let corriente = saldoApertura
  const lineas = usables.map(linea => {
    corriente += linea.tipo === 'entrada' ? linea.usd! : -linea.usd!
    return { linea, saldo: corriente }
  })

  const porOrigen: Record<Origen, number> = { detal: 0, mayor: 0, gasto: 0, otro: 0 }
  for (const l of usables) porOrigen[l.origen] += l.usd!

  const entradas = usables.filter(l => l.tipo === 'entrada').reduce((a, l) => a + l.usd!, 0)
  const salidas  = usables.filter(l => l.tipo === 'salida').reduce((a, l) => a + l.usd!, 0)

  return {
    saldoApertura, entradas, salidas,
    saldoFinal: saldoApertura + entradas - salidas,
    porOrigen, lineas, sinTasa,
    sinFecha: todas.filter(l => !l.fecha),
  }
}

/** Every month that has something in it, newest first. */
export function mesesConDatos(libro: Libro): string[] {
  return [...new Set(lineasDe(libro).filter(l => l.fecha).map(l => mesDe(l.fecha)))].sort().reverse()
}
