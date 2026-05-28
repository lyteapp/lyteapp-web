import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')
  if (!storeId) return Response.json({ error: 'Missing storeId' }, { status: 400 })

  const { data: store } = await supa.from('stores').select('id, name').eq('id', storeId).maybeSingle()
  if (!store) return Response.json({ error: 'Store not found' }, { status: 404 })

  const { data: orders } = await supa
    .from('orders')
    .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_status,total,status,created_at,delivery_type')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(500)

  return Response.json({ store, orders: orders ?? [] })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const { orderId, status, storeId } = body
  if (!orderId || !status || !storeId) return Response.json({ error: 'Missing fields' }, { status: 400 })
  if (!['approved', 'rejected', 'pending'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })

  const { data: order } = await supa.from('orders').select('store_id').eq('id', orderId).maybeSingle()
  if (!order || order.store_id !== storeId) return Response.json({ error: 'Not found' }, { status: 404 })

  await supa.from('orders').update({ payment_status: status }).eq('id', orderId)
  return Response.json({ ok: true })
}
