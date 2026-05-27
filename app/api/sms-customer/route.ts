export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const SMS_MESSAGES: Record<string, string> = {
  confirmed:  'Tu pedido fue recibido. Lo estamos preparando.',
  processing: 'Tu pedido esta en preparacion en cocina.',
  ready:      'Tu pedido esta listo y sera enviado pronto.',
  delivered:  'Tu pedido fue entregado. Gracias por tu compra.',
  cancelled:  'Tu pedido fue cancelado. Contactanos para mas informacion.',
  preparing:  'Tu pedido esta en preparacion en cocina.',
  picked_up:  'Tu pedido va en camino. El despachador ya salio.',
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Already has country code
  if (digits.startsWith('58') && digits.length >= 11) return '+' + digits
  // Venezuelan number starting with 0 (e.g. 04141234567)
  if (digits.startsWith('0') && digits.length === 11) return '+58' + digits.slice(1)
  // 10-digit local number without leading 0 (e.g. 4141234567)
  if (digits.length === 10) return '+58' + digits
  // Fallback: just prepend +
  return '+' + digits
}

export async function POST(req: NextRequest) {
  const { phone, status, customerName } = await req.json()
  if (!phone || !status) {
    return NextResponse.json({ error: 'missing phone or status' }, { status: 400 })
  }

  const message = SMS_MESSAGES[status]
  if (!message) return NextResponse.json({ sent: false, reason: 'no message for status' })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !from) {
    console.error('[sms-customer] Twilio env vars missing')
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  // Dynamic import avoids bundler issues (same pattern as web-push)
  const twilio = (await import('twilio')).default
  const client = twilio(accountSid, authToken)

  const greeting = customerName ? `Hola ${customerName}, ` : ''
  const body = greeting + message
  const normalized = normalizePhone(phone)

  console.log(`[sms-customer] sending to ${normalized} status=${status}`)

  try {
    const msg = await client.messages.create({ to: normalized, from, body })
    console.log(`[sms-customer] sent sid=${msg.sid} status=${msg.status}`)
    return NextResponse.json({ sent: true, sid: msg.sid })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[sms-customer] error: ${errMsg}`)
    return NextResponse.json({ sent: false, error: errMsg }, { status: 500 })
  }
}
