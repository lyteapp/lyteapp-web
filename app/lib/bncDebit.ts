import type { SupabaseClient } from '@supabase/supabase-js'
import { bncCall, bncField, rejectMessage, type BncCreds } from './bnc'

// Server only. Settles a Débito inmediato whose result the customer's browser
// never saw (the tab was closed, the bank was slow, the request was lost): asks
// BNC for the operation's final status and records it. Used by the store's
// "Verificar pago" button and by Pedidos while it is open.

export type DebitRow = {
  order_id: string; store_id: string; status: string; amount_ves: number
  bank_reference: string | null; request_reference: string | null; updated_at: string
  reject_code: string | null; reject_description: string | null
}

export type DebitCheck =
  | { result: 'paid'; reference: string | null }
  | { result: 'rejected'; code: string; message: string }
  | { result: 'pending' }
  | { result: 'unknown'; message: string }

/** statuses that can still become paid or rejected without the customer */
export const OPEN_STATUSES = ['confirming', 'unknown', 'charging']
/** a debit still "charging" after this lost its request (the bank's own timeout is 120 s) */
export const CHARGING_STALE_MS = 3 * 60 * 1000

export async function checkDebit(supa: SupabaseClient, creds: BncCreds, debit: DebitRow): Promise<DebitCheck> {
  if (!creds.merchantRif) return { result: 'unknown', message: 'Falta el RIF del comercio en las credenciales del banco.' }
  const refs = [...new Set([debit.bank_reference, debit.request_reference].filter((r): r is string => !!r))]
  if (!refs.length) return { result: 'unknown', message: 'Este cobro no tiene una referencia para consultar al banco.' }
  try {
    // which reference BNC wants isn't clear: the bank's own first, then ours
    let r = await bncCall(supa, creds, '/SIMF/StatusOperation', { Reference: refs[0], ClientID: creds.merchantRif, OperationType: 'DEB' }, { timeoutMs: 15000 })
    for (const ref of refs.slice(1)) {
      if (r.ok || r.code !== 'SMF001') break
      r = await bncCall(supa, creds, '/SIMF/StatusOperation', { Reference: ref, ClientID: creds.merchantRif, OperationType: 'DEB' }, { timeoutMs: 15000 })
    }
    const st = bncField(r.value, 'Status').toUpperCase()
    const code = bncField(r.value, 'Code').toUpperCase()
    if (r.ok && st === 'ACCP' && (!code || code === 'ACCP')) {
      return { result: 'paid', reference: bncField(r.value, 'Reference') || debit.bank_reference }
    }
    // a rejection code, even under "PEND" (how an annulled debit shows)
    if (code && code !== 'ACCP' && code !== 'AC00') {
      return { result: 'rejected', code, message: rejectMessage(code, bncField(r.value, 'RejectDescription') || r.message) }
    }
    if (/RJCT|RECHAZ|ANULAD/.test(st)) return { result: 'rejected', code: code || st, message: rejectMessage(code, r.message) }
    if (r.ok) return { result: 'pending' }
    if (r.code === 'SMF001') return { result: 'unknown', message: 'El banco no encuentra esta operación. Revisa tu estado de cuenta de BNC.' }
    return { result: 'unknown', message: r.message || 'El banco no respondió. Intenta de nuevo en unos minutos.' }
  } catch (e) {
    return { result: 'unknown', message: (e as Error).message || 'No se pudo consultar al banco.' }
  }
}

type OrderInfo = { customer_name: string; status: string; payment_status: string | null }

// Records a check's outcome. Only moves a debit that is still open, so two
// checks at once (or the customer's own screen) can't count the payment twice.
export async function applyDebitCheck(
  supa: SupabaseClient, debit: DebitRow, order: OrderInfo, check: DebitCheck, origin: string,
): Promise<{ result: DebitCheck['result']; message: string; reference?: string | null }> {
  const now = new Date().toISOString()
  const claim = (patch: Record<string, unknown>) =>
    supa.from('order_bank_debits').update({ ...patch, updated_at: now })
      .eq('order_id', debit.order_id).in('status', OPEN_STATUSES).select('order_id')

  if (check.result === 'paid') {
    const { data: claimed } = await claim({
      status: 'paid', bank_reference: check.reference, reject_code: null, reject_description: null,
    })
    if (claimed?.length) {
      if (order.payment_status !== 'approved') {
        await supa.from('orders').update({
          payment_status: 'approved',
          payment_verified_by: `Débito inmediato BNC${check.reference ? ` · Ref ${check.reference}` : ''}`,
        }).eq('id', debit.order_id)
      }
      const cancelled = order.status === 'cancelled'
      await fetch(new URL('/api/push-owner', origin), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: debit.store_id,
          title: cancelled ? 'Pago recibido en un pedido cancelado' : 'Nuevo pedido pagado',
          body: cancelled
            ? `${order.customer_name} pagó Bs ${Number(debit.amount_ves).toFixed(2)}: hay que reembolsarlo`
            : `${order.customer_name} · Bs ${Number(debit.amount_ves).toFixed(2)} por Débito inmediato`,
          url: '/dashboard/pedidos',
        }),
      }).catch(() => {})
    }
    const ref = check.reference ? ` · Ref ${check.reference}` : ''
    return {
      result: 'paid', reference: check.reference,
      message: order.status === 'cancelled'
        ? `Pago confirmado${ref}. El pedido está cancelado: hay que reembolsar al cliente.`
        : `Pago confirmado${ref}.`,
    }
  }

  if (check.result === 'rejected') {
    await claim({ status: 'rejected', reject_code: check.code, reject_description: check.message })
    return { result: 'rejected', message: check.message }
  }

  if (check.result === 'pending') {
    // the bank has it and is still deciding: keep following it
    if (debit.status !== 'confirming' && debit.bank_reference) await claim({ status: 'confirming' })
    return { result: 'pending', message: 'El banco todavía está procesando el pago.' }
  }

  return { result: 'unknown', message: check.message }
}
