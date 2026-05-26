import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import DriverClient from './DriverClient'
import './driver.css'

export const dynamic = 'force-dynamic'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function generateMetadata(
  { params }: { params: Promise<{ driverId: string }> }
): Promise<Metadata> {
  const { driverId } = await params
  const { data } = await supa
    .from('delivery_drivers')
    .select('name, stores(name)')
    .eq('id', driverId)
    .maybeSingle()
  if (!data) return { title: 'Despachador' }
  const store = (data.stores as unknown as { name: string } | null)?.name ?? ''
  return { title: `${data.name} · ${store}` }
}

export default async function DriverPage(
  { params }: { params: Promise<{ driverId: string }> }
) {
  const { driverId } = await params

  const { data: driver } = await supa
    .from('delivery_drivers')
    .select('id, name, store_id, is_active, stores(name, logo_url)')
    .eq('id', driverId)
    .maybeSingle()

  if (!driver) notFound()

  const storeId = driver.store_id

  const [
    { data: activeDelivery },
    { data: readyOrders },
    { data: claimedDeliveries },
  ] = await Promise.all([
    // Active delivery: assigned to this driver and still in progress
    supa
      .from('deliveries')
      .select('id, customer_name, customer_phone, delivery_address, notes, status, picked_up_at, order_id')
      .eq('driver_id', driverId)
      .in('status', ['ready', 'picked_up'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // All ready orders for this store
    supa
      .from('orders')
      .select('id, customer_name, customer_phone, customer_notes, payment_method, total, created_at')
      .eq('store_id', storeId)
      .eq('status', 'ready')
      .order('created_at', { ascending: true }),
    // Orders already claimed (have a delivery with a driver)
    supa
      .from('deliveries')
      .select('order_id')
      .eq('store_id', storeId)
      .not('order_id', 'is', null)
      .not('status', 'eq', 'cancelled'),
  ])

  const claimedIds = new Set((claimedDeliveries ?? []).map(d => d.order_id))
  const availableOrders = (readyOrders ?? []).filter(o => !claimedIds.has(o.id))

  return (
    <DriverClient
      driverId={driver.id}
      driverName={driver.name}
      storeId={storeId}
      storeName={(driver.stores as unknown as { name: string; logo_url: string | null } | null)?.name ?? ''}
      storeLogo={(driver.stores as unknown as { name: string; logo_url: string | null } | null)?.logo_url ?? null}
      initialOrders={availableOrders as AvailableOrder[]}
      initialDelivery={activeDelivery as ActiveDelivery | null}
    />
  )
}

export type AvailableOrder = {
  id: string
  customer_name: string
  customer_phone: string
  customer_notes: string | null
  payment_method: string | null
  total: number
  created_at: string
}

export type ActiveDelivery = {
  id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  notes: string | null
  status: string
  picked_up_at: string | null
  order_id: string | null
}
