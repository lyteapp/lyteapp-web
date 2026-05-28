export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lyte-app.com'

export async function POST(req: NextRequest) {
  const { storeId } = await req.json()
  if (!storeId) return NextResponse.json({ error: 'missing storeId' }, { status: 400 })

  const { data: store } = await supabase
    .from('stores')
    .select('checkout_settings')
    .eq('id', storeId)
    .maybeSingle()

  const cs = (store?.checkout_settings as Record<string, unknown>) ?? {}
  const defaultFee = Number(cs.deliveryFee) || 0

  // Get available dispatchers sorted by time in queue (oldest first)
  const { data: availDrivers } = await supabase
    .from('delivery_drivers')
    .select('id, name')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .order('available_since', { ascending: true, nullsFirst: false })

  if (!availDrivers?.length) return NextResponse.json({ assigned: 0 })

  // Exclude dispatchers already on an active delivery
  const { data: busyRows } = await supabase
    .from('deliveries')
    .select('driver_id')
    .eq('store_id', storeId)
    .in('status', ['ready', 'picked_up'])
    .not('driver_id', 'is', null)

  const busyIds = new Set((busyRows ?? []).map((r: { driver_id: string }) => r.driver_id))
  const freeDrivers = availDrivers.filter(d => !busyIds.has(d.id))

  if (!freeDrivers.length) return NextResponse.json({ assigned: 0 })

  // Get unassigned ready deliveries sorted by order arrival (oldest first)
  const { data: unassigned } = await supabase
    .from('deliveries')
    .select('id, customer_name')
    .eq('store_id', storeId)
    .eq('status', 'ready')
    .is('driver_id', null)
    .order('created_at', { ascending: true })

  if (!unassigned?.length) return NextResponse.json({ assigned: 0 })

  // Pair: order[i] → freeDriver[i]
  const pairs = Math.min(freeDrivers.length, unassigned.length)
  let assigned = 0

  for (let i = 0; i < pairs; i++) {
    const driver = freeDrivers[i]
    const delivery = unassigned[i]

    const { error } = await supabase
      .from('deliveries')
      .update({ driver_id: driver.id, driver_fee: defaultFee })
      .eq('id', delivery.id)
      .is('driver_id', null) // guard against race

    if (!error) {
      assigned++
      // Notify only the assigned dispatcher
      fetch(`${BASE_URL}/api/push-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          title: 'Pedido asignado',
          body: `Pedido de ${delivery.customer_name} listo para recoger`,
          url: `/driver/${driver.id}`,
        }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ assigned })
}
