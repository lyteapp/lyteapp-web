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
    .select('id,customer_name,customer_phone,payment_method,payment_proof_url,payment_status,payment_verified_by,payment_split,payment_modified_by,payment_modified_at,payment_note,payment_note_by,payment_note_at,total,status,created_at,delivery_type,order_number,cash_call_at,from_kiosk')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(500)

  return Response.json({
    store: result.store,
    cajera: result.cajera,
    orders: orders ?? [],
  })
}

// The ways Caja can record a payment (the labels the Caja screens know)
const PAY_METHODS = ['Efectivo USD', 'Efectivo Bs', 'Punto de Venta', 'Pago Móvil', 'Transferencia Bs', 'Zelle', 'USDT', 'Binance Pay']

type PayLine = { method: string; amount: number }

function parseSplit(raw: unknown): PayLine[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > PAY_METHODS.length) return null
  const byMethod = new Map<string, number>()
  for (const l of raw) {
    const method = (l as PayLine | null)?.method
    const amount = Number((l as PayLine | null)?.amount)
    if (typeof method !== 'string' || !PAY_METHODS.includes(method)) return null
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null
    byMethod.set(method, Math.round(((byMethod.get(method) ?? 0) + amount) * 100) / 100)
  }
  return [...byMethod.entries()].map(([method, amount]) => ({ method, amount }))
}

// Record how an order was paid (one method or several) from Caja. The first
// time it is the cashier verifying the payment; changing one already
// recorded is marked as modified, with who did it.
async function setPayment(req: Request, body: Record<string, unknown>) {
  const { orderId, storeId, verifiedBy } = body as { orderId?: string; storeId?: string; verifiedBy?: string }
  if (!orderId || !storeId) return Response.json({ error: 'Missing fields' }, { status: 400 })
  const split = parseSplit(body.split)
  if (!split) return Response.json({ error: 'Pago inválido' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const result = await verifyPin(storeId, pin)
  if (result.denied) return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  if (!result.store) return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { data: order } = await supa.from('orders')
    .select('store_id, status, total, cash_call_at, delivery_type, payment_status, payment_verified_by, payment_split')
    .eq('id', orderId).maybeSingle()
  if (!order || order.store_id !== storeId) return Response.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 'cancelled') return Response.json({ error: 'El pedido está cancelado' }, { status: 400 })

  const sum = Math.round(split.reduce((a, l) => a + l.amount, 0) * 100)
  if (Math.abs(sum - Math.round(Number(order.total) * 100)) > 1) {
    return Response.json({ error: `Las partes deben sumar $${Number(order.total).toFixed(2)}` }, { status: 400 })
  }

  const who = result.cajera?.name || verifiedBy || 'Caja'
  const wasRecorded = !!order.payment_verified_by || !!order.payment_split
  const update: Record<string, unknown> = {
    payment_method: split.length > 1 ? 'Mixto' : split[0].method,
    payment_split: split.length > 1 ? split : null,
    payment_status: 'approved',
  }
  if (wasRecorded) {
    update.payment_modified_by = who
    update.payment_modified_at = new Date().toISOString()
  } else {
    update.payment_verified_by = who
    // a counter / kiosk payment is confirmed the moment it is collected
    if (order.cash_call_at && order.delivery_type !== 'delivery' && order.status === 'pending') update.status = 'confirmed'
  }

  const { error } = await supa.from('orders').update(update).eq('id', orderId)
  if (error) return Response.json({ error: 'No se pudo guardar el pago' }, { status: 500 })
  return Response.json({ ok: true, by: who, modified: wasRecorded, update })
}

// A note on an order's payment, left by the cashier (an empty note removes it)
async function setNote(req: Request, body: Record<string, unknown>) {
  const { orderId, storeId, verifiedBy } = body as { orderId?: string; storeId?: string; verifiedBy?: string }
  if (!orderId || !storeId || typeof body.note !== 'string') return Response.json({ error: 'Missing fields' }, { status: 400 })
  const note = body.note.trim()
  if (note.length > 300) return Response.json({ error: 'La nota es muy larga (máximo 300 caracteres)' }, { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const result = await verifyPin(storeId, pin)
  if (result.denied) return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  if (!result.store) return Response.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { data: order } = await supa.from('orders').select('store_id').eq('id', orderId).maybeSingle()
  if (!order || order.store_id !== storeId) return Response.json({ error: 'Not found' }, { status: 404 })

  const who = result.cajera?.name || verifiedBy || 'Caja'
  const update = note
    ? { payment_note: note, payment_note_by: who, payment_note_at: new Date().toISOString() }
    : { payment_note: null, payment_note_by: null, payment_note_at: null }
  const { error } = await supa.from('orders').update(update).eq('id', orderId)
  if (error) return Response.json({ error: 'No se pudo guardar la nota' }, { status: 500 })
  return Response.json({ ok: true, update })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })
  if (body.action === 'set_payment') return setPayment(req, body)
  if (body.action === 'set_note') return setNote(req, body)

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
