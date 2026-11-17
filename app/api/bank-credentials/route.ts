import { createClient } from '@supabase/supabase-js'
import { sealSecret } from '../../lib/bankSecrets'

// A store's bank API credentials (BNC's Débito inmediato for now), from the
// dashboard: Checkout → Métodos de pago. Only the store's owner can see or
// change them, and the secret itself never comes back out — the dashboard
// only ever gets "connected, ends in 1234". The table has no browser access
// at all (see the store_bank_credentials migration); this route uses the
// service role after checking the owner.

const PROVIDERS = ['bnc'] as const
type Provider = (typeof PROVIDERS)[number]
const NO_STORE = { 'Cache-Control': 'no-store' }

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } })
}

async function owner(req: Request, storeId: string | null | undefined) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !storeId) return null
  const supa = admin()
  const { data: { user } } = await supa.auth.getUser(token)
  if (!user) return null
  const { data: store } = await supa.from('stores').select('id').eq('id', storeId).eq('owner_id', user.id).maybeSingle()
  return store ? { supa, userId: user.id } : null
}

const mask = (v: string | null) => (v ? (v.length <= 4 ? '••••' : `•••• ${v.slice(-4)}`) : null)
const clean = (v: unknown, max = 512) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function GET(req: Request) {
  const url = new URL(req.url)
  const storeId = url.searchParams.get('storeId')
  const provider = (url.searchParams.get('provider') ?? 'bnc') as Provider
  if (!PROVIDERS.includes(provider)) return Response.json({ error: 'Banco no soportado' }, { status: 400, headers: NO_STORE })
  const who = await owner(req, storeId)
  if (!who) return Response.json({ error: 'No autorizado' }, { status: 403, headers: NO_STORE })
  const { data, error } = await who.supa.from('store_bank_credentials')
    .select('environment, client_id, terminal, api_key_last4, updated_at')
    .eq('store_id', storeId!).eq('provider', provider).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
  if (!data) return Response.json({ connected: false }, { headers: NO_STORE })
  return Response.json({
    connected: true,
    environment: data.environment,
    clientId: mask(data.client_id),
    terminal: data.terminal,
    keyEnding: data.api_key_last4,
    updatedAt: data.updated_at,
  }, { headers: NO_STORE })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const storeId = clean(body.storeId, 64)
  const provider = (clean(body.provider, 16) || 'bnc') as Provider
  if (!PROVIDERS.includes(provider)) return Response.json({ error: 'Banco no soportado' }, { status: 400, headers: NO_STORE })
  const who = await owner(req, storeId)
  if (!who) return Response.json({ error: 'No autorizado' }, { status: 403, headers: NO_STORE })

  const environment = body.environment === 'production' ? 'production' : 'sandbox'
  const apiKey = clean(body.apiKey, 4096)
  const clientId = clean(body.clientId)
  const terminal = clean(body.terminal, 64)

  const { data: existing } = await who.supa.from('store_bank_credentials')
    .select('store_id').eq('store_id', storeId).eq('provider', provider).maybeSingle()
  // the key is needed the first time; later it can be left blank to keep it
  if (!apiKey && !existing) return Response.json({ error: 'Falta la clave (API key) que te dio el banco' }, { status: 400, headers: NO_STORE })

  const row: Record<string, unknown> = {
    store_id: storeId, provider, environment,
    client_id: clientId || null, terminal: terminal || null,
    updated_at: new Date().toISOString(), updated_by: who.userId,
  }
  if (apiKey) {
    try { row.api_key_enc = sealSecret(apiKey) } catch { return Response.json({ error: 'No se pudo guardar de forma segura' }, { status: 500, headers: NO_STORE }) }
    row.api_key_last4 = apiKey.slice(-4)
  }
  const { error } = existing
    ? await who.supa.from('store_bank_credentials').update(row).eq('store_id', storeId).eq('provider', provider)
    : await who.supa.from('store_bank_credentials').insert(row)
  if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
  return Response.json({ ok: true }, { headers: NO_STORE })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const storeId = url.searchParams.get('storeId')
  const provider = (url.searchParams.get('provider') ?? 'bnc') as Provider
  if (!PROVIDERS.includes(provider)) return Response.json({ error: 'Banco no soportado' }, { status: 400, headers: NO_STORE })
  const who = await owner(req, storeId)
  if (!who) return Response.json({ error: 'No autorizado' }, { status: 403, headers: NO_STORE })
  const { error } = await who.supa.from('store_bank_credentials').delete().eq('store_id', storeId!).eq('provider', provider)
  if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
  return Response.json({ ok: true }, { headers: NO_STORE })
}
