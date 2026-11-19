import { after, connection } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BncError, bncCall, bncField, bncReference, loadBncCreds, rejectMessage } from '../../../lib/bnc'

// Débito inmediato (BNC) for an order the storefront just created with that
// payment method. The browser only ever says which order and the payer's
// details; the amount comes from the order and the store's rate here, and
// the bank credentials never leave the server.
//
//   quote  → the amount in Bs, fixed for this order from now on
//   token  → BNC asks the payer's bank to send them a code (SMS)
//   charge → the debit with that code; ACCP marks the order paid
//   cancel → the customer gave up: the unpaid order is cancelled
//
// Allowed up to 130 s: the bank's own timeout for a debit is 120 s.
export const maxDuration = 130

const LABEL = 'Débito inmediato'
const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_TOKENS = 5
const MAX_CHARGES = 5
const TOKEN_GAP_MS = 30_000
const ORDER_MAX_AGE_MS = 2 * 60 * 60 * 1000

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE })
const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status)

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } })
}

type Order = {
  id: string; store_id: string; total: number; status: string; payment_status: string | null
  payment_method: string | null; customer_name: string; order_number: number | null; created_at: string
}
type Debit = {
  order_id: string; amount_ves: number; status: string; token_requests: number; last_token_at: string | null
  charge_attempts: number; debtor_bank: string | null; debtor_id: string | null; debtor_acc_type: string | null
  debtor_account: string | null; debtor_name: string | null; bank_reference: string | null
}

async function loadOrder(supa: SupabaseClient, orderId: string) {
  const { data } = await supa.from('orders')
    .select('id, store_id, total, status, payment_status, payment_method, customer_name, order_number, created_at')
    .eq('id', orderId).maybeSingle()
  return data as Order | null
}

// The amount in Bs the store would show for this order: its total at the
// store's own rate if it set one, otherwise BCV for its currency.
async function amountFor(supa: SupabaseClient, order: Order) {
  const { data: store } = await supa.from('stores').select('store_currency, checkout_settings, payment_methods').eq('id', order.store_id).maybeSingle()
  const pm = (store?.payment_methods ?? {}) as Record<string, { enabled?: boolean }>
  if (!pm.debito_inmediato?.enabled) return { error: 'Esta tienda no tiene activo el Débito inmediato' }
  const cs = (store?.checkout_settings ?? {}) as { rateMode?: string; customRate?: unknown }
  const currency = (store?.store_currency as string | null) ?? 'USD'
  let rate: number | null = null
  if (currency === 'VES') rate = 1
  else if (cs.rateMode === 'custom' && Number(cs.customRate) > 0) rate = Number(cs.customRate)
  else {
    const { data: r } = await supa.from('exchange_rates').select('rate').eq('currency', currency).maybeSingle()
    rate = r?.rate ? Number(r.rate) : null
  }
  if (!rate) return { error: 'No hay tasa de cambio disponible ahora mismo' }
  return { amount: Math.round(Number(order.total) * rate * 100) / 100, rate }
}

const digits = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '').slice(0, max) : '')

