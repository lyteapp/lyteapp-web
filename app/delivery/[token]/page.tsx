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

  return <TrackingClient initialDelivery={delivery} token={token} />
}
