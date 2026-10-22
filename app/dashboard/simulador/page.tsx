'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useDashboardStore } from '../../lib/DashboardStoreProvider'
import { BuildingView, DEPTS, type Stats, type StoreLook } from './building'
import './simulador.css'

// The business as a building seen from the street, cut open: the ground
// floor is the store, and every floor above is a department of the app the
// merchant chooses to build. Each floor shows live data and opens its
// section of the dashboard. Built floors are saved in
// stores.checkout_settings.simFloors (bottom → top).

export default function SimuladorPage() {
  const { storeId } = useDashboardStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<StoreLook | null>(null)
  const [floors, setFloors] = useState<string[]>([])
  const [stats, setStats] = useState<Stats>({ ordersToday: 0, salesToday: 0, pending: 0, inRoute: 0, drivers: 0, lowStock: 0, items: 0, products: 0, customers: 0, week: [0, 0, 0, 0, 0, 0, 0], productImages: [] })
  const [hour, setHour] = useState(12)
  const [vw, setVw] = useState(1200)
  const [vh, setVh] = useState(800)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only on the client
  useEffect(() => { setMounted(true); setHour(new Date().getHours()) }, [])
  useEffect(() => {
    const fit = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    fit(); window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const load = useCallback(async (sid: string) => {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    const weekAgo = new Date(midnight.getTime() - 6 * 86400000)
    const [st, ord, dels, drv, items, stock, prods] = await Promise.all([
      supabase.from('stores').select('name, logo_url, template_config, checkout_settings').eq('id', sid).maybeSingle(),
      supabase.from('orders').select('status, total, created_at, customer_phone').eq('store_id', sid).gte('created_at', weekAgo.toISOString()),
      supabase.from('deliveries').select('status').eq('store_id', sid).eq('status', 'picked_up'),
      supabase.from('delivery_drivers').select('id').eq('store_id', sid).neq('is_active', false),
      supabase.from('inv_items').select('id, min_stock').eq('store_id', sid).eq('active', true),
      supabase.from('inv_stock').select('item_id, qty').eq('store_id', sid),
      supabase.from('products').select('image_url').eq('store_id', sid).eq('is_active', true).limit(40),
    ])
    const cfg = (st.data?.template_config ?? {}) as { accentColor?: string }
    const cs = (st.data?.checkout_settings ?? {}) as Record<string, unknown>
    setStore({ name: st.data?.name ?? 'Mi tienda', logo: st.data?.logo_url ?? null, accent: cfg.accentColor || '#9AB7FD' })
    setFloors(Array.isArray(cs.simFloors) ? (cs.simFloors as string[]).filter(id => DEPTS.some(d => d.id === id)) : [])

    const orders = (ord.data ?? []) as { status: string; total: number; created_at: string; customer_phone: string | null }[]
    const live = orders.filter(o => o.status !== 'cancelled')
    const today = live.filter(o => new Date(o.created_at) >= midnight)
    const week = Array.from({ length: 7 }, (_, i) => {
      const d0 = new Date(weekAgo.getTime() + i * 86400000), d1 = new Date(d0.getTime() + 86400000)
      return live.filter(o => { const t = new Date(o.created_at); return t >= d0 && t < d1 }).reduce((a, o) => a + (Number(o.total) || 0), 0)
    })
    const qty: Record<string, number> = {}
    for (const r of (stock.data ?? []) as { item_id: string; qty: number }[]) qty[r.item_id] = (qty[r.item_id] ?? 0) + (Number(r.qty) || 0)
    const its = (items.data ?? []) as { id: string; min_stock: number }[]
    setStats({
      ordersToday: today.length,
      salesToday: today.reduce((a, o) => a + (Number(o.total) || 0), 0),
      pending: today.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
      inRoute: (dels.data ?? []).length,
      drivers: (drv.data ?? []).length,
      items: its.length,
      lowStock: its.filter(i => Number(i.min_stock) > 0 && (qty[i.id] ?? 0) < Number(i.min_stock)).length,
      products: (prods.data ?? []).length,
      customers: new Set(live.map(o => o.customer_phone).filter(Boolean)).size,
      week,
      productImages: ((prods.data ?? []) as { image_url: string | null }[]).map(p => p.image_url).filter((u): u is string => !!u),
    })
    setLoading(false)
  }, [])
  useEffect(() => { if (storeId) Promise.resolve().then(() => load(storeId)) }, [storeId, load])
  // live-ish: refresh the numbers every 30 s
  useEffect(() => {
    if (!storeId) return
    const t = setInterval(() => load(storeId), 30000)
    return () => clearInterval(t)
  }, [storeId, load])

  async function saveFloors(next: string[]) {
    setFloors(next)
    if (!storeId) return
    const { data } = await supabase.from('stores').select('checkout_settings').eq('id', storeId).maybeSingle()
    const cs = { ...((data?.checkout_settings ?? {}) as Record<string, unknown>), simFloors: next }
    await supabase.from('stores').update({ checkout_settings: cs }).eq('id', storeId)
  }

  if (!mounted) return null
  return createPortal(
    <BuildingView loading={loading} store={store} floors={floors} stats={stats} hour={hour} vw={vw} vh={vh}
      onExit={() => router.push('/dashboard')} onSaveFloors={saveFloors} onNavigate={r => router.push(r)} />,
    document.body,
  )
}
