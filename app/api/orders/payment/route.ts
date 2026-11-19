import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Whether an order's payment has been marked collected — asked every few
// seconds by a kiosk whose customer is waiting there to pay cash, so it can
// say "¡Pago recibido!" and free itself for the next customer.
export async function GET(req: Request) {
  await connection()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'Falta el pedido' }, { status: 400 })
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await supa.from('orders').select('payment_status').eq('id', id).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 502 })
  if (!data) return Response.json({ error: 'No encontrado' }, { status: 404 })
  return Response.json({ paid: data.payment_status === 'approved' }, { headers: { 'Cache-Control': 'no-store' } })
}
