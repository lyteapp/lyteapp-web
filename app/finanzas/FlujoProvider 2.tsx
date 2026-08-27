'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useBalance } from './BalanceProvider'
import { CLAVE_FLUJO, type Libro, libroVacio, normalizarLibro } from './flujo/model'

type Ctx = {
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
   stacking two of their own. */
export default function FlujoProvider({ children }: { children: React.ReactNode }) {
  const { aviso } = useBalance()
  const [libro, setLibro] = useState<Libro>(libroVacio)
  // Gates the first write so the empty initial state can't overwrite storage.
  const [listo, setListo] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE_FLUJO)
      if (raw) setLibro(normalizarLibro(JSON.parse(raw)))
    } catch { /* corrupto o modo privado: se arranca vacío */ }
    setListo(true)
  }, [])

  useEffect(() => {
    if (!listo) return
    try { localStorage.setItem(CLAVE_FLUJO, JSON.stringify(libro)) } catch { /* cuota llena */ }
  }, [libro, listo])

  const setTasa = useCallback((fecha: string, valor: string) => {
    if (!fecha) return
    setLibro(l => ({ ...l, tasas: { ...l.tasas, [fecha]: valor } }))
  }, [])

  return (
    <FlujoCtx.Provider value={{ libro, setLibro, listo, setTasa, aviso }}>
      {children}
    </FlujoCtx.Provider>
  )
}
