import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// "Volver a anunciar" on the locker screen: stamps locker_notified_at on an
// order that's sitting in a locker for this store, which puts its big
// announcement (and voice) up again on the public queue board and a
// reminder on the customer's tracking page. Not again while the last one is
// still going on the board (its 9s announcement, plus a beat).
const MIN_GAP_MS = 10000

export async function POST(req: NextRequest) {
  const { orderId, storeId } = await req.json().catch(() => ({}))
  if (!orderId || !storeId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { data: order, error: findError } = await supabase
    .from('orders')
    .select('id, store_id, status, locker_number, locker_notified_at')
    .eq('id', orderId)
    .maybeSingle()

  if (findError || !order || order.store_id !== storeId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'ready' || order.locker_number == null) {
    return NextResponse.json({ error: 'Este pedido no esta en un casillero' }, { status: 400 })
  }
  if (order.locker_notified_at && Date.now() - new Date(order.locker_notified_at).getTime() < MIN_GAP_MS) {
    return NextResponse.json({ ok: true, already: true })
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ locker_notified_at: new Date().toISOString() })
    .eq('id', orderId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
