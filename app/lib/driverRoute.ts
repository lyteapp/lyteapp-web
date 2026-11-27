// The delivery driver's route: asks Mapbox (traffic-aware) first and falls back
// to OSRM's public server, takes the fastest of the routes it offers without
// punishing the driver with a maze of turns, and follows the driver along it.
// Pure functions (the network call takes a fetch to use), so they can be tested.

export type LatLng = [number, number] // [lat, lng]

export type NavStep = {
  instruction: string
  /** where the maneuver happens */
  maneuverPos: LatLng
  /** the arrow to draw: left, slight right, uturn, arrive... */
  modifier: string
  /** metres from the start of the route to this maneuver */
  atM: number
  /** road name after the maneuver */
  road: string
}

export type NavRoute = {
  coords: LatLng[]
  /** metres from the start of the route to each point of coords */
  cum: number[]
  steps: NavStep[]
  distanceM: number
  durationS: number
  source: 'mapbox' | 'osrm'
}

type RawStep = { distance: number; name?: string; maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number } }
type RawRoute = { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: RawStep[] }[] }

export function haversineM([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function buildInstruction(type: string, modifier: string, name: string, exit?: number): string {
  const via = name ? ` por ${name}` : ''
  if (modifier === 'uturn') return `Da la vuelta en U${via}`
  if (type === 'depart') return `Inicia la ruta${via}`
  if (type === 'arrive') {
    const side = modifier.includes('left') ? ' (a tu izquierda)' : modifier.includes('right') ? ' (a tu derecha)' : ''
    return `Llegaste a tu destino${side}`
  }
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    return exit ? `En la rotonda toma la salida ${exit}${via}` : `Toma la rotonda${via}`
  }
  if (type === 'exit roundabout' || type === 'exit rotary') return `Sal de la rotonda${via}`
  if (type === 'turn' || type === 'end of road' || type === 'fork' || type === 'on ramp' || type === 'off ramp' || type === 'merge') {
    const lead = type === 'fork' ? 'Toma la ' : type === 'on ramp' ? 'Toma la rampa a la ' : type === 'off ramp' ? 'Sal a la ' : type === 'merge' ? 'Incorpórate a la ' : 'Gira a la '
    if (modifier === 'sharp left') return `${type === 'turn' || type === 'end of road' ? 'Gira fuerte a la' : lead.trim()} izquierda${via}`
    if (modifier === 'sharp right') return `${type === 'turn' || type === 'end of road' ? 'Gira fuerte a la' : lead.trim()} derecha${via}`
    if (modifier === 'left') return `${lead}izquierda${via}`
    if (modifier === 'right') return `${lead}derecha${via}`
    if (modifier === 'slight left') return `${type === 'turn' || type === 'end of road' ? 'Mantente a la' : lead.trim()} izquierda${via}`
    if (modifier === 'slight right') return `${type === 'turn' || type === 'end of road' ? 'Mantente a la' : lead.trim()} derecha${via}`
    return `Continúa${via}`
  }
  return `Continúa${via}`
}

// Steps that only say "the street changed its name" or "use this lane" are
// noise on a screen read while driving
const NOISE = new Set(['notification', 'use lane', 'new name'])

export function parseRoute(raw: RawRoute, source: NavRoute['source']): NavRoute | null {
  const pts = raw.geometry?.coordinates
  const rawSteps = raw.legs?.[0]?.steps
  if (!pts || pts.length < 2 || !rawSteps?.length) return null
  const coords: LatLng[] = pts.map(([lng, lat]) => [lat, lng])
  const cum = [0]
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineM(coords[i - 1], coords[i]))
  const geomM = cum[cum.length - 1]

  // each step's metres are laid end to end, then scaled to the drawn line so
  // "distance along the route" means the same thing for steps and for the driver
  const stepsTotal = rawSteps.reduce((a, s) => a + s.distance, 0) || 1
  const scale = geomM / stepsTotal
  let at = 0
  const steps: NavStep[] = []
  rawSteps.forEach((s, i) => {
    const atM = at
    at += s.distance * scale
    const type = s.maneuver.type
    const isEnds = i === 0 || i === rawSteps.length - 1
    if (!isEnds && NOISE.has(type)) return
    if (!isEnds && type === 'continue' && s.maneuver.modifier !== 'uturn') return
    const modifier = s.maneuver.modifier ?? ''
    steps.push({
      instruction: buildInstruction(type, modifier, s.name ?? '', s.maneuver.exit),
      maneuverPos: [s.maneuver.location[1], s.maneuver.location[0]],
      modifier: type === 'arrive' ? 'arrive' : modifier || (type === 'depart' ? 'straight' : type),
      atM,
      road: s.name ?? '',
    })
  })
  if (steps.length === 0) return null
  return { coords, cum, steps, distanceM: geomM, durationS: raw.duration, source }
}

/** Lower is better: seconds of driving, plus what a complicated route costs the driver */
export function routeCost(r: NavRoute): number {
  let turns = 0
  let uturns = 0
  for (const s of r.steps) {
    if (s.modifier === 'uturn') uturns++
    else if (s.modifier !== 'straight' && s.modifier !== 'arrive' && !/^(depart|continue)$/.test(s.modifier)) turns++
  }
  return r.durationS + 6 * turns + 45 * uturns
}