export async function POST(req: Request) {
  await connection()
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action ?? '')
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return fail('Falta el pedido')

  const supa = admin()
  const order = await loadOrder(supa, orderId)
  if (!order) return fail('Pedido no encontrado', 404)
  if (order.payment_method !== LABEL) return fail('Este pedido no se paga con Débito inmediato')
  const { data: existing } = await supa.from('order_bank_debits').select('*').eq('order_id', orderId).maybeSingle()
  let debit = existing as Debit | null

  if (debit?.status === 'paid' || order.payment_status === 'approved') return json({ paid: true, reference: debit?.bank_reference ?? null })
  if (order.status === 'cancelled' || debit?.status === 'cancelled') return fail('Este pedido fue cancelado', 409)
  if (Date.now() - new Date(order.created_at).getTime() > ORDER_MAX_AGE_MS) return fail('Este pedido ya venció, haz uno nuevo', 409)

  const touch = (patch: Record<string, unknown>) =>
    supa.from('order_bank_debits').update({ ...patch, updated_at: new Date().toISOString() }).eq('order_id', orderId)

  if (action === 'cancel') {
    if (debit?.status === 'charging') return fail('El pago se está procesando', 409)
    await supa.from('orders').update({ status: 'cancelled', payment_status: 'rejected' }).eq('id', orderId).eq('status', 'pending')
    if (debit) await touch({ status: 'cancelled' })
    return json({ cancelled: true })
  }

  if (!debit) {
    const q = await amountFor(supa, order)
    if ('error' in q) return fail(q.error!)
    const { error } = await supa.from('order_bank_debits').insert({
      order_id: orderId, store_id: order.store_id, amount_ves: q.amount, rate: q.rate, status: 'quoted',
    })
    if (error && !/duplicate/i.test(error.message)) return fail('No se pudo preparar el pago', 500)
    const { data } = await supa.from('order_bank_debits').select('*').eq('order_id', orderId).maybeSingle()
    debit = data as Debit
  }
  const amount = Number(debit.amount_ves)

  if (action === 'quote') return json({ amount, status: debit.status })

  const creds = await loadBncCreds(supa, order.store_id)
  if (!creds) return fail('La tienda todavía no terminó de conectar su banco. Elige otro método de pago.', 409)

  try {
    if (action === 'token') {
      const bank = digits(body.bank, 4)
      const idType = String(body.idType ?? 'V').toUpperCase()
      const idNumber = digits(body.idNumber, 9)
      const accType = body.accType === 'CNTA' ? 'CNTA' : 'CELE'
      let account = digits(body.account, 20)
      if (accType === 'CELE') account = account.replace(/^0/, '58').replace(/^(?!58)/, '58')
      if (bank.length !== 4) return fail('Elige tu banco')
      if (!/^[VEJPG]$/.test(idType) || idNumber.length < 5) return fail('Revisa tu cédula')
      if (accType === 'CELE' && account.length !== 12) return fail('Revisa tu número de teléfono (ej: 0414 1234567)')
      if (accType === 'CNTA' && account.length !== 20) return fail('El número de cuenta debe tener 20 dígitos')
      if (debit.token_requests >= MAX_TOKENS) return fail('Ya pediste demasiados códigos para este pedido', 429)
      if (debit.last_token_at && Date.now() - new Date(debit.last_token_at).getTime() < TOKEN_GAP_MS)
        return fail('Espera unos segundos antes de pedir otro código', 429)

      const debtor = {
        debtor_bank: bank, debtor_id: `${idType}${idNumber}`, debtor_acc_type: accType, debtor_account: account,
        debtor_name: (typeof body.name === 'string' && body.name.trim() ? body.name : order.customer_name).trim().slice(0, 60),
      }
      await touch({ ...debtor, token_requests: debit.token_requests + 1, last_token_at: new Date().toISOString() })
      const r = await bncCall(supa, creds, '/SIMF/DebitTokenRequest', {
        Amount: amount,
        DebtorAccount: account,
        DebtorAccountType: accType,
        DebtorBank: bank,
        DebtorID: debtor.debtor_id,
        ...(creds.childClientId ? { ChildClientID: creds.childClientId } : {}),
        ...(creds.branchId ? { BranchID: creds.branchId } : {}),
      })
      // Sent: "ACCP" as Status or Code — or an OK with no verdict at all
      // ("Se envió una solicitud de token al cliente.")
      const st = bncField(r.value, 'Status').toUpperCase()
      const code = bncField(r.value, 'Code').toUpperCase()
      const sent = r.ok && st !== 'RJCT' && (st === 'ACCP' || code === 'ACCP' || (!st && !code))
      if (sent) {
        await touch({ status: 'token_sent', reject_code: null, reject_description: null, last_response: r.raw })
        return json({ sent: true, amount })
      }
      await touch({ reject_code: code || r.code, reject_description: bncField(r.value, 'RejectDescription') || r.message, last_response: r.raw })
      return fail(r.ok ? rejectMessage(code) : `El banco no pudo enviar el código${r.message ? `: ${r.message}` : ''}`, 422, { code })
    }

    if (action === 'charge') {
      const token = digits(body.code, 8)
      if (token.length < 4) return fail('Escribe el código que te llegó')
      if (!debit.debtor_account || debit.status === 'quoted') return fail('Primero pide el código')
      if (debit.charge_attempts >= MAX_CHARGES) return fail('Demasiados intentos para este pedido', 429)
      // claim it, so a double tap can't debit twice
      const { data: claimed } = await supa.from('order_bank_debits')
        .update({ status: 'charging', charge_attempts: debit.charge_attempts + 1, updated_at: new Date().toISOString() })
        .eq('order_id', orderId).in('status', ['token_sent', 'rejected']).select('order_id')
      if (!claimed?.length) return fail('El pago ya se está procesando', 409)

      const store = await supa.from('stores').select('name').eq('id', order.store_id).maybeSingle()
      const concept = `Pedido ${order.order_number ? `#${order.order_number}` : order.id.slice(0, 8).toUpperCase()} ${store.data?.name ?? ''}`.trim().slice(0, 100)
      let r
      try {
        r = await bncCall(supa, creds, '/SIMF/DebitBeginner', {
          DebtorBank: debit.debtor_bank,
          DebtorAccount: debit.debtor_account,
          DebtorAccType: debit.debtor_acc_type,
          Concept: concept,
          AddtlInf: token,
          DebtorID: debit.debtor_id,
          Amount: amount,
          DebtorName: debit.debtor_name,
          ...(creds.childClientId ? { ChildClientID: creds.childClientId } : {}),
          ...(creds.branchId ? { BranchID: creds.branchId } : {}),
        }, { reference: bncReference('DB'), timeoutMs: 125_000 })
      } catch (e) {
        // no answer: it may or may not have gone through — the store checks
        await touch({ status: 'unknown', reject_description: (e as Error).message, last_response: { error: (e as Error).message, code: e instanceof BncError ? e.code : null } })
        return fail('No supimos la respuesta del banco. No pagues otra vez: la tienda revisará si el cobro llegó.', 504, { unknown: true })
      }
      const st = bncField(r.value, 'Status').toUpperCase()
      const code = bncField(r.value, 'Code').toUpperCase()
      const reference = bncField(r.value, 'Reference') || null
      const desc = bncField(r.value, 'RejectDescription') || r.message
      // Paid only on an explicit ACCP (as Status, or as Code with no Status)
      if (r.ok && (st === 'ACCP' || (!st && code === 'ACCP'))) {
        await touch({ status: 'paid', bank_reference: reference, reject_code: null, reject_description: null, last_response: r.raw })
        await supa.from('orders').update({
          payment_status: 'approved',
          payment_verified_by: `Débito inmediato BNC${reference ? ` · Ref ${reference}` : ''}`,
        }).eq('id', orderId)
        const origin = new URL(req.url).origin
        after(async () => {
          await fetch(new URL('/api/push-owner', origin), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeId: order.store_id, title: 'Nuevo pedido pagado', body: `${order.customer_name} · Bs ${amount.toFixed(2)} por Débito inmediato`, url: '/dashboard/pedidos' }),
          }).catch(() => {})
        })
        return json({ paid: true, reference, amount })
      }
      if (r.ok && st !== 'RJCT' && !(code && code !== 'ACCP' && !st)) {
        // e.g. AC00 / PEND, or an OK without a verdict: not decided yet
        await touch({ status: 'unknown', bank_reference: reference, reject_code: code, reject_description: desc, last_response: r.raw })
        return fail('El banco todavía está procesando el pago. No pagues otra vez: la tienda confirmará cuando llegue.', 202, { unknown: true })
      }
      await touch({ status: 'rejected', bank_reference: reference, reject_code: code || r.code, reject_description: desc, last_response: r.raw })
      return fail(r.ok ? rejectMessage(code, desc) : `El banco no procesó el pago${r.message ? `: ${r.message}` : ''}`, 422, { code })
    }
  } catch (e) {
    const msg = e instanceof BncError ? e.message : 'Error inesperado con el banco'
    const errLog = { last_response: { error: msg, code: e instanceof BncError ? e.code : null } }
    if (action === 'charge') await touch({ status: 'rejected', reject_description: msg, ...errLog })
    else await touch({ reject_description: msg, ...errLog })
    return fail(msg, 502)
  }

  return fail('Acción desconocida')
}
