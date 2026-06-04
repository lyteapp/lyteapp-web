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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const driverId = searchParams.get('driverId')
  if (!driverId) return Response.json({ error: 'Missing driverId' }, { status: 400 })

  // Get driver's store_id
  const { data: driver } = await supa
    .from('delivery_drivers')
    .select('store_id')
    .eq('id', driverId)
    .maybeSingle()
  if (!driver) return Response.json({ error: 'Driver not found' }, { status: 404 })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [{ data: deliveries }, { data: zones }] = await Promise.all([
    supa.from('deliveries')
      .select('driver_fee, created_at, customer_lat, customer_lng, zone_id')
      .eq('driver_id', driverId)
      .eq('status', 'delivered')
      .gte('created_at', todayStart.toISOString()),
    supa.from('delivery_zones')
      .select('id, fee, center_lat, center_lng, radius_m')
      .eq('store_id', driver.store_id),
  ])

  const zoneFeesMap: Record<string, number> = {}
  if (zones) zones.forEach(z => { zoneFeesMap[z.id] = z.fee })

  const todayDels = deliveries ?? []
  const todayCount = todayDels.length

  const todayZoneFee = todayDels.reduce((s, d) => {
    let fee = d.driver_fee
    if (d.customer_lat != null && d.customer_lng != null && zones?.length) {
      const matched = zones.find(z =>
        haversineM(d.customer_lat!, d.customer_lng!, z.center_lat, z.center_lng) <= z.radius_m
      )
      fee = matched ? matched.fee : (d.zone_id ? (zoneFeesMap[d.zone_id] ?? d.driver_fee) : d.driver_fee)
    } else if (d.zone_id) {
      fee = zoneFeesMap[d.zone_id] ?? d.driver_fee
    }
    return s + Number(fee)
  }, 0)

  // Total all-time delivered count
  const { count } = await supa
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .eq('status', 'delivered')

  return Response.json({ todayCount, totalCount: count ?? 0, todayZoneFee })
}
