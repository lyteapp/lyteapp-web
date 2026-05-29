import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

type Cajera = { id: string; name: string; pin: string }

type VerifyResult =
  | { store: { id: string; name: string }; cajera: Cajera | null; denied: false }
  | { store: null; cajera: null; denied: boolean }

async function verifyPin(storeId: string, pin: string): Promise<VerifyResult> {
  const { data: store } = await supa
    .from('stores')
    .select('id, name, checkout_settings')
    .eq('id', storeId)
    .maybeSingle()

  if (!store) return { store: null, cajera: null, denied: false }

  const cs = (store.checkout_settings as Record<string, unknown> | null) ?? {}
  const cajeras = (cs.cajeros as Cajera[] | undefined) ?? []

  // Multi-cashier mode: match by individual PIN
  if (cajeras.length > 0) {
    const matched = cajeras.find(c => c.pin === pin)
    if (!matched) return { store: null, cajera: null, denied: true }
    return { store: { id: store.id, name: store.name }, cajera: matched, denied: false }
  }

  // Legacy single-PIN mode
  const cajeroPIN = cs.cajeroPIN as string | undefined
  if (cajeroPIN && cajeroPIN.trim() !== '' && cajeroPIN !== pin) {
    return { store: null, cajera: null, denied: true }
  }

  return { store: { id: store.id, name: store.name }, cajera: null, denied: false }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')
  if (!storeId) return Response.json({ error: 'Missing storeId' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const result = await verifyPin(storeId, pin)

  if (result.denied) return Response.json({ error: 'PIN incorrecto', requiresPin: true }, { status: 401 })
  if (!result.store) return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { data: orders } = await supa
    .from('orders')
    .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_status,payment_verified_by,total,status,created_at,delivery_type')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(500)

  return Response.json({
    store: result.store,
    cajera: result.cajera,
    orders: orders ?? [],
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const { orderId, status, storeId, verifiedBy } = body
  if (!orderId || !status || !storeId) return Response.json({ error: 'Missing fields' }, { status: 400 })
  if (!['approved', 'rejected', 'pending'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const result = await verifyPin(storeId, pin)
  if (result.denied) return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  if (!result.store) return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { data: order } = await supa.from('orders').select('store_id').eq('id', orderId).maybeSingle()
  if (!order || order.store_id !== storeId) return Response.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = { payment_status: status }
  if (verifiedBy && status === 'approved') update.payment_verified_by = verifiedBy

  await supa.from('orders').update(update).eq('id', orderId)
  return Response.json({ ok: true })
}
