import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

type DolarApiEntry = { fuente: string; promedio: number; moneda?: string }
type EuroApiEntry  = { fuente: string; promedio: number; moneda?: string }

async function fetchRates(): Promise<{ USD: number | null; EUR: number | null }> {
  let usd: number | null = null
  let eur: number | null = null

  // Primary: ve.dolarapi.com — publica tasas BCV oficiales desde Venezuela
  try {
    const [resDolar, resEuro] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares', { cache: 'no-store' }),
      fetch('https://ve.dolarapi.com/v1/euros',   { cache: 'no-store' }),
    ])
    if (resDolar.ok) {
      const data: DolarApiEntry[] = await resDolar.json()
      const oficial = data.find(d => d.fuente === 'oficial')
      if (oficial?.promedio && oficial.promedio > 1) usd = oficial.promedio
    }
    if (resEuro.ok) {
      const data: EuroApiEntry[] = await resEuro.json()
      const oficial = data.find(d => d.fuente === 'oficial')
      if (oficial?.promedio && oficial.promedio > 1) eur = oficial.promedio
    }
  } catch { /* sigue al fallback */ }

  // Fallback USD: exchangerate-api.com
  if (!usd) {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const r = Number(data?.rates?.VES)
        if (r > 1) usd = r
      }
    } catch { /* nada */ }
  }

  // Fallback EUR: calcular desde USD si tenemos ambas tasas USD/VES y EUR/USD
  if (!eur && usd) {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const r = Number(data?.rates?.VES)
        if (r > 1) eur = r
      }
    } catch { /* nada */ }
  }

  return { USD: usd, EUR: eur }
}

// GET — cron actualiza tasas; público devuelve todas las tasas actuales
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`

  if (isCron) {
    const { USD, EUR } = await fetchRates()
    const upserts = []
    if (USD) upserts.push({ currency: 'USD', rate: USD, source: 've.dolarapi.com', updated_at: new Date().toISOString() })
    if (EUR) upserts.push({ currency: 'EUR', rate: EUR, source: 've.dolarapi.com', updated_at: new Date().toISOString() })
    if (upserts.length) await supa.from('exchange_rates').upsert(upserts, { onConflict: 'currency' })
    return Response.json({ ok: true, USD, EUR })
  }

  // Lectura pública — devuelve USD y EUR
  const { data } = await supa.from('exchange_rates').select('currency, rate, updated_at')
  const rates: Record<string, number> = {}
  const updatedAt: Record<string, string> = {}
  for (const row of data ?? []) {
    rates[row.currency] = Number(row.rate)
    updatedAt[row.currency] = row.updated_at
  }
  return Response.json({ rates, updatedAt })
}
