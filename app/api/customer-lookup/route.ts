import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('store_id')
  const cedula = searchParams.get('cedula')?.trim()
  if (!storeId || !cedula) return Response.json({ error: 'Missing store_id or cedula' }, { status: 400 })

  const { data } = await supa
    .from('customers')
    .select('name, phone, address')
    .eq('store_id', storeId)
    .eq('cedula', cedula)
    .maybeSingle()

  return Response.json({ found: !!data, customer: data ?? null })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { store_id, cedula, name, phone, address } = body
  const cleanCedula = typeof cedula === 'string' ? cedula.trim() : ''
  if (!store_id || !cleanCedula) return Response.json({ error: 'Missing store_id or cedula' }, { status: 400 })

  const { error } = await supa
    .from('customers')
    .upsert(
      {
        store_id, cedula: cleanCedula,
        name: name?.trim() || null, phone: phone?.trim() || null, address: address?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,cedula' }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
