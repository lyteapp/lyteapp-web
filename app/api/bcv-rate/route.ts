import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

async function scrapeBCV(): Promise<number | null> {
  try {
    const res = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-VE,es;q=0.9',
      },
      // No cache — always fresh
      cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()

    // BCV renders rates inside <div id="dolar"> ... <strong>XX,XXXX</strong>
    const dollarBlock = html.match(/id=["']dolar["'][^]*?<strong[^>]*>([\d.,]+)<\/strong>/i)
    if (dollarBlock) {
      const rate = parseFloat(dollarBlock[1].replace('.', '').replace(',', '.'))
      if (rate > 1 && rate < 1_000_000) return rate
    }

    // Fallback: look for any number >= 2 digits followed by comma/dot and decimals
    // near the word "dolar" or "Dólar" within 500 chars
    const dolarIdx = html.search(/D[oó]lar/i)
    if (dolarIdx !== -1) {
      const slice = html.slice(dolarIdx, dolarIdx + 600)
      const numMatch = slice.match(/\b(\d{2,3})[,.](\d{2,6})\b/)
      if (numMatch) {
        const rate = parseFloat(`${numMatch[1]}.${numMatch[2]}`)
        if (rate > 1 && rate < 1_000_000) return rate
      }
    }

    return null
  } catch {
    return null
  }
}

// GET — called both by the Vercel cron (with Authorization header) and publicly (returns rate)
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`

  if (isCron) {
    // Attempt BCV scrape
    const rate = await scrapeBCV()

    if (rate) {
      await supa.from('exchange_rates').upsert({
        currency: 'USD',
        rate,
        source: 'bcv',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'currency' })
      return Response.json({ ok: true, rate, source: 'bcv' })
    }

    // BCV unreachable — keep existing rate, just log
    return Response.json({ ok: false, error: 'bcv_unreachable' }, { status: 200 })
  }

  // Public GET — return current rate
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

// POST — manual trigger from dashboard (no cron needed)
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rate = await scrapeBCV()
  if (!rate) return Response.json({ ok: false, error: 'bcv_unreachable' }, { status: 200 })

  await supa.from('exchange_rates').upsert({
    currency: 'USD', rate, source: 'bcv',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'currency' })

  return Response.json({ ok: true, rate, source: 'bcv' })
}
