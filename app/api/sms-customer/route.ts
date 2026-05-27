export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const SMS_MESSAGES: Record<string, string> = {
  confirmed:  'Tu pedido fue recibido. Lo estamos preparando.',
  processing: 'Tu pedido esta en preparacion en cocina.',
  ready:      'Tu pedido esta listo y sera enviado pronto.',
  delivered:  'Tu pedido fue entregado. Gracias por tu compra.',
  cancelled:  'Tu pedido fue cancelado. Contactanos para mas informacion.',
  // delivery statuses
  preparing:  'Tu pedido esta en preparacion en cocina.',
  picked_up:  'Tu pedido va en camino. El despachador ya salio.',
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
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  const client = twilio(accountSid, authToken)
  const greeting = customerName ? `Hola ${customerName}, ` : ''
  const body = greeting + message

  // Normalize phone to E.164 (assume Venezuela +58 if no country code)
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('0') ? '+58' + digits.slice(1) : digits.startsWith('58') ? '+' + digits : '+' + digits

  try {
    await client.messages.create({ to: normalized, from, body })
    return NextResponse.json({ sent: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ sent: false, error: msg }, { status: 500 })
  }
}
