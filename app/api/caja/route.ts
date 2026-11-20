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

async function hasCajaPin(storeId: string) {
  const { data: store } = await supa.from('stores').select('checkout_settings').eq('id', storeId).maybeSingle()
  const cs = (store?.checkout_settings as Record<string, unknown> | null) ?? {}
  const cajeras = (cs.cajeros as Cajera[] | undefined) ?? []
  return cajeras.some(c => !!c.pin) || !!(cs.cajeroPIN as string | undefined)?.trim()
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
    .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_status,payment_verified_by,total,status,created_at,delivery_type,order_number,cash_call_at,from_kiosk')
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

  const { orderId, status, storeId, verifiedBy, source } = body
  if (!orderId || !status || !storeId) return Response.json({ error: 'Missing fields' }, { status: 400 })
  // the kitchen display can mark a counter payment collected too (when Caja
  // falls behind), always with a cashier's own PIN
  const fromKitchen = source === 'kitchen'
  if (!['approved', 'rejected', 'pending'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  if (fromKitchen) {
    if (!/^\d{1,12}$/.test(pin)) return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
    // a store with no cashier PIN at all would let any code through: not here
    if (!(await hasCajaPin(storeId))) return Response.json({ error: 'La tienda no tiene PIN de caja. Configúralo en el dashboard.' }, { status: 403 })
  }
  const result = await verifyPin(storeId, pin)
  if (result.denied) return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  if (!result.store) return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { data: order } = await supa.from('orders').select('store_id, status, cash_call_at, delivery_type, payment_status').eq('id', orderId).maybeSingle()
  if (!order || order.store_id !== storeId) return Response.json({ error: 'Not found' }, { status: 404 })
  if (fromKitchen && (status !== 'approved' || !order.cash_call_at)) return Response.json({ error: 'Desde cocina solo se marcan cobros de caja' }, { status: 400 })

  const update: Record<string, unknown> = { payment_status: status }
  if (status === 'approved') {
    // (the cashier is whoever's PIN it was)
    const who = result.cajera?.name || verifiedBy || 'Caja'
    if (fromKitchen) update.payment_verified_by = `${who} · desde cocina`
    else if (verifiedBy) update.payment_verified_by = verifiedBy
  }
  // An order waiting to be paid at the counter / kiosk (cash, point of sale,
  // not delivery) is confirmed the moment its payment is collected
  if (status === 'approved' && order.cash_call_at && order.delivery_type !== 'delivery' && order.status === 'pending') {
    update.status = 'confirmed'
  }

  await supa.from('orders').update(update).eq('id', orderId)
  return Response.json({ ok: true, by: result.cajera?.name ?? null })
}
