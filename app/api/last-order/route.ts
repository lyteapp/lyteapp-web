import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('store_id')
  const phone = searchParams.get('phone')?.replace(/\D/g, '')
  if (!storeId || !phone) return Response.json({ error: 'Missing store_id or phone' }, { status: 400 })

  const last8 = phone.slice(-8)
  const { data: orders, error } = await supa
    .from('orders')
    .select('id, created_at')
    .eq('store_id', storeId)
    .neq('status', 'cancelled')
    .ilike('customer_phone', `%${last8}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('last-order GET failed:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const order = orders?.[0]
  if (!order) return Response.json({ found: false })

  const { data: items, error: itemsErr } = await supa
    .from('order_items')
    .select('product_id, product_name, product_price, quantity, selected_options')
    .eq('order_id', order.id)

  if (itemsErr) {
    console.error('last-order items failed:', itemsErr.message)
    return Response.json({ error: itemsErr.message }, { status: 500 })
  }

  return Response.json({ found: true, orderId: order.id, createdAt: order.created_at, items: items ?? [] })
}
