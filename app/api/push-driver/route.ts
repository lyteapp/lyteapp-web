export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { driverId, title, body, url } = await req.json()
  if (!driverId) return NextResponse.json({ error: 'missing driverId' }, { status: 400 })

  const { data: subs } = await supabase
    .from('driver_push_subscriptions')
    .select('subscription')
    .eq('driver_id', driverId)

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
        await webpush.sendNotification(row.subscription, payload)
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
