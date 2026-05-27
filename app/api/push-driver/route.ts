export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { driverId, storeId, title, body, url } = await req.json()
  if (!driverId && !storeId) return NextResponse.json({ error: 'missing driverId or storeId' }, { status: 400 })

  let subs: { subscription: unknown }[] | null = null

  if (driverId) {
    // Notify a specific driver
    const { data } = await supabase
      .from('driver_push_subscriptions')
      .select('subscription')
      .eq('driver_id', driverId)
    subs = data
  } else {
    // Notify available (active, not currently on a delivery) drivers in the store
    const { data: activeDrivers } = await supabase
      .from('delivery_drivers')
      .select('id')
      .eq('store_id', storeId)
      .eq('is_active', true)

    if (activeDrivers?.length) {
      // Find drivers currently assigned to an ongoing delivery
      const { data: busyRows } = await supabase
        .from('deliveries')
        .select('driver_id')
        .eq('store_id', storeId)
        .in('status', ['pending', 'preparing', 'ready', 'picked_up'])
        .not('driver_id', 'is', null)

      const busyIds = new Set((busyRows ?? []).map((r: { driver_id: string }) => r.driver_id))
      const availableIds = activeDrivers
        .map(d => d.id)
        .filter(id => !busyIds.has(id))

      if (availableIds.length) {
        const { data } = await supabase
          .from('driver_push_subscriptions')
          .select('subscription')
          .in('driver_id', availableIds)
        subs = data
      }
    }
  }

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  // Dynamic import avoids bundler issues with web-push native modules
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    'mailto:soporte@lyte-app.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const payload = JSON.stringify({ title, body, url })
  let sent = 0

  await Promise.all(
    subs.map(async (row) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await webpush.sendNotification(row.subscription as any, payload)
        sent++
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 410) {
          await supabase.from('driver_push_subscriptions')
            .delete().eq('subscription', row.subscription)
        }
      }
    })
  )

  return NextResponse.json({ sent })
}
