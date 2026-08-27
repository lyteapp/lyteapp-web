/* Model and pure helpers for the cash ledger. Deliberately independent of the
   balance sheet: the two are separate books that don't read each other. */

export type TipoMov = 'entrada' | 'salida'

export type Movimiento = {
  id: string
  fecha: string      // YYYY-MM-DD
  concepto: string
  categoria: string
  tipo: TipoMov
  monto: string      // raw, so a field can hold what's mid-typing
}

export type Libro = {
  /** Cash on hand before the first movement ever recorded. */
  saldoInicial: string
  movimientos: Movimiento[]
}

export const CLAVE_FLUJO = 'lyte:flujo-caja'

/* Suggestions only — the field stays free text, so the list grows with whatever
   the business actually calls things. */
export const CATEGORIAS_SUGERIDAS = [
  'Ventas', 'Cobro a cliente', 'Aporte de socio', 'Préstamo recibido',
  'Proveedores', 'Sueldos', 'Alquiler', 'Servicios', 'Impuestos',
  'Transporte', 'Mantenimiento', 'Retiro de socio', 'Pago de préstamo', 'Otros',
]

let contador = 0
export const nuevoId = () => `m${Date.now().toString(36)}${(contador++).toString(36)}`

export const libroVacio = (): Libro => ({ saldoInicial: '', movimientos: [] })

export const nuevoMovimiento = (fecha: string, tipo: TipoMov = 'entrada'): Movimiento => ({
  id: nuevoId(), fecha, concepto: '', categoria: '', tipo, monto: '',
})

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

/* Date first, then insertion order, so several movements on the same day keep a
   stable running balance instead of shuffling as you type. */
export function ordenar(movs: Movimiento[]): Movimiento[] {
  return [...movs].sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha)))
}

/** Every month that has movements, newest first. */
export function mesesConDatos(movs: Movimiento[]): string[] {
  return [...new Set(movs.filter(m => m.fecha).map(m => mesDe(m.fecha)))].sort().reverse()
}

/* Coerces anything read back from storage into shape — a hand-edited blob can
   be anything, and an old one may predate fields added later. */
export function normalizarLibro(raw: unknown): Libro {
  if (!raw || typeof raw !== 'object') return libroVacio()
  const o = raw as Record<string, unknown>
  const movimientos = Array.isArray(o.movimientos)
    ? o.movimientos.map(item => {
        const m = (item ?? {}) as Record<string, unknown>
        return {
          id: typeof m.id === 'string' ? m.id : nuevoId(),
          fecha: typeof m.fecha === 'string' ? m.fecha : '',
          concepto: typeof m.concepto === 'string' ? m.concepto : '',
          categoria: typeof m.categoria === 'string' ? m.categoria : '',
          tipo: m.tipo === 'salida' ? ('salida' as const) : ('entrada' as const),
          monto: typeof m.monto === 'string' ? m.monto : '',
        }
      })
    : []
  return {
    saldoInicial: typeof o.saldoInicial === 'string' ? o.saldoInicial : '',
    movimientos,
  }
}
