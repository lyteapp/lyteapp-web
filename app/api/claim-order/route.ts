export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const sel = 'id,customer_name,customer_phone,delivery_address,notes,status,picked_up_at,order_id,customer_lat,customer_lng'

type DeliveryRow = Record<string, unknown>

export async function POST(req: NextRequest) {
  const { orderId, driverId, storeId, customerName, customerPhone, deliveryAddress } = await req.json()

  if (!orderId || !driverId || !storeId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // Already assigned to this driver? Use limit(1) to avoid error when multiple rows exist
  const { data: mineRows } = await supabase.from('deliveries')
    .select(sel)
    .eq('order_id', orderId)
    .eq('driver_id', driverId)
    .not('status', 'eq', 'cancelled')
    .limit(1)

  const mine = (mineRows as DeliveryRow[] | null)?.[0] ?? null
  if (mine) return NextResponse.json({ delivery: mine })

  // Find any unassigned delivery for this order (limit 1 handles duplicate records)
  const { data: existingRows } = await supabase.from('deliveries')
    .select('id')
    .eq('order_id', orderId)
    .is('driver_id', null)
    .not('status', 'eq', 'cancelled')
    .limit(1)

  const existing = (existingRows as { id: string }[] | null)?.[0] ?? null

  if (existing) {
    const { data: updRows, error: updateError } = await supabase.from('deliveries')
      .update({ driver_id: driverId, status: 'ready' })
      .eq('id', existing.id)
      .is('driver_id', null)
      .select(sel)

    const updated = (updRows as DeliveryRow[] | null)?.[0] ?? null
    if (!updateError && updated) return NextResponse.json({ delivery: updated })

    // Race lost — did it end up ours?
    const { data: raceRows } = await supabase.from('deliveries')
      .select(sel)
      .eq('order_id', orderId)
      .eq('driver_id', driverId)
      .not('status', 'eq', 'cancelled')
      .limit(1)

    const raceWin = (raceRows as DeliveryRow[] | null)?.[0] ?? null
    if (raceWin) return NextResponse.json({ delivery: raceWin })

    return NextResponse.json(
      { error: 'taken', debug: { stage: 'update', msg: updateError?.message } },
      { status: 409 }
    )
  }

  // No delivery record — create one
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
  }).select(sel)

  const inserted = (insRows as DeliveryRow[] | null)?.[0] ?? null
  if (!insertError && inserted) return NextResponse.json({ delivery: inserted })

  // Insert failed — last-resort check
  const { data: lastRows } = await supabase.from('deliveries')
    .select(sel)
    .eq('order_id', orderId)
    .eq('driver_id', driverId)
    .not('status', 'eq', 'cancelled')
    .limit(1)

  const lastResort = (lastRows as DeliveryRow[] | null)?.[0] ?? null
  if (lastResort) return NextResponse.json({ delivery: lastResort })

  return NextResponse.json(
    { error: 'taken', debug: { stage: 'insert', msg: insertError?.message } },
    { status: 409 }
  )
}
