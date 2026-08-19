import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id, store_id, customer_name, customer_phone, customer_notes,
      payment_method, total, delivery_type, payment_proof_url, items,
    } = body

    if (!id || !store_id || !customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Use anon key — same RLS policy that lets the browser insert orders
    // directly also covers this route; running the insert server-side just
    // skips the customer's own (often mobile, sometimes slow) connection to
    // Supabase in favor of a single fast hop to this function.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { error: orderError } = await supabase.from('orders').insert({
      id, store_id,
      customer_name, customer_phone,
      customer_notes: customer_notes || null,
      payment_method: payment_method || null,
      total, status: 'pending',
      delivery_type,
      payment_proof_url: payment_proof_url || null,
      payment_status: payment_proof_url ? 'pending' : null,
    })

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (Array.isArray(items) && items.length > 0) {
      const { error: itemsError } = await supabase.from('order_items').insert(
        items.map((i: {
          product_id: string; product_name: string; product_price: number
          quantity: number; subtotal: number; selected_options: unknown
        }) => ({
          order_id: id,
          product_id: i.product_id, product_name: i.product_name, product_price: i.product_price,
          quantity: i.quantity, subtotal: i.subtotal, selected_options: i.selected_options ?? null,
        }))
      )
      if (itemsError) console.error('order_items insert failed', itemsError)
    }

    return NextResponse.json({ id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
