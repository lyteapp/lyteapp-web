import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { feeForDelivery, localDay, matchZone, type FeeZone } from '../../lib/deliveryFees'

// Daily close of delivery earnings (Liquidaciones).
// GET  — Vercel cron, just after midnight: closes every store's past days.
// POST — the dashboard (store owner), when opening Liquidaciones: catches up
//        its own store in case the cron hasn't run yet.
// Closing a day freezes each delivered delivery's fee (deliveries.driver_fee,
// from its zone at that moment), stamps closed_on, and stores the totals per
// driver and day in delivery_day_closes. Today (still open) is never closed.

// Stores are in Venezuela for now; days close at local midnight.
const TIME_ZONE = 'America/Caracas'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
)

type Row = {
  id: string; store_id: string; driver_id: string; delivered_at: string
  driver_fee: number | null; customer_lat: number | null; customer_lng: number | null; zone_id: string | null
}

async function closeDays(storeId?: string) {
  const supa = admin()
  const today = localDay(new Date(), TIME_ZONE)

  let q = supa.from('deliveries')
    .select('id, store_id, driver_id, delivered_at, driver_fee, customer_lat, customer_lng, zone_id')
    .eq('status', 'delivered')
    .is('closed_on', null)
    .not('driver_id', 'is', null)
    .not('delivered_at', 'is', null)
    .limit(5000)
  if (storeId) q = q.eq('store_id', storeId)
  const { data, error } = await q
  if (error) throw new Error(error.message)

  // Only days that are over
  const rows = ((data ?? []) as Row[]).filter(d => localDay(d.delivered_at, TIME_ZONE) < today)
  if (rows.length === 0) return { closed: 0, days: 0 }

  const storeIds = [...new Set(rows.map(r => r.store_id))]
  const { data: zoneRows, error: zErr } = await supa.from('delivery_zones')
    .select('id, store_id, name, fee, color, center_lat, center_lng, radius_m')
    .in('store_id', storeIds)
  if (zErr) throw new Error(zErr.message)
  const zonesByStore: Record<string, FeeZone[]> = {}
  for (const z of (zoneRows ?? []) as (FeeZone & { store_id: string })[]) (zonesByStore[z.store_id] ??= []).push(z)

  // Freeze each delivery's fee and stamp its day
  const touched = new Set<string>()
  for (let i = 0; i < rows.length; i += 25) {
    await Promise.all(rows.slice(i, i + 25).map(async d => {
      const zones = zonesByStore[d.store_id] ?? []
      const fee = feeForDelivery(d, matchZone(d, zones), zones)
      const day = localDay(d.delivered_at, TIME_ZONE)
      const { error: uErr } = await supa.from('deliveries')
        .update({ driver_fee: fee, closed_on: day })
        .eq('id', d.id)
      if (!uErr) touched.add(`${d.store_id}|${d.driver_id}|${day}`)
    }))
  }

  // Totals per store / driver / day, recomputed from everything closed that
  // day (a late-marked delivery joins its day's close). paid_at is untouched.
  for (const key of touched) {
    const [store_id, driver_id, day] = key.split('|')
    const { data: dayRows } = await supa.from('deliveries')
      .select('driver_fee')
      .eq('store_id', store_id).eq('driver_id', driver_id).eq('closed_on', day).eq('status', 'delivered')
    const list = (dayRows ?? []) as { driver_fee: number | null }[]
    await supa.from('delivery_day_closes').upsert({
      store_id, driver_id, day,
      deliveries: list.length,
      fees: Math.round(list.reduce((s, r) => s + (Number(r.driver_fee) || 0), 0) * 100) / 100,
      closed_at: new Date().toISOString(),
    }, { onConflict: 'store_id,driver_id,day' })
  }
  return { closed: touched.size ? rows.length : 0, days: touched.size }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    return Response.json(await closeDays())
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { storeId } = await req.json().catch(() => ({})) as { storeId?: string }
  if (!storeId) return Response.json({ error: 'Falta la tienda' }, { status: 400 })

  const supa = admin()
  const { data: { user } } = await supa.auth.getUser(token)
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { data: store } = await supa.from('stores').select('id').eq('id', storeId).eq('owner_id', user.id).maybeSingle()
  if (!store) return Response.json({ error: 'No autorizado' }, { status: 403 })

  try {
    return Response.json(await closeDays(storeId))
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
