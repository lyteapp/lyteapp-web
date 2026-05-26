import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import DriverClient from './DriverClient'
import './driver.css'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function generateMetadata(
  { params }: { params: Promise<{ driverId: string }> }
): Promise<Metadata> {
  const { driverId } = await params
  const { data } = await supabase
    .from('delivery_drivers')
    .select('name, stores(name)')
    .eq('id', driverId)
    .maybeSingle()
  if (!data) return { title: 'Despachador no encontrado' }
  const store = (data.stores as unknown as { name: string } | null)?.name ?? ''
  return { title: `${data.name} · ${store}` }
}

export default async function DriverPage(
  { params }: { params: Promise<{ driverId: string }> }
) {
  const { driverId } = await params

  const [{ data: driver }, { data: activeDelivery }] = await Promise.all([
    supabase
      .from('delivery_drivers')
      .select('id, name, store_id, is_active, stores(name, logo_url)')
      .eq('id', driverId)
      .maybeSingle(),
    supabase
      .from('deliveries')
      .select('customer_name, delivery_address, status, notes')
      .eq('driver_id', driverId)
      .in('status', ['ready', 'picked_up'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!driver) notFound()

  return (
    <DriverClient
      driverId={driver.id}
      driverName={driver.name}
      storeId={driver.store_id}
      storeName={(driver.stores as unknown as { name: string; logo_url: string | null } | null)?.name ?? ''}
      storeLogo={(driver.stores as unknown as { name: string; logo_url: string | null } | null)?.logo_url ?? null}
      activeDelivery={activeDelivery as { customer_name: string; delivery_address: string; status: string; notes: string | null } | null}
    />
  )
}
