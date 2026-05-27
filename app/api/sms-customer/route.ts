export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const STATUS_MESSAGES: Record<string, string> = {
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
  if (digits.startsWith('58') && digits.length >= 11) return '+' + digits
  if (digits.startsWith('0') && digits.length === 11) return '+58' + digits.slice(1)
  if (digits.length === 10) return '+58' + digits
  return '+' + digits
}

export async function POST(req: NextRequest) {
  const { phone, status, customerName, businessName } = await req.json()
  if (!phone || !status) {
    return NextResponse.json({ error: 'missing phone or status' }, { status: 400 })
  }

  const statusMsg = STATUS_MESSAGES[status]
  if (!statusMsg) return NextResponse.json({ sent: false, reason: 'no message for status' })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !from) {
    console.error('[sms-customer] Twilio env vars missing')
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  const twilio = (await import('twilio')).default
  const client = twilio(accountSid, authToken)

  const normalized = normalizePhone(phone)

  // Build message: "[BusinessName] Hola {name}, {status message}"
  const parts: string[] = []
  if (businessName) parts.push(`[${businessName}]`)
  if (customerName) parts.push(`Hola ${customerName},`)
  parts.push(statusMsg)
  const body = parts.join(' ')

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
