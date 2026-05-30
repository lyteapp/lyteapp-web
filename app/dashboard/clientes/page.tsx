'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

interface Customer {
  key: string
  phone: string
  name: string
  orderCount: number
  totalSpent: number
  lastOrder: string
}

interface Order {
  id: string
  created_at: string
  status: string
  total: number
  customer_notes: string | null
  payment_method: string | null
  items: { product_name: string; quantity: number; subtotal: number }[]
}

type SortKey = 'recent' | 'spent' | 'orders' | 'name'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En proceso',
  ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado', completed: 'Completado',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', confirmed: '#3B82F6', processing: '#8B5CF6',
  ready: '#10B981', delivered: '#10B981', completed: '#10B981', cancelled: '#EF4444',
}

function normalizePhone(raw: string | null): string {
  if (!raw) return ''
  return raw.replace(/[\s\-().+]/g, '')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  const [storeId, setStoreId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: store } = await supabase
        .from('stores').select('id').eq('owner_id', user!.id).maybeSingle()
      if (!store) { setLoading(false); return }
      setStoreId(store.id)

      const { data: rows } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, total, created_at')
        .eq('store_id', store.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      if (!rows) { setLoading(false); return }

      // Group by normalized phone; orders with no phone get their own entry per unique name
      const map = new Map<string, Customer>()

      for (const o of rows) {
        const normalized = normalizePhone(o.customer_phone)
        // Use phone as key when available; fall back to name so nameless/phoneless entries
        // don't all collapse into one fake customer
        const key = normalized || `name:${(o.customer_name ?? '').toLowerCase().trim()}`

        if (!map.has(key)) {
          map.set(key, {
            key,
            phone: o.customer_phone ?? '',
            name: o.customer_name ?? 'Sin nombre',
            orderCount: 0,
            totalSpent: 0,
            lastOrder: o.created_at,
          })
        }
        const c = map.get(key)!
        c.orderCount++
        c.totalSpent += Number(o.total ?? 0)
        // Keep most recent order date and name (rows sorted newest-first, so first hit is newest)
        if (o.created_at > c.lastOrder) {
          c.lastOrder = o.created_at
          c.name = o.customer_name ?? c.name
          if (o.customer_phone) c.phone = o.customer_phone
        }
      }

      setCustomers([...map.values()])
      setLoading(false)
    }
    load()
  }, [user])

  async function openCustomer(c: Customer) {
    setSelected(c)
    setOrders([])
    setOrdersLoading(true)
    if (!storeId) return

    const normalized = normalizePhone(c.phone)
    let query = supabase
      .from('orders')
      .select('id, created_at, status, total, customer_notes, payment_method, order_items(product_name, quantity, subtotal)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (normalized) {
      // Match against common phone format variants
      query = query.ilike('customer_phone', `%${normalized.slice(-8)}%`)
    } else {
      query = query.ilike('customer_name', c.name)
    }

    const { data: rows } = await query

    setOrders((rows ?? []).map((o: Record<string, unknown>) => ({
      id: o.id as string,
      created_at: o.created_at as string,
      status: o.status as string,
      total: Number(o.total),
      customer_notes: o.customer_notes as string | null,
      payment_method: o.payment_method as string | null,
      items: (o.order_items as { product_name: string; quantity: number; subtotal: number }[]) ?? [],
    })))
    setOrdersLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().replace(/[\s\-().+]/g, '')
    let list = q
      ? customers.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          normalizePhone(c.phone).includes(q)
        )
      : [...customers]

    switch (sort) {
      case 'recent': list.sort((a, b) => b.lastOrder.localeCompare(a.lastOrder)); break
      case 'spent':  list.sort((a, b) => b.totalSpent - a.totalSpent); break
      case 'orders': list.sort((a, b) => b.orderCount - a.orderCount); break
      case 'name':   list.sort((a, b) => a.name.localeCompare(b.name)); break
    }
    return list
  }, [customers, search, sort])

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'recent', label: 'Mas reciente' },
    { value: 'spent',  label: 'Mayor gasto' },
    { value: 'orders', label: 'Mas pedidos' },
    { value: 'name',   label: 'A-Z nombre' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', position: 'relative' }}>

      {/* ── Customer list ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0 }}>Clientes</h2>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>{customers.length} registrados</span>
          </div>

          {/* Filters row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#94A3B8" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/><path strokeLinecap="round" d="M14 14l4 4"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre o telefono..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', background: 'white', outline: 'none', fontFamily: 'inherit' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94A3B8', lineHeight: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 9, padding: 3, flexShrink: 0 }}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  style={{
                    padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: sort === opt.value ? 'white' : 'transparent',
                    color: sort === opt.value ? '#0F172A' : '#64748B',
                    boxShadow: sort === opt.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count when filtering */}
          {search && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &quot;{search}&quot;
            </div>
          )}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 90px 120px 70px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Cliente', 'Telefono', 'Pedidos', 'Total gastado', 'Ultimo'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>

            {filtered.map((c, i) => {
              const isActive = selected?.key === c.key
              return (
                <div
                  key={c.key}
                  onClick={() => openCustomer(c)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 150px 90px 120px 70px', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', alignItems: 'center', cursor: 'pointer', background: isActive ? '#F5F3FF' : 'transparent', transition: 'background 0.1s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: isActive ? '#7C3AED' : '#7C3AED18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? 'white' : '#7C3AED' }}>{(c.name || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone || <span style={{ color: '#CBD5E1' }}>—</span>}</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{c.orderCount} {c.orderCount === 1 ? 'pedido' : 'pedidos'}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>${c.totalSpent.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>{timeAgo(c.lastOrder)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div style={{ width: 360, flexShrink: 0, background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', position: 'sticky', top: 24 }}>
          {/* Panel header */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{(selected.name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
              {selected.phone
                ? <a href={`tel:${selected.phone}`} style={{ fontSize: 13, color: '#7C3AED', textDecoration: 'none' }}>{selected.phone}</a>
                : <span style={{ fontSize: 13, color: '#CBD5E1' }}>Sin telefono</span>
              }
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F1F5F9' }}>
            {[
              { label: 'Pedidos',     value: selected.orderCount },
              { label: 'Total',       value: `$${selected.totalSpent.toFixed(2)}` },
              { label: 'Ticket prom.', value: `$${(selected.totalSpent / Math.max(selected.orderCount, 1)).toFixed(2)}` },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ padding: '14px 16px', textAlign: 'center', borderRight: i < 2 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{value}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Orders list */}
          <div style={{ padding: '14px 20px 6px', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Historial de pedidos
          </div>

          <div style={{ maxHeight: 480, overflowY: 'auto', scrollbarWidth: 'none' }}>
            {ordersLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'dbSpin 0.8s linear infinite' }} />
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Sin pedidos</div>
            ) : orders.map((o, i) => (
              <div key={o.id} style={{ padding: '12px 20px', borderBottom: i < orders.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{fmtDate(o.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[o.status] ?? '#64748B', background: (STATUS_COLOR[o.status] ?? '#64748B') + '18', padding: '2px 8px', borderRadius: 100 }}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>${o.total.toFixed(2)}</span>
                  </div>
                </div>
                {o.items.length > 0 && o.items.map((item, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '1px 0' }}>
                    <span>{item.quantity}x {item.product_name}</span>
                    <span>${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
                {o.payment_method && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Pago: {o.payment_method}</div>
                )}
                {o.customer_notes && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, fontStyle: 'italic' }}>&quot;{o.customer_notes}&quot;</div>
                )}
              </div>
            ))}
          </div>

          {/* WhatsApp button */}
          {selected.phone && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9' }}>
              <a
                href={`https://wa.me/${normalizePhone(selected.phone)}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 0', borderRadius: 10, background: '#25D366', color: 'white', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
              >
                <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contactar por WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