export function pickBest(routes: NavRoute[]): NavRoute | null {
  if (!routes.length) return null
  return routes.reduce((best, r) => (routeCost(r) < routeCost(best) ? r : best))
}

// ── Asking for the route ────────────────────────────────────────────────

type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

async function getJson(fetchImpl: Fetcher, url: string, timeoutMs: number): Promise<{ routes?: RawRoute[]; code?: string } | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as { routes?: RawRoute[]; code?: string }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export type RouteRequest = {
  from: LatLng
  to: LatLng
  /** the way the vehicle is heading, only when it really is moving */
  bearing?: number | null
  mapboxToken?: string
  fetchImpl?: Fetcher
  timeoutMs?: number
}

export function routeUrls({ from, to, bearing, mapboxToken }: Pick<RouteRequest, 'from' | 'to' | 'bearing' | 'mapboxToken'>) {
  const path = `${from[1]},${from[0]};${to[1]},${to[0]}`
  const b = bearing != null && Number.isFinite(bearing) ? `&bearings=${Math.round(((bearing % 360) + 360) % 360)},45;` : ''
  const urls: { source: NavRoute['source']; url: string }[] = []
  if (mapboxToken) {
    const base = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${path}?alternatives=true&geometries=geojson&overview=full&steps=true&language=es&access_token=${encodeURIComponent(mapboxToken)}`
    if (b) urls.push({ source: 'mapbox', url: base + b })
    urls.push({ source: 'mapbox', url: base })
  }
  const osrm = `https://router.project-osrm.org/route/v1/driving/${path}?steps=true&overview=full&geometries=geojson&alternatives=true`
  if (b) urls.push({ source: 'osrm', url: osrm + b })
  urls.push({ source: 'osrm', url: osrm })
  return urls
}

/** The best route from `from` to `to`, or null when nobody could draw one. Each
 *  attempt that fails (no heading accepted, server down) moves on to the next. */
export async function fetchBestRoute(req: RouteRequest): Promise<NavRoute | null> {
  const fetchImpl = (req.fetchImpl ?? (globalThis.fetch as unknown as Fetcher))
  for (const { source, url } of routeUrls(req)) {
    const json = await getJson(fetchImpl, url, req.timeoutMs ?? 8000)
    const ok = (json?.code === undefined || json.code === 'Ok') && json?.routes?.length
    if (!ok) continue
    const parsed = (json!.routes as RawRoute[]).map(r => parseRoute(r, source)).filter((r): r is NavRoute => !!r)
    const best = pickBest(parsed)
    if (best) return best
  }
  return null
}

// ── Following the driver along the route ────────────────────────────────

export type NavProgress = {
  /** metres travelled along the route */
  distAlongM: number
  /** how far the driver is from the line */
  offRouteM: number
  segIdx: number
  remainingM: number
  etaS: number
  /** the next maneuver and how far away it is */
  next: { step: NavStep; distM: number } | null
  arrived: boolean
  /** the part of the line still ahead, from where the driver is */
  ahead: LatLng[]
}

export const ARRIVE_M = 25
const PASS_M = 12

function projectToSegment(p: LatLng, a: LatLng, b: LatLng) {
  const kx = Math.cos(p[0] * Math.PI / 180) * 111320
  const ky = 110574
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky
  const bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2))
  const px = ax + t * dx, py = ay + t * dy
  return { t, dist: Math.hypot(px, py), point: [p[0] + py / ky, p[1] + px / kx] as LatLng }
}

export function routeProgress(route: NavRoute, pos: LatLng, hintSeg = 0): NavProgress {
  const n = route.coords.length - 1
  const search = (from: number, to: number) => {
    let best = { i: from, t: 0, dist: Infinity, point: route.coords[from] }
    for (let i = from; i <= to; i++) {
      const pr = projectToSegment(pos, route.coords[i], route.coords[i + 1])
      if (pr.dist < best.dist) best = { i, ...pr }
    }
    return best
  }
  // near where the driver was last: the line never doubles back on itself in
  // a way that matters, and this stops the match jumping to a far-away stretch
  let best = search(Math.max(0, hintSeg - 5), Math.min(n - 1, hintSeg + 150))
  if (best.dist > 60) {
    const all = search(0, n - 1)
    if (all.dist < best.dist) best = all
  }
  const segLen = route.cum[best.i + 1] - route.cum[best.i]
  const distAlongM = route.cum[best.i] + best.t * segLen
  const remainingM = Math.max(0, route.distanceM - distAlongM)
  const next = route.steps.find(s => s.atM > distAlongM + PASS_M) ?? route.steps[route.steps.length - 1]
  const nextDist = Math.max(0, next.atM - distAlongM)
  return {
    distAlongM,
    offRouteM: best.dist,
    segIdx: best.i,
    remainingM,
    etaS: route.distanceM > 0 ? remainingM * (route.durationS / route.distanceM) : 0,
    next: { step: next, distM: next.modifier === 'arrive' ? remainingM : nextDist },
    arrived: remainingM < ARRIVE_M,
    ahead: [best.point, ...route.coords.slice(best.i + 1)],
  }
}

/** The driver is off the road the route follows (allowing for how rough the GPS fix is) */
export function isOffRoute(offRouteM: number, accuracyM: number | null): boolean {
  return offRouteM > Math.max(45, (accuracyM ?? 0) * 1.5)
}
