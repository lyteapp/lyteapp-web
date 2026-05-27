'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

interface Customer {
  phone: string
  name: string
  orderCount: number
  totalSpent: number
  lastOrder: string
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

export default function ClientesPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user!.id)
        .maybeSingle()
      if (!store) { setLoading(false); return }

      const { data: orders } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, total, created_at')
        .eq('store_id', store.id)
        .not('status', 'in', '(cancelled)')
        .order('created_at', { ascending: false })

      if (!orders) { setLoading(false); return }

      // Group by phone
      const map = new Map<string, Customer>()
      for (const o of orders) {
        const phone = o.customer_phone ?? 'sin-telefono'
        if (!map.has(phone)) {
          map.set(phone, { phone, name: o.customer_name, orderCount: 0, totalSpent: 0, lastOrder: o.created_at })
        }
        const c = map.get(phone)!
        c.orderCount++
        c.totalSpent += Number(o.total ?? 0)
        if (o.created_at > c.lastOrder) { c.lastOrder = o.created_at; c.name = o.customer_name }
      }

      setCustomers([...map.values()].sort((a, b) => b.lastOrder.localeCompare(a.lastOrder)))
      setLoading(false)
    }
    load()
  }, [user])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [customers, search])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0 }}>Clientes</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>{customers.length} clientes registrados</p>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o telefono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', background: 'white', outline: 'none', width: 240 }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p style={{ fontSize: 14 }}>{search ? 'Sin resultados' : 'Aun no tienes clientes'}</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 110px 80px', gap: 0, padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {['Cliente', 'Telefono', 'Pedidos', 'Total gastado', 'Ultimo pedido'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((c, i) => (
            <div
              key={c.phone}
              style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 110px 80px', gap: 0, padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', alignItems: 'center' }}
            >
              {/* Name + avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#7C3AED18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{c.name.charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              </div>

              {/* Phone */}
              <a href={`tel:${c.phone}`} style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>{c.phone}</a>

              {/* Order count */}
              <div style={{ fontSize: 13, color: '#475569' }}>{c.orderCount} {c.orderCount === 1 ? 'pedido' : 'pedidos'}</div>

              {/* Total */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>${c.totalSpent.toFixed(2)}</div>

              {/* Last order */}
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{timeAgo(c.lastOrder)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
