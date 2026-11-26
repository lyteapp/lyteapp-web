import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadBncCreds, rejectMessage, type BncCreds } from '../../../../lib/bnc'
import { CHARGING_STALE_MS, OPEN_STATUSES, applyDebitCheck, checkDebit, type DebitRow } from '../../../../lib/bncDebit'

// Settles Débito inmediato payments whose result the customer's screen never
// saw. POST: the store's owner, one order ("Verificar pago") or all the
// store's open ones (Pedidos does this while it is open). GET: the daily cron.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' }
const COLUMNS = 'order_id, store_id, status, amount_ves, bank_reference, request_reference, updated_at, reject_code, reject_description'
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const BUDGET_MS = 45_000

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE })

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } })
}

async function owner(req: Request, storeId: string) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !storeId) return null
  const supa = admin()
  const { data: { user } } = await supa.auth.getUser(token)
  if (!user) return null
  const { data: store } = await supa.from('stores').select('id').eq('id', storeId).eq('owner_id', user.id).maybeSingle()
  return store ? supa : null
}

type Outcome = { orderId: string; result: string; message: string; reference?: string | null }

// A debit that can be asked about: still open, and not a charge that is being made right now
const isStale = (d: DebitRow) => d.status !== 'charging' || Date.now() - new Date(d.updated_at).getTime() > CHARGING_STALE_MS

async function settleRows(supa: SupabaseClient, rows: DebitRow[], origin: string): Promise<Outcome[]> {
  const started = Date.now()
  const orders = new Map<string, { customer_name: string; status: string; payment_status: string | null }>()
  if (rows.length) {
    const { data } = await supa.from('orders').select('id, customer_name, status, payment_status').in('id', rows.map(r => r.order_id))
    for (const o of data ?? []) orders.set(o.id, o)
  }
  const credsByStore = new Map<string, BncCreds | null>()
  const out: Outcome[] = []
  for (const debit of rows) {
    if (Date.now() - started > BUDGET_MS) break
    const order = orders.get(debit.order_id)
    if (!order) continue
    if (!credsByStore.has(debit.store_id)) credsByStore.set(debit.store_id, await loadBncCreds(supa, debit.store_id).catch(() => null))
    const creds = credsByStore.get(debit.store_id)
    if (!creds) { out.push({ orderId: debit.order_id, result: 'unknown', message: 'La tienda no tiene el banco conectado.' }); continue }
    const check = await checkDebit(supa, creds, debit)
    const done = await applyDebitCheck(supa, debit, order, check, origin)
    out.push({ orderId: debit.order_id, ...done })
  }
  return out
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const storeId = typeof body.storeId === 'string' ? body.storeId.slice(0, 64) : ''
  const orderId = typeof body.orderId === 'string' ? body.orderId.slice(0, 64) : ''
  const supa = await owner(req, storeId)
  if (!supa) return json({ error: 'No autorizado' }, 403)
  const origin = new URL(req.url).origin

  if (orderId) {
    const { data } = await supa.from('order_bank_debits').select(COLUMNS).eq('order_id', orderId).eq('store_id', storeId).maybeSingle()
    const debit = data as DebitRow | null
    if (!debit) return json({ result: 'none', message: 'Este pedido no tiene un cobro con Débito inmediato.' })
    if (debit.status === 'paid') return json({ result: 'paid', message: 'Este pago ya está confirmado.', reference: debit.bank_reference })
    if (debit.status === 'rejected') return json({ result: 'rejected', message: rejectMessage(debit.reject_code ?? '', debit.reject_description ?? undefined) })
    if (debit.status === 'cancelled') return json({ result: 'none', message: 'El cliente canceló este pedido.' })
    if (!OPEN_STATUSES.includes(debit.status)) {
      return json({ result: 'none', message: 'El cliente todavía no completó el pago: no hay nada que verificar en el banco.' })
    }
    if (!isStale(debit)) return json({ result: 'pending', message: 'El cliente está pagando en este momento. Espera un par de minutos.' })
    const [res] = await settleRows(supa, [debit], origin)
    return json(res ?? { result: 'unknown', message: 'No se pudo consultar al banco.' })
  }

  const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
  const { data } = await supa.from('order_bank_debits').select(COLUMNS)
    .eq('store_id', storeId).in('status', OPEN_STATUSES).gte('updated_at', since).order('updated_at', { ascending: true }).limit(10)
  const rows = ((data ?? []) as DebitRow[]).filter(isStale)
  return json({ results: await settleRows(supa, rows, origin) })
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'No autorizado' }, 401)
  const supa = admin()
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
  const { data } = await supa.from('order_bank_debits').select(COLUMNS)
    .in('status', OPEN_STATUSES).gte('updated_at', since).order('updated_at', { ascending: true }).limit(25)
  const rows = ((data ?? []) as DebitRow[]).filter(isStale)
  return json({ checked: rows.length, results: await settleRows(supa, rows, new URL(req.url).origin) })
}
