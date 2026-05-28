export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'missing storeId' }, { status: 400 })

  const [{ data: ready }, { data: claimed }] = await Promise.all([
    supabase.from('orders')
      .select('id,customer_name,customer_phone,customer_notes,payment_method,total,created_at')
      .eq('store_id', storeId).eq('status', 'ready').eq('delivery_type', 'delivery')
      .order('created_at', { ascending: true }),
    supabase.from('deliveries')
      .select('order_id')
      .eq('store_id', storeId)
      .not('order_id', 'is', null)
      .not('status', 'eq', 'cancelled')
      .not('driver_id', 'is', null),
  ])

  const claimedIds = new Set((claimed ?? []).map((d: { order_id: string }) => d.order_id))
  const orders = (ready ?? []).filter((o: { id: string }) => !claimedIds.has(o.id))

  return NextResponse.json({ orders })
}
