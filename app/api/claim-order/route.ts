export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const sel = 'id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id,customer_lat,customer_lng'

export async function POST(req: NextRequest) {
  const { orderId, driverId, storeId, customerName, customerPhone, deliveryAddress } = await req.json()

  if (!orderId || !driverId || !storeId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // Already assigned to this driver?
  const { data: mine } = await supabase.from('deliveries')
    .select(sel)
    .eq('order_id', orderId)
    .eq('driver_id', driverId)
    .not('status', 'eq', 'cancelled')
    .maybeSingle()

  if (mine) return NextResponse.json({ delivery: mine })

  // Find any unassigned delivery for this order
  const { data: existing } = await supabase.from('deliveries')
    .select('id')
    .eq('order_id', orderId)
    .is('driver_id', null)
    .not('status', 'eq', 'cancelled')
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase.from('deliveries')
      .update({ driver_id: driverId, status: 'ready' })
      .eq('id', existing.id)
      .is('driver_id', null) // race guard
      .select(sel)
      .single()

    if (!error && data) return NextResponse.json({ delivery: data })

    // Race lost — check if it ended up ours anyway
    const { data: mineNow } = await supabase.from('deliveries')
      .select(sel)
      .eq('order_id', orderId)
      .eq('driver_id', driverId)
      .not('status', 'eq', 'cancelled')
      .maybeSingle()

    if (mineNow) return NextResponse.json({ delivery: mineNow })
    return NextResponse.json({ error: 'taken' }, { status: 409 })
  }

  // No delivery record — create one
  const { data, error } = await supabase.from('deliveries').insert({
    store_id: storeId,
    order_id: orderId,
    driver_id: driverId,
    customer_name: customerName,
    customer_phone: customerPhone ?? '',
    delivery_address: deliveryAddress ?? '',
    status: 'ready',
    driver_fee: 0,
    fee_paid: false,
  }).select(sel).single()

  if (error) {
    // Insert failed — another record may have appeared; last-resort check
    const { data: mineNow } = await supabase.from('deliveries')
      .select(sel)
      .eq('order_id', orderId)
      .eq('driver_id', driverId)
      .not('status', 'eq', 'cancelled')
      .maybeSingle()

    if (mineNow) return NextResponse.json({ delivery: mineNow })
    return NextResponse.json({ error: 'taken' }, { status: 409 })
  }

  return NextResponse.json({ delivery: data })
}
