import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type DeliveryRow = {
  driver_fee: number
  created_at: string
  customer_lat: number | null
  customer_lng: number | null
  zone_id: string | null
}

type ZoneRow = {
  id: string
  name: string
  fee: number
  color: string
  center_lat: number
  center_lng: number
  radius_m: number
}

function matchZone(d: DeliveryRow, zones: ZoneRow[]): ZoneRow | null {
  if (d.customer_lat != null && d.customer_lng != null && zones.length) {
    return zones.find(z =>
      haversineM(d.customer_lat!, d.customer_lng!, z.center_lat, z.center_lng) <= z.radius_m
    ) ?? null
  }
  return null
}

function feeForDelivery(d: DeliveryRow, zone: ZoneRow | null, zoneFeesMap: Record<string, number>): number {
  if (zone) return zone.fee
  if (d.zone_id) return zoneFeesMap[d.zone_id] ?? d.driver_fee
  return d.driver_fee
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const driverId = searchParams.get('driverId')
  if (!driverId) return Response.json({ error: 'Missing driverId' }, { status: 400 })

  const { data: driver } = await supa
    .from('delivery_drivers')
    .select('store_id')
    .eq('id', driverId)
    .maybeSingle()
  if (!driver) return Response.json({ error: 'Driver not found' }, { status: 404 })

  const todayStartParam = searchParams.get('todayStart')
  const todayStart = todayStartParam
    ? new Date(todayStartParam)
    : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()

  const [{ data: allDelivered }, { data: zones }, { count }] = await Promise.all([
    supa.from('deliveries')
      .select('driver_fee, created_at, customer_lat, customer_lng, zone_id')
      .eq('driver_id', driverId)
      .eq('status', 'delivered'),
    supa.from('delivery_zones')
      .select('id, name, fee, color, center_lat, center_lng, radius_m')
      .eq('store_id', driver.store_id),
    supa.from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .neq('status', 'cancelled'),
  ])

  const zoneFeesMap: Record<string, number> = {}
  if (zones) zones.forEach(z => { zoneFeesMap[z.id] = z.fee })

  const allDels   = (allDelivered ?? []) as DeliveryRow[]
  const todayDels = allDels.filter(d => new Date(d.created_at) >= todayStart)
  const zonesArr  = (zones ?? []) as ZoneRow[]

  // Aggregate totals
  let todayZoneFee = 0
  let totalZoneFee = 0

  // Per-zone breakdown: keyed by zone id (or '_none' for unmatched)
  const breakdown: Record<string, {
    name: string; color: string; fee: number
    todayCount: number; todayFee: number
    totalCount: number; totalFee: number
  }> = {}

  const ensureZone = (z: ZoneRow | null) => {
    const key = z?.id ?? '_none'
    if (!breakdown[key]) {
      breakdown[key] = {
        name: z?.name ?? 'Sin zona', color: z?.color ?? '#64748B', fee: z?.fee ?? 0,
        todayCount: 0, todayFee: 0, totalCount: 0, totalFee: 0,
      }
    }
    return key
  }

  for (const d of allDels) {
    const zone = matchZone(d, zonesArr)
    const fee  = feeForDelivery(d, zone, zoneFeesMap)
    const key  = ensureZone(zone)
    breakdown[key].totalCount++
    breakdown[key].totalFee += fee
    totalZoneFee += fee
  }

  for (const d of todayDels) {
    const zone = matchZone(d, zonesArr)
    const fee  = feeForDelivery(d, zone, zoneFeesMap)
    const key  = ensureZone(zone)
    breakdown[key].todayCount++
    breakdown[key].todayFee += fee
    todayZoneFee += fee
  }

  const todayCount = todayDels.length

  const zoneBreakdown = Object.values(breakdown)
    .filter(z => z.totalCount > 0)
    .sort((a, b) => b.totalCount - a.totalCount)

  return Response.json({ todayCount, totalCount: count ?? 0, todayZoneFee, totalZoneFee, zoneBreakdown })
}
