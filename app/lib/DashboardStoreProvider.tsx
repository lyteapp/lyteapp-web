'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export interface StoreSummary {
  id: string
  name: string
  slug: string
  logo_url: string | null
  parent_store_id: string | null
}

interface DashboardStoreCtxValue {
  storeId: string | null
  store: StoreSummary | null
  stores: StoreSummary[]
  setActiveStoreId: (id: string) => void
  loading: boolean
  refreshStores: () => Promise<void>
}

const DashboardStoreCtx = createContext<DashboardStoreCtxValue>({
  storeId: null,
  store: null,
  stores: [],
  setActiveStoreId: () => {},
  loading: true,
  refreshStores: async () => {},
})

const STORAGE_KEY = 'lyte-active-store-id'

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStores = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('stores')
      .select('id, name, slug, logo_url, parent_store_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    const list = data ?? []
    setStores(list)

    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch {}

    const active = list.find(s => s.id === saved)?.id
      ?? list.find(s => !s.parent_store_id)?.id
      ?? list[0]?.id
      ?? null
    setStoreId(active)
    if (active) { try { localStorage.setItem(STORAGE_KEY, active) } catch {} }
    setLoading(false)
  }, [user])

  useEffect(() => { if (user) fetchStores() }, [user, fetchStores])

  function setActiveStoreId(id: string) {
    if (!stores.some(s => s.id === id)) return
    setStoreId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }

  const store = stores.find(s => s.id === storeId) ?? null

  return (
    <DashboardStoreCtx.Provider value={{ storeId, store, stores, setActiveStoreId, loading, refreshStores: fetchStores }}>
      {children}
    </DashboardStoreCtx.Provider>
  )
}

export function useDashboardStore(): DashboardStoreCtxValue {
  return useContext(DashboardStoreCtx)
}
