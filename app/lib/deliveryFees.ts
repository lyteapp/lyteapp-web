// What a driver earns for a delivery: the fee of the zone the customer's
// pin falls in (zones are circles), else the delivery's own zone, else its
// stored driver_fee. Shared by the driver's day sheet and the daily close.

export type FeeZone = {
  id: string; name: string; fee: number; color: string
  center_lat: number; center_lng: number; radius_m: number
}
export type FeeDelivery = {
  driver_fee: number | null
  customer_lat: number | null
  customer_lng: number | null
  zone_id: string | null
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function matchZone(d: FeeDelivery, zones: FeeZone[]): FeeZone | null {
  if (d.customer_lat == null || d.customer_lng == null) return null
  return zones.find(z => haversineM(d.customer_lat!, d.customer_lng!, z.center_lat, z.center_lng) <= z.radius_m) ?? null
}

export function feeForDelivery(d: FeeDelivery, zone: FeeZone | null, zones: FeeZone[]): number {
  if (zone) return Number(zone.fee) || 0
  const byId = d.zone_id ? zones.find(z => z.id === d.zone_id) : undefined
  if (byId) return Number(byId.fee) || 0
  return Number(d.driver_fee) || 0
}

/** YYYY-MM-DD of an instant in a time zone */
export function localDay(at: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
}

/** The store's commission on delivery fees, 0–100 (Delivery → Ajustes) */
export function commissionPct(checkoutSettings: unknown): number {
  const v = Number((checkoutSettings as { deliveryCommissionPct?: unknown } | null)?.deliveryCommissionPct)
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0
}

/** Split a delivery fee into the driver's share and the store's commission */
export function splitFee(fee: number, pct: number) {
  const commission = Math.round(fee * pct) / 100
  return { driver: Math.round((fee - commission) * 100) / 100, commission }
}
