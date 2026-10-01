import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Assigns a locker to an order from the dedicated locker-display kiosk —
// only allowed on an order that's 'ready' and not already in a locker, and
// only onto a locker no other active order currently holds.
export async function POST(req: NextRequest) {
  const { orderId, storeId, lockerNumber } = await req.json().catch(() => ({}))
  if (!orderId || !storeId || !lockerNumber) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { data: order, error: findError } = await supabase
    .from('orders')
    .select('id, store_id, status, locker_number')
    .eq('id', orderId)
    .maybeSingle()

  if (findError || !order || order.store_id !== storeId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'ready') {
    return NextResponse.json({ error: 'Este pedido no esta listo' }, { status: 400 })
  }
  if (order.locker_number != null) {
    return NextResponse.json({ error: 'Este pedido ya tiene un casillero' }, { status: 400 })
  }

  const { data: taken } = await supabase
    .from('orders')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'ready')
    .eq('locker_number', lockerNumber)
    .maybeSingle()
  if (taken) return NextResponse.json({ error: 'Ese casillero ya esta ocupado' }, { status: 409 })

  const { error: updateError } = await supabase.from('orders').update({ locker_number: lockerNumber }).eq('id', orderId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
