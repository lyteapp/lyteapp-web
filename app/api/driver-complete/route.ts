import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const { deliveryId, orderId, driverId } = body
  if (!deliveryId || !driverId) return Response.json({ error: 'Missing fields' }, { status: 400 })

  // Verify the delivery belongs to this driver
  const { data: delivery } = await supa
    .from('deliveries')
    .select('id, driver_id, order_id, status')
    .eq('id', deliveryId)
    .maybeSingle()

  if (!delivery) return Response.json({ error: 'Delivery not found' }, { status: 404 })
  if (delivery.driver_id !== driverId) return Response.json({ error: 'Unauthorized' }, { status: 403 })
  if (delivery.status === 'delivered') return Response.json({ ok: true })

  const now = new Date().toISOString()

  await supa
    .from('deliveries')
    .update({ status: 'delivered', delivered_at: now })
    .eq('id', deliveryId)

  const resolvedOrderId = orderId ?? delivery.order_id
  if (resolvedOrderId) {
    await supa
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', resolvedOrderId)
  }

  return Response.json({ ok: true })
}
