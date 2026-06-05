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
  const storeId = searchParams.get('storeId')
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  if (!storeId || isNaN(lat) || isNaN(lng)) {
    return Response.json({ zone: null })
  }

  const { data: zones } = await supa
    .from('delivery_zones')
    .select('name, fee, color, center_lat, center_lng, radius_m')
    .eq('store_id', storeId)

  if (!zones?.length) return Response.json({ zone: null })

  const matched = zones.find(z =>
    haversineM(lat, lng, z.center_lat, z.center_lng) <= z.radius_m
  )

  return Response.json({
    zone: matched ? { name: matched.name, fee: matched.fee, color: matched.color } : null
  })
}
