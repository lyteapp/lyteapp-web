import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, store_id, order_id, customer_name, customer_phone, customer_lat, customer_lng, delivery_address } = body

    if (!store_id || !customer_name) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Use anon key — RLS policy deliveries_customer_insert allows this insert
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data, error } = await supabase.from('deliveries').insert({
      ...(id ? { id } : {}),
      store_id,
      order_id: order_id ?? null,
      customer_name,
      customer_phone: customer_phone ?? '',
      delivery_address: delivery_address ?? '',
      status: 'pending',
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
