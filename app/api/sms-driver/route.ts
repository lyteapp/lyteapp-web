export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('58') && digits.length >= 11) return '+' + digits
  if (digits.startsWith('0') && digits.length === 11) return '+58' + digits.slice(1)
  if (digits.length === 10) return '+58' + digits
  return '+' + digits
}

export async function POST(req: NextRequest) {
  const { storeId, customerName, businessName } = await req.json()
  if (!storeId) return NextResponse.json({ error: 'missing storeId' }, { status: 400 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !from) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  // Get active drivers for the store
  const { data: activeDrivers } = await supabase
    .from('delivery_drivers')
    .select('id, name, phone')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (!activeDrivers?.length) return NextResponse.json({ sent: 0 })

  // Exclude drivers currently on an active delivery
  const { data: busyRows } = await supabase
    .from('deliveries')
    .select('driver_id')
    .eq('store_id', storeId)
    .in('status', ['pending', 'preparing', 'ready', 'picked_up'])
    .not('driver_id', 'is', null)

  const busyIds = new Set((busyRows ?? []).map((r: { driver_id: string }) => r.driver_id))
  const available = activeDrivers.filter(d => !busyIds.has(d.id) && d.phone)

  if (!available.length) return NextResponse.json({ sent: 0 })

  const twilio = (await import('twilio')).default
  const client = twilio(accountSid, authToken)

  const orderPart = customerName ? ` Pedido de ${customerName}.` : ''
  const prefix    = businessName ? `[${businessName}]` : 'Pedido listo'
  const body      = `${prefix} Hay un pedido listo para recoger.${orderPart} Entra al app para ver los detalles.`

  let sent = 0
  await Promise.all(
    available.map(async (driver) => {
      try {
        await client.messages.create({ to: normalizePhone(driver.phone!), from, body })
        sent++
      } catch (err: unknown) {
        console.error(`[sms-driver] error for driver ${driver.id}:`, err instanceof Error ? err.message : err)
      }
    })
  )

  console.log(`[sms-driver] sent to ${sent}/${available.length} available drivers`)
  return NextResponse.json({ sent })
}
