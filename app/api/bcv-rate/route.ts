import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

type DolarApiEntry = { fuente: string; promedio: number; promedio_real?: number }

async function fetchBCVRate(): Promise<number | null> {
  // Primary: ve.dolarapi.com — agrega la tasa oficial del BCV desde Venezuela
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    })
    if (res.ok) {
      const data: DolarApiEntry[] = await res.json()
      const oficial = data.find(d => d.fuente === 'oficial')
      if (oficial?.promedio && oficial.promedio > 1) return oficial.promedio
    }
  } catch { /* sigue al fallback */ }

  // Fallback: exchangerate-api.com (también usa la tasa BCV oficial)
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      const rate = Number(data?.rates?.VES)
      if (rate > 1) return rate
    }
  } catch { /* sin tasa disponible */ }

  return null
}

// GET — cron (con Authorization) actualiza; sin Authorization devuelve la tasa actual
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`

  if (isCron) {
    const rate = await fetchBCVRate()
    if (rate) {
      await supa.from('exchange_rates').upsert({
        currency: 'USD', rate,
        source: 've.dolarapi.com',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'currency' })
      return Response.json({ ok: true, rate })
    }
    return Response.json({ ok: false, error: 'rate_unavailable' })
  }

  // Lectura pública — devuelve la tasa guardada
  const { data } = await supa
    .from('exchange_rates')
    .select('rate, updated_at')
    .eq('currency', 'USD')
    .maybeSingle()

  return Response.json({
    rate: data?.rate ?? null,
    updated_at: data?.updated_at ?? null,
  })
}
