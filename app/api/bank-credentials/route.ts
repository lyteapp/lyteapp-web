import { createClient } from '@supabase/supabase-js'
import { sealSecret } from '../../lib/bankSecrets'
import { BncError, bncLogon, loadBncCreds } from '../../lib/bnc'

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
    .select('environment, client_id, child_client_id, branch_id, merchant_rif, api_key_last4, updated_at')
    .eq('store_id', storeId!).eq('provider', provider).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
  if (!data) return Response.json({ connected: false }, { headers: NO_STORE })
  return Response.json({
    connected: true,
    environment: data.environment,
    clientId: mask(data.client_id),
    childClientId: data.child_client_id,
    merchantRif: data.merchant_rif,
    branchId: data.branch_id,
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
  const apiKey = clean(body.apiKey, 4096)     // BNC: MasterKey
  const clientId = clean(body.clientId)       // BNC: ClientGUID
  const childClientId = clean(body.childClientId, 16).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const branchId = clean(body.branchId, 32)
  // the store's RIF (J-50889503-7 → J508895037): BNC asks for it to confirm a debit's final status
  const merchantRif = clean(body.merchantRif, 20).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (merchantRif && !/^[VEJPG]\d{5,9}$/.test(merchantRif)) return Response.json({ error: 'Revisa el RIF (ej: J-12345678-9)' }, { status: 400, headers: NO_STORE })

  const { data: existing } = await who.supa.from('store_bank_credentials')
    .select('store_id, environment').eq('store_id', storeId).eq('provider', provider).maybeSingle()
  // both are needed the first time; later either can be left blank to keep it
  if (!apiKey && !existing) return Response.json({ error: 'Falta la MasterKey que te dio el banco' }, { status: 400, headers: NO_STORE })
  if (!clientId && !existing) return Response.json({ error: 'Falta el ClientGUID que te dio el banco' }, { status: 400, headers: NO_STORE })

  const row: Record<string, unknown> = {
    store_id: storeId, provider, environment,
    child_client_id: childClientId || null, branch_id: branchId || null, merchant_rif: merchantRif || null,
    updated_at: new Date().toISOString(), updated_by: who.userId,
  }
  if (clientId) row.client_id = clientId
  if (apiKey) {
    try { row.api_key_enc = sealSecret(apiKey) } catch { return Response.json({ error: 'No se pudo guardar de forma segura' }, { status: 500, headers: NO_STORE }) }
    row.api_key_last4 = apiKey.slice(-4)
  }
  // new keys or another server: the day's WorkingKey no longer applies
  if (apiKey || clientId || existing?.environment !== environment) { row.working_key_enc = null; row.working_key_day = null }
  const { error } = existing
    ? await who.supa.from('store_bank_credentials').update(row).eq('store_id', storeId).eq('provider', provider)
    : await who.supa.from('store_bank_credentials').insert(row)
  if (error) return Response.json({ error: error.message }, { status: 500, headers: NO_STORE })
  return Response.json({ ok: true }, { headers: NO_STORE })
}

// "Probar conexión": a Logon with the saved credentials — charges nothing
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const storeId = clean(body.storeId, 64)
  if (body.action !== 'test') return Response.json({ error: 'Acción desconocida' }, { status: 400, headers: NO_STORE })
  const who = await owner(req, storeId)
  if (!who) return Response.json({ error: 'No autorizado' }, { status: 403, headers: NO_STORE })
  let creds
  try { creds = await loadBncCreds(who.supa, storeId) } catch { creds = null }
  if (!creds) return Response.json({ error: 'Primero guarda el ClientGUID y la MasterKey' }, { status: 400, headers: NO_STORE })
  try {
    await bncLogon(who.supa, creds)
    return Response.json({ ok: true }, { headers: NO_STORE })
  } catch (e) {
    const msg = e instanceof BncError ? e.message : 'No se pudo conectar con el banco'
    return Response.json({ error: e instanceof BncError && e.code === 'CFG' ? msg : `BNC respondió: ${msg}` }, { status: 502, headers: NO_STORE })
  }
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
