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
  if (delivery?.store_id) {
    const { data: store } = await supabase
      .from('stores')
      .select('template_config')
      .eq('id', delivery.store_id)
      .maybeSingle()
    const cfg = store?.template_config as Record<string, unknown> | null
    if (cfg?.trackingConfig) trackingConfig = cfg.trackingConfig as Record<string, string>
  }

  return (
    <TrackingClient
      initialDelivery={delivery}
      token={token}
      trackingConfig={trackingConfig}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
    />
  )
}
