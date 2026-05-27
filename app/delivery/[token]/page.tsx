import { createClient } from '@supabase/supabase-js'
import TrackingClient from './TrackingClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', token)
    .maybeSingle()

  let trackingConfig: Record<string, string> | null = null
  let driverInfo: { name: string; phone: string | null; vehicle: string | null; rating: number | null; avatar_url: string | null } | null = null

  if (delivery?.store_id) {
    const [{ data: store }, { data: driver }] = await Promise.all([
      supabase.from('stores').select('template_config').eq('id', delivery.store_id).maybeSingle(),
      delivery.driver_id
        ? supabase.from('delivery_drivers').select('name,phone,vehicle,rating,avatar_url').eq('id', delivery.driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const cfg = store?.template_config as Record<string, unknown> | null
    if (cfg?.trackingConfig) trackingConfig = cfg.trackingConfig as Record<string, string>
    if (driver) driverInfo = driver as NonNullable<typeof driverInfo>
  }

  return (
    <TrackingClient
      initialDelivery={delivery}
      token={token}
      trackingConfig={trackingConfig}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
      driver={driverInfo}
    />
  )
}
