import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

async function verifyPin(storeId: string, pin: string): Promise<{ store: { id: string; name: string } | null; denied: boolean }> {
  const { data: store } = await supa
    .from('stores')
    .select('id, name, checkout_settings')
    .eq('id', storeId)
    .maybeSingle()

  if (!store) return { store: null, denied: false }

  const cajeroPIN: string | undefined = (store.checkout_settings as Record<string, unknown> | null)?.cajeroPIN as string | undefined
  if (cajeroPIN && cajeroPIN.trim() !== '' && cajeroPIN !== pin) {
    return { store: null, denied: true }
  }

  return { store: { id: store.id, name: store.name }, denied: false }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')
  if (!storeId) return Response.json({ error: 'Missing storeId' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const { store, denied } = await verifyPin(storeId, pin)

  if (denied) return Response.json({ error: 'PIN incorrecto', requiresPin: true }, { status: 401 })
  if (!store)  return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  // Check if store has a PIN configured (so client knows to show PIN screen)
  const { data: storeRow } = await supa.from('stores').select('checkout_settings').eq('id', storeId).maybeSingle()
  const hasPin = Boolean((storeRow?.checkout_settings as Record<string, unknown> | null)?.cajeroPIN)

  const { data: orders } = await supa
    .from('orders')
    .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_status,total,status,created_at,delivery_type')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(500)

  return Response.json({ store, orders: orders ?? [], hasPin })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const { orderId, status, storeId } = body
  if (!orderId || !status || !storeId) return Response.json({ error: 'Missing fields' }, { status: 400 })
  if (!['approved', 'rejected', 'pending'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const { store, denied } = await verifyPin(storeId, pin)
  if (denied) return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  if (!store)  return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { data: order } = await supa.from('orders').select('store_id').eq('id', orderId).maybeSingle()
  if (!order || order.store_id !== storeId) return Response.json({ error: 'Not found' }, { status: 404 })

  await supa.from('orders').update({ payment_status: status }).eq('id', orderId)
  return Response.json({ ok: true })
}
