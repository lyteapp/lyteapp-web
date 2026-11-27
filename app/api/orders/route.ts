import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// A delivery order has to come from a point inside one of the store's delivery
// zones (when it has any). If the check itself can't run, the order goes through:
// a lookup problem must never stop a store from taking orders.
async function zoneProblem(storeId: string, lat: unknown, lng: unknown): Promise<string | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_KEY) return null
    const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
    const [zonesRes, storeRes] = await Promise.all([
      svc.from('delivery_zones').select('center_lat, center_lng, radius_m').eq('store_id', storeId),
      svc.from('stores').select('checkout_settings').eq('id', storeId).maybeSingle(),
    ])
    if (zonesRes.error || storeRes.error) return null
    const zones = zonesRes.data ?? []
    const cs = (storeRes.data?.checkout_settings ?? {}) as { showLocationBox?: boolean }
    if (!zones.length || cs.showLocationBox === false) return null
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return 'Marca tu ubicación en el mapa o comparte tu GPS para confirmar que estás dentro de una zona de entrega'
    }
    // (1 m of slack: the browser and the server round the distance differently)
    const inside = zones.some(z => metersBetween(lat, lng, Number(z.center_lat), Number(z.center_lng)) <= Number(z.radius_m) + 1)
    return inside ? null : 'Tu ubicación está fuera de las zonas de entrega. Elige una ubicación dentro de la cobertura para continuar'
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id, store_id, customer_name, customer_phone, customer_notes,
      payment_method, total, delivery_type, service_type, payment_proof_url, items, kiosk_cash, from_kiosk,
      customer_lat, customer_lng, zone_check,
    } = body

    if (!id || !store_id || !customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // (only enforced for clients that say they ran the zone check, so a page
    // opened before this rule shipped doesn't get its orders refused)
    if (delivery_type === 'delivery' && zone_check === true) {
      const problem = await zoneProblem(store_id, customer_lat, customer_lng)
      if (problem) return NextResponse.json({ error: problem }, { status: 422 })
    }

    // Use anon key — same RLS policy that lets the browser insert orders
    // directly also covers this route; running the insert server-side just
    // skips the customer's own (often mobile, sometimes slow) connection to
    // Supabase in favor of a single fast hop to this function.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Claims the next sequential number for this store atomically (via a
    // security-definer function) — two orders landing at the same instant
    // never get the same number. Falls back to no number rather than
    // failing the order if the RPC has any trouble.
    const { data: orderNumber } = await supabase.rpc('get_next_order_number', { p_store_id: store_id })

    // Débito inmediato: the customer pays right after this (/api/pay/debito),
    // so the order waits unpaid until the bank approves — and the store hears
    // about it then, not now.
    const bankDebit = payment_method === 'Débito inmediato'

    const { error: orderError } = await supabase.from('orders').insert({
      id, store_id,
      customer_name, customer_phone,
      customer_notes: customer_notes || null,
      payment_method: payment_method || null,
      total, status: 'pending',
      delivery_type,
      service_type: service_type === 'dine_in' || service_type === 'takeout' ? service_type : null,
      order_number: orderNumber ?? null,
      payment_proof_url: payment_proof_url || null,
      // a payment the staff collects in person (cash at a kiosk, or the
      // point-of-sale terminal): the Caja screen shows it until it's marked
      // collected — loudly when the customer is waiting at a kiosk
      cash_call_at: kiosk_cash === true ? new Date().toISOString() : null,
      from_kiosk: from_kiosk === true,
      payment_status: payment_proof_url || kiosk_cash === true || bankDebit ? 'pending' : null,
    })

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (Array.isArray(items) && items.length > 0) {
      const { error: itemsError } = await supabase.from('order_items').insert(
        items.map((i: {
          product_id: string; product_name: string; product_price: number
          quantity: number; subtotal: number; selected_options: unknown
        }) => ({
          order_id: id,
          product_id: i.product_id, product_name: i.product_name, product_price: i.product_price,
          quantity: i.quantity, subtotal: i.subtotal, selected_options: i.selected_options ?? null,
        }))
      )
      if (itemsError) console.error('order_items insert failed', itemsError)
    }

    // Scheduled via after() rather than a bare unawaited fetch — on a
    // serverless platform the function can be torn down the moment the
    // response below is sent, which was cutting the push request off
    // before it ever reached web-push. after() keeps the invocation alive
    // until this finishes, without making the customer wait on it.
    const origin = req.nextUrl.origin
    if (!bankDebit) after(async () => {
      try {
        await fetch(new URL('/api/push-owner', origin), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: store_id,
            title: 'Nuevo pedido',
            body: `${customer_name} · $${Number(total).toFixed(2)}`,
            url: '/dashboard/pedidos',
          }),
        })
      } catch (err) {
        console.error('push-owner notify failed', err)
      }
    })

    return NextResponse.json({ id, order_number: orderNumber ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
