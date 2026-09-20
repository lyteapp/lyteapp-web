export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Notifies every device the store owner has enabled notifications on —
// same web-push pipeline as /api/push-driver, just a different subscriber
// table since an owner isn't a delivery_drivers row.
export async function POST(req: NextRequest) {
  const { storeId, title, body, url } = await req.json()
  if (!storeId) return NextResponse.json({ error: 'missing storeId' }, { status: 400 })

  const { data: subs, error: subsError } = await supabase
    .from('store_owner_push_subscriptions')
    .select('subscription')
    .eq('store_id', storeId)

  if (subsError) console.error('push-owner: failed to load subscriptions', subsError)
  if (!subs?.length) return NextResponse.json({ sent: 0, found: 0 })

  // Dynamic import avoids bundler issues with web-push native modules
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    'mailto:soporte@lyte-app.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const payload = JSON.stringify({ title, body, url, tag: 'order' })
  let sent = 0
  // Surfaced to the caller so a "found subscriptions but every send
  // failed" case (e.g. a VAPID key mismatch) doesn't look identical to
  // "no subscriptions at all" — they need very different fixes.
  let lastError: string | null = null

  await Promise.all(
    subs.map(async (row) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await webpush.sendNotification(row.subscription as any, payload)
        sent++
      } catch (err: unknown) {
        console.error('push-owner: sendNotification failed', err)
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const statusCode = (err as { statusCode: number }).statusCode
          lastError = `statusCode ${statusCode}` + ('body' in err ? `: ${(err as { body: unknown }).body}` : '')
          if (statusCode === 410) {
            await supabase.from('store_owner_push_subscriptions')
              .delete().eq('subscription', row.subscription)
          }
        } else {
          lastError = err instanceof Error ? err.message : String(err)
        }
      }
    })
  )

  return NextResponse.json({ sent, found: subs.length, lastError })
}
