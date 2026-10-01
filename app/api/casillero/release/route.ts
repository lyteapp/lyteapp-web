import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Confirms pickup from the dedicated locker-display kiosk: only allowed on
// an order that's actually sitting in a locker for this exact store, and
// only moves it to 'delivered' — nothing else about the order changes.
export async function POST(req: NextRequest) {
  const { orderId, storeId } = await req.json().catch(() => ({}))
  if (!orderId || !storeId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { data: order, error: findError } = await supabase
    .from('orders')
    .select('id, store_id, status, locker_number')
    .eq('id', orderId)
    .maybeSingle()

  if (findError || !order || order.store_id !== storeId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'ready' || order.locker_number == null) {
    return NextResponse.json({ error: 'Este pedido no esta en un casillero' }, { status: 400 })
  }

  const { error: updateError } = await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
