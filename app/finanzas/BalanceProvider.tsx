'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../lib/DashboardStoreProvider'
import { useCloudDoc } from './cloudDoc'
import {
  type Corte, type Partida, type SeccionId, type TipoPartida,
  corteVacio, duplicarCorte, hoy, nuevaPartida, normalizarCorte,
} from './balance'

const CLAVE_CORTES = 'lyte:balance-general:cortes'
const CLAVE_BORRADOR = 'lyte:balance-general:borrador'

type Ctx = {
  corte: Corte
  setCorte: React.Dispatch<React.SetStateAction<Corte>>
  cortes: Record<string, Corte>
  listo: boolean
  guardar: () => void
  abrir: (fecha: string) => void
  eliminar: () => void
  empezarEnBlanco: () => void
  nuevoDesdeEste: () => void
  agregarPartida: (sec: SeccionId, tipo: TipoPartida) => Partida
  editarPartida: (sec: SeccionId, id: string, cambios: Partial<Partida>) => void
  borrarPartida: (sec: SeccionId, id: string) => void
  aviso: (msg: string) => void
}

const BalanceCtx = createContext<Ctx | null>(null)

export function useBalance() {
  const ctx = useContext(BalanceCtx)
  if (!ctx) throw new Error('useBalance debe usarse dentro de BalanceProvider')
  return ctx
}

const normalizarCortes = (raw: unknown): Record<string, Corte> => {
  const out: Record<string, Corte> = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = normalizarCorte(v)
  }
  return out
}

/* Both the saved cortes and the working draft live in the database
   (fin_books, per store) — see cloudDoc.ts. The draft saves itself, so
   nothing is lost on reload or when switching devices. */
export default function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { storeId } = useDashboardStore()
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avisoRef = useRef<(m: string) => void>(() => {})

  const { value: cortes, setValue: setCortes, ready: cortesListos } = useCloudDoc<Record<string, Corte>>({
    storeId, key: 'balance_cortes', legacyKey: CLAVE_CORTES,
    empty: () => ({}), normalize: normalizarCortes,
    onConflict: () => avisoRef.current('Se cargaron cambios hechos desde otro dispositivo.'),
  })
  const { value: corte, setValue: setCorte, ready: borradorListo } = useCloudDoc<Corte>({
    storeId, key: 'balance_borrador', legacyKey: CLAVE_BORRADOR,
    empty: () => ({ ...corteVacio(), fecha: hoy() }),
    normalize: raw => { const c = normalizarCorte(raw); return { ...c, fecha: c.fecha || hoy() } },
  })
  const listo = cortesListos && borradorListo

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const aviso = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])
  useEffect(() => { avisoRef.current = aviso }, [aviso])

  const persistirCortes = useCallback((next: Record<string, Corte>) => {
    setCortes(next)
  }, [setCortes])

  const guardar = useCallback(() => {
    if (!corte.fecha) { aviso('Ponle una fecha de corte antes de guardar.'); return }
    try {
      persistirCortes({ ...cortes, [corte.fecha]: corte })
      aviso('Corte guardado.')
    } catch {
      aviso('No se pudo guardar. Descarga el CSV para no perder el trabajo.')
    }
  }, [corte, cortes, persistirCortes, aviso])

  const abrir = useCallback((fecha: string) => {
    const c = cortes[fecha]
    if (!c) return
    setCorte(c)
    aviso('Corte abierto.')
  }, [cortes, aviso])

  const eliminar = useCallback(() => {
    if (!corte.fecha || !cortes[corte.fecha]) { aviso('No hay un corte guardado con esa fecha.'); return }
    const next = { ...cortes }
    delete next[corte.fecha]
    try {
      persistirCortes(next)
      aviso('Corte eliminado.')
    } catch {
      aviso('No se pudo eliminar.')
    }
  }, [corte.fecha, cortes, persistirCortes, aviso])

  const empezarEnBlanco = useCallback(() => {
    setCorte(c => ({ ...corteVacio(), empresa: c.empresa, fecha: c.fecha }))
    aviso('Listo, tienes un balance en blanco.')
  }, [aviso])

  /* Carries the whole structure forward under today's date. Partida identity
     survives, which is what lets the two cortes be compared line by line
     instead of guessed at by name. */
  const nuevoDesdeEste = useCallback(() => {
    setCorte(c => duplicarCorte(c, hoy()))
    aviso('Corte nuevo con la misma estructura. Actualizá los montos y guardá.')
  }, [aviso])

  const agregarPartida = useCallback((sec: SeccionId, tipo: TipoPartida) => {
    const p = nuevaPartida(tipo)
    setCorte(c => ({ ...c, [sec]: [...c[sec], p] }))
    return p
  }, [])

  const editarPartida = useCallback((sec: SeccionId, id: string, cambios: Partial<Partida>) => {
    setCorte(c => ({ ...c, [sec]: c[sec].map(p => (p.id === id ? { ...p, ...cambios } : p)) }))
  }, [])

  const borrarPartida = useCallback((sec: SeccionId, id: string) => {
    setCorte(c => ({ ...c, [sec]: c[sec].filter(p => p.id !== id) }))
  }, [])

  return (
    <BalanceCtx.Provider value={{
      corte, setCorte, cortes, listo,
      guardar, abrir, eliminar, empezarEnBlanco, nuevoDesdeEste,
      agregarPartida, editarPartida, borrarPartida, aviso,
    }}>
      {children}
      {toast && <div className="bal-toast">{toast}</div>}
    </BalanceCtx.Provider>
  )
}
