'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  type Corte, type Partida, type SeccionId,
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
  agregarPartida: (sec: SeccionId) => Partida
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

function leerJSON(clave: string): unknown {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function BalanceProvider({ children }: { children: React.ReactNode }) {
  const [corte, setCorte] = useState<Corte>(corteVacio)
  const [cortes, setCortes] = useState<Record<string, Corte>>({})
  // Gates the first draft write so the empty initial state can't overwrite a
  // stored draft before it has been read back.
  const [listo, setListo] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── carga inicial ── */
  useEffect(() => {
    const guardados = leerJSON(CLAVE_CORTES)
    if (guardados && typeof guardados === 'object') {
      const out: Record<string, Corte> = {}
      for (const [k, v] of Object.entries(guardados as Record<string, unknown>)) {
        out[k] = normalizarCorte(v)
      }
      setCortes(out)
    }

    const borrador = leerJSON(CLAVE_BORRADOR)
    setCorte(borrador ? { ...normalizarCorte(borrador), fecha: (normalizarCorte(borrador).fecha || hoy()) } : { ...corteVacio(), fecha: hoy() })
    setListo(true)
  }, [])

  /* ── el borrador se persiste solo, para no perder trabajo al recargar ── */
  useEffect(() => {
    if (!listo) return
    try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(corte)) } catch { /* cuota llena o modo privado */ }
  }, [corte, listo])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const aviso = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  const persistirCortes = useCallback((next: Record<string, Corte>) => {
    localStorage.setItem(CLAVE_CORTES, JSON.stringify(next))
    setCortes(next)
  }, [])

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

  const agregarPartida = useCallback((sec: SeccionId) => {
    const p = nuevaPartida()
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
