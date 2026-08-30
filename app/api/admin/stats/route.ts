import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowlist = (process.env.ADMIN_EMAILS ?? '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    if (!allowlist.includes(user.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'No tienes acceso a este panel', email: user.email },
        { status: 403 }
      )
    }

    // Service role from here on — this bypasses RLS on purpose, gated by the
    // allowlist check above rather than per-row policies, since this route
    // exists specifically to see across every store/user on the platform.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: usersPage, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersErr) throw usersErr
    const users = usersPage.users

    const { data: stores, error: storesErr } = await supabaseAdmin
      .from('stores')
      .select('id, name, slug, owner_id, created_at')
      .order('created_at', { ascending: false })
    if (storesErr) throw storesErr

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentOrders, error: ordersErr } = await supabaseAdmin
      .from('orders')
      .select('store_id, created_at, total')
      .gte('created_at', since)
    if (ordersErr) throw ordersErr

    const signupsByDay: Record<string, number> = {}
    for (const u of users) {
      const day = (u.created_at ?? '').slice(0, 10)
      if (!day) continue
      signupsByDay[day] = (signupsByDay[day] ?? 0) + 1
    }

    const recentLogins = users
      .filter(u => u.last_sign_in_at)
      .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime())
      .slice(0, 20)
      .map(u => ({ email: u.email, last_sign_in_at: u.last_sign_in_at }))

    const ordersByStore: Record<string, { count: number; total: number }> = {}
    for (const o of recentOrders ?? []) {
      const bucket = ordersByStore[o.store_id] ?? { count: 0, total: 0 }
      bucket.count += 1
      bucket.total += Number(o.total) || 0
      ordersByStore[o.store_id] = bucket
    }

    const storesWithActivity = (stores ?? []).map(s => ({
      id: s.id, name: s.name, slug: s.slug, created_at: s.created_at,
      owner_email: users.find(u => u.id === s.owner_id)?.email ?? null,
      orders_last_30d: ordersByStore[s.id]?.count ?? 0,
      revenue_last_30d: ordersByStore[s.id]?.total ?? 0,
    }))

    return NextResponse.json({
      totalUsers: users.length,
      totalStores: (stores ?? []).length,
      signupsByDay,
      recentLogins,
      stores: storesWithActivity,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
