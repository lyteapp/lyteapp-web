import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// The public queue board's data (store look + the orders on the board),
// fetched by the board through lyte-app.com instead of straight from the
// database: a screen left on for hours (a Windows PC that slept, a flaky
// network) can lose its own connection to the database while the site
// itself still loads — through here, if the page opens, the orders arrive.
// Same public data the board showed before (it used the public key too).

const QUEUE_WINDOW_MS = 6 * 60 * 60 * 1000
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET(req: Request) {
  await connection()
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return Response.json({ error: 'Falta la tienda' }, { status: 400, headers: NO_STORE })

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: store, error } = await supa
    .from('stores')
    .select('id, name, logo_url, template_config')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 502, headers: NO_STORE })
  if (!store) return Response.json({ notFound: true }, { status: 404, headers: NO_STORE })

  const tc = (store.template_config as Record<string, unknown> | null) ?? {}
  const trackingConfig = (tc.trackingConfig as Record<string, unknown> | undefined) ?? {}
  const qb = (trackingConfig.queueBoard as { enabled?: boolean } | undefined) ?? {}
  const out = {
    store: { id: store.id, name: store.name, logo_url: store.logo_url, accentColor: tc.accentColor ?? null, trackingConfig },
    orders: [] as unknown[],
  }
  if (qb.enabled === true) {
    const { data: orders, error: oErr } = await supa
      .from('orders')
      .select('id, status, customer_name, created_at, locker_number, locker_notified_at')
      .eq('store_id', store.id)
      .not('status', 'in', '(delivered,cancelled,completed)')
      .gte('created_at', new Date(Date.now() - QUEUE_WINDOW_MS).toISOString())
      .order('created_at', { ascending: true })
    if (oErr) return Response.json({ error: oErr.message }, { status: 502, headers: NO_STORE })
    out.orders = orders ?? []
  }
  return Response.json(out, { headers: NO_STORE })
}
