'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useBalance } from './BalanceProvider'
import { useDashboardStore } from '../lib/DashboardStoreProvider'
import { supabase } from '../lib/supabase'
import { useCloudDoc } from './cloudDoc'
import { CLAVE_FLUJO, type Externo, type Libro, libroVacio, normalizarLibro } from './flujo/model'

type Ctx = {
  /** The stored libro plus `externos` (inventory purchases and payments). */
  libro: Libro
  setLibro: React.Dispatch<React.SetStateAction<Libro>>
  listo: boolean
  /** Sets the Bs-per-USD rate for one date. */
  setTasa: (fecha: string, valor: string) => void
  aviso: (msg: string) => void
}

const FlujoCtx = createContext<Ctx | null>(null)

export function useFlujo() {
  const ctx = useContext(FlujoCtx)
  if (!ctx) throw new Error('useFlujo debe usarse dentro de FlujoProvider')
  return ctx
}

/* Nested inside BalanceProvider so both books share one toast instead of
   stacking two of their own. The libro lives in the database (fin_books),
   per store; see cloudDoc.ts. */
export default function FlujoProvider({ children }: { children: React.ReactNode }) {
  const { aviso } = useBalance()
  const { storeId } = useDashboardStore()
  const { value: stored, setValue: setLibro, ready } = useCloudDoc<Libro>({
    storeId,
    key: 'flujo',
    legacyKey: CLAVE_FLUJO,
    empty: libroVacio,
    normalize: normalizarLibro,
    serialize: l => { const { externos: _skip, ...rest } = l; void _skip; return rest },
    onConflict: () => aviso('Se cargaron cambios hechos desde otro dispositivo.'),
  })

  // Money moved from Inventario (purchases, supplier payments)
  const [externos, setExternos] = useState<Externo[]>([])
  useEffect(() => {
    if (!storeId) return
    let alive = true
    supabase.from('fin_entries')
      .select('id, date, direction, method_id, amount, amount_usd, concept')
      .eq('store_id', storeId)
      .then(({ data }) => {
        if (!alive) return
        setExternos((data ?? []).map(e => ({
          id: e.id, fecha: e.date, tipo: e.direction as 'entrada' | 'salida', metodoId: e.method_id,
          monto: Number(e.amount) || 0, usd: e.amount_usd == null ? null : Number(e.amount_usd), concepto: e.concept,
        })))
      })
    return () => { alive = false }
  }, [storeId])

  const libro = useMemo(() => ({ ...stored, externos }), [stored, externos])

  const setTasa = useCallback((fecha: string, valor: string) => {
    if (!fecha) return
    setLibro(l => ({ ...l, tasas: { ...l.tasas, [fecha]: valor } }))
  }, [setLibro])

  return (
    <FlujoCtx.Provider value={{ libro, setLibro, listo: ready, setTasa, aviso }}>
      {children}
    </FlujoCtx.Provider>
  )
}
