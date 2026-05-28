export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Anon key — same as client-side. RLS policies on deliveries allow
// select/update for drivers and insert when is_customer_order = true.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } }
)

const sel = 'id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id,customer_lat,customer_lng'

type Row = Record<string, unknown>
const first = (rows: Row[] | null) => rows?.[0] ?? null

export async function POST(req: NextRequest) {
  const { orderId, driverId, storeId, customerName, customerPhone, deliveryAddress } = await req.json()

  if (!orderId || !driverId || !storeId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // Already assigned to this driver?
  const { data: mineRows } = await supabase.from('deliveries')
    .select(sel)
    .eq('order_id', orderId)
    .eq('driver_id', driverId)
    .not('status', 'eq', 'cancelled')
    .limit(1)

  const mine = first(mineRows as Row[] | null)
  if (mine) return NextResponse.json({ delivery: mine })

  // Find any unassigned delivery for this order
  const { data: existingRows } = await supabase.from('deliveries')
    .select('id')
    .eq('order_id', orderId)
    .is('driver_id', null)
    .not('status', 'eq', 'cancelled')
    .limit(1)

  const existing = first(existingRows as Row[] | null)

  if (existing) {
    const { data: updRows, error: updateError } = await supabase.from('deliveries')
      .update({ driver_id: driverId, status: 'ready' })
      .eq('id', existing.id)
      .is('driver_id', null)
      .select(sel)

    const updated = first(updRows as Row[] | null)
    if (!updateError && updated) return NextResponse.json({ delivery: updated })

    // Race lost — check if it ended up ours
    const { data: raceRows } = await supabase.from('deliveries')
      .select(sel)
      .eq('order_id', orderId)
      .eq('driver_id', driverId)
      .not('status', 'eq', 'cancelled')
      .limit(1)

    const raceWin = first(raceRows as Row[] | null)
    if (raceWin) return NextResponse.json({ delivery: raceWin })

    return NextResponse.json(
      { error: 'taken', debug: { stage: 'update', msg: updateError?.message } },
      { status: 409 }
    )
  }

  // No delivery record — create one.
  // is_customer_order: true is required by the deliveries_customer_insert RLS policy.
  const { data: insRows, error: insertError } = await supabase.from('deliveries').insert({
    store_id: storeId,
    order_id: orderId,
    driver_id: driverId,
    customer_name: customerName,
    customer_phone: customerPhone ?? '',
    delivery_address: deliveryAddress ?? '',
    status: 'ready',
    driver_fee: 0,
    fee_paid: false,
    is_customer_order: true,
  }).select(sel)

  const inserted = first(insRows as Row[] | null)
  if (!insertError && inserted) return NextResponse.json({ delivery: inserted })

  // Last-resort check
  const { data: lastRows } = await supabase.from('deliveries')
    .select(sel)
    .eq('order_id', orderId)
    .eq('driver_id', driverId)
    .not('status', 'eq', 'cancelled')
    .limit(1)

  const lastResort = first(lastRows as Row[] | null)
  if (lastResort) return NextResponse.json({ delivery: lastResort })

  return NextResponse.json(
    { error: 'taken', debug: { stage: 'insert', msg: insertError?.message } },
    { status: 409 }
  )
}
