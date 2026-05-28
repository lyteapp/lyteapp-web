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
  const title = `${data.name} · Despachos`
  return {
    title,
    manifest: `/api/driver-manifest/${driverId}`,
    themeColor: '#7C3AED',
    appleWebApp: {
      capable: true,
      title: data.name,
      statusBarStyle: 'default',
    },
    icons: {
      apple: '/api/driver-icon?size=192',
      other: { rel: 'icon', url: '/api/driver-icon?size=192' },
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'application-name': data.name,
      'msapplication-TileColor': '#7C3AED',
      'store-name': store,
    },
  }
}

export default async function DriverPage(
  { params }: { params: Promise<{ driverId: string }> }
) {
  const { driverId } = await params

  const { data: driver } = await supa
    .from('delivery_drivers')
    .select('id, name, store_id, is_active, avatar_url, stores(name, logo_url)')
    .eq('id', driverId)
    .maybeSingle()

  if (!driver) notFound()

  const { data: activeDelivery } = await supa
    .from('deliveries')
    .select('id, customer_name, customer_phone, delivery_address, notes, status, picked_up_at, order_id, customer_lat, customer_lng')
    .eq('driver_id', driverId)
    .in('status', ['ready', 'picked_up'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <DriverClient
      driverId={driver.id}
      driverName={driver.name}
      driverAvatar={(driver as unknown as { avatar_url: string | null }).avatar_url ?? null}
      storeId={driver.store_id}
      storeName={(driver.stores as unknown as { name: string; logo_url: string | null } | null)?.name ?? ''}
      storeLogo={(driver.stores as unknown as { name: string; logo_url: string | null } | null)?.logo_url ?? null}
      initialDelivery={activeDelivery as ActiveDelivery | null}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
    />
  )
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
  customer_lat: number | null
  customer_lng: number | null
}
