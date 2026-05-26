import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { store_id, order_id, customer_name, customer_phone, customer_lat, customer_lng } = body

    if (!store_id || !customer_name) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data: store } = await admin.from('stores').select('id').eq('id', store_id).maybeSingle()
    if (!store) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    const { data, error } = await admin.from('deliveries').insert({
      store_id,
      order_id: order_id ?? null,
      customer_name,
      customer_phone: customer_phone ?? '',
      delivery_address: '',
      status: 'preparing',
      driver_fee: 0,
      fee_paid: false,
      customer_lat: customer_lat ?? null,
      customer_lng: customer_lng ?? null,
      is_customer_order: true,
    }).select('id').single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
