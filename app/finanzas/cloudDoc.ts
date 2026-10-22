'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/* One Finanzas book (the cash-flow libro, the balance cortes, its draft) kept
   as a JSON document per store in fin_books. Replaces localStorage: the
   first time a store opens Finanzas, whatever this browser had is uploaded,
   once, and the browser copy is left alone as a backup.

   Saves are debounced and versioned: if another device saved in between, the
   newer copy is loaded instead of overwritten, and `onConflict` says so. */

const MIGRATED = 'lyte:finanzas-migrada'

export function useCloudDoc<T>(opts: {
  storeId: string | null | undefined
  key: string
  legacyKey: string
  empty: () => T
  normalize: (raw: unknown) => T
  /** Strip anything that isn't part of the stored document. */
  serialize?: (value: T) => unknown
  onConflict?: () => void
}) {
  const { storeId, key, legacyKey } = opts
  const [value, setValue] = useState<T>(opts.empty)
  const [ready, setReady] = useState(false)
  const version = useRef<number | null>(null)
  const lastSaved = useRef<string>('')
  const optsRef = useRef(opts)
  useEffect(() => { optsRef.current = opts })

  const load = useCallback(async (sid: string) => {
    const { normalize, serialize } = optsRef.current
    const { data, error } = await supabase.from('fin_books').select('data, version').eq('store_id', sid).eq('key', key).maybeSingle()
    if (error) return false
    if (data) {
      const v = normalize(data.data)
      version.current = data.version
      lastSaved.current = JSON.stringify(serialize ? serialize(v) : v)
      setValue(v)
      return true
    }
    // Nothing in the cloud yet: bring this browser's copy up (only once, so a
    // second store doesn't inherit the first store's books).
    let initial = optsRef.current.empty()
    try {
      const migrated = JSON.parse(localStorage.getItem(MIGRATED) ?? '{}') as Record<string, string>
      const raw = localStorage.getItem(legacyKey)
      if (raw && !migrated[legacyKey]) {
        initial = normalize(JSON.parse(raw))
        migrated[legacyKey] = sid
        localStorage.setItem(MIGRATED, JSON.stringify(migrated))
      }
    } catch { /* private mode or corrupt copy: start empty */ }
    version.current = null
    lastSaved.current = ''
    setValue(initial)
    return true
  }, [key, legacyKey])

  useEffect(() => {
    if (!storeId) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reloading for another store
    setReady(false)
    load(storeId).then(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [storeId, load])

  // Debounced, versioned save
  useEffect(() => {
    if (!ready || !storeId) return
    const { serialize } = optsRef.current
    const json = JSON.stringify(serialize ? serialize(value) : value)
    if (json === lastSaved.current) return
    const t = setTimeout(async () => {
      const data = JSON.parse(json)
      if (version.current === null) {
        const { error } = await supabase.from('fin_books').insert({ store_id: storeId, key, data, version: 1 })
        if (!error) { version.current = 1; lastSaved.current = json; return }
        // Someone created it first: take theirs
        await load(storeId); optsRef.current.onConflict?.()
        return
      }
      const { data: rows, error } = await supabase.from('fin_books')
        .update({ data, version: version.current + 1, updated_at: new Date().toISOString() })
        .eq('store_id', storeId).eq('key', key).eq('version', version.current)
        .select('version')
      if (error) return
      if (rows && rows.length) { version.current = rows[0].version; lastSaved.current = json; return }
      await load(storeId); optsRef.current.onConflict?.()
    }, 700)
    return () => clearTimeout(t)
  }, [value, ready, storeId, key, load])

  return { value, setValue, ready }
}
