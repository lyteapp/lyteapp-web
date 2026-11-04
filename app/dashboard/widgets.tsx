'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

// The dashboard home's widgets: each one loads its own data for the store
// and renders in a card. The home page (page.tsx) decides which ones show,
// in what order — the owner picks them in "Personalizar".

export type WidgetSize = 'sm' | 'md' | 'lg'
export type WidgetProps = { storeId: string; storeSlug: string }
export type WidgetDef = {
  id: string
  title: string
  desc: string
  size: WidgetSize
  icon: React.ReactNode
  Component: (p: WidgetProps) => React.ReactNode
}

const money = (n: number) => `$${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const daysAgo = (n: number) => { const d = startOfToday(); d.setDate(d.getDate() - n); return d }

function Head({ title, meta, href, link }: { title: string; meta?: string; href?: string; link?: string }) {
  return (
    <div className="dh-section-head dw-head">
      <div className="dh-section-title">{title}{meta && <span className="dh-meta">{meta}</span>}</div>
      {href && <Link href={href} className="dh-section-link">{link ?? 'Ver todo'}</Link>}
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="dw-empty">{children}</div>
}

// ── Resumen (ventas, pedidos, ticket, clientes nuevos) ───────────────────
function Summary({ storeId }: WidgetProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [s, setS] = useState({ sales: 0, orders: 0, ticket: 0, newCustomers: 0 })
  useEffect(() => {
    let off = false
    ;(async () => {
      const start = startOfToday()
      if (period === 'week') start.setDate(start.getDate() - start.getDay())
      if (period === 'month') start.setDate(1)
      const { data } = await supabase.from('orders').select('total, customer_phone, status')
        .eq('store_id', storeId).gte('created_at', start.toISOString())
      const ok = (data ?? []).filter(o => o.status !== 'cancelled')
      const sales = ok.reduce((a, o) => a + Number(o.total ?? 0), 0)
      // new = whose phone has no order before this period
      const phones = [...new Set(ok.map(o => o.customer_phone).filter(Boolean))] as string[]
      let newCustomers = 0
      if (phones.length) {
        const { data: before } = await supabase.from('orders').select('customer_phone')
          .eq('store_id', storeId).lt('created_at', start.toISOString()).in('customer_phone', phones.slice(0, 200))
        const seen = new Set((before ?? []).map(o => o.customer_phone))
        newCustomers = phones.filter(p => !seen.has(p)).length
      }
      if (!off) setS({ sales, orders: ok.length, ticket: ok.length ? sales / ok.length : 0, newCustomers })
    })()
    return () => { off = true }
  }, [storeId, period])
  const label = period === 'day' ? 'Hoy' : period === 'week' ? 'Esta semana' : 'Este mes'
  return (
    <>
      <div className="dh-section-head dw-head">
        <div className="dh-section-title">Resumen</div>
        <div className="dw-seg">
          {(['day', 'week', 'month'] as const).map(p => (
            <button key={p} type="button" className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
              {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>
      <div className="dw-kpis">
        {[
          { k: 'Ventas', v: money(s.sales), hero: true },
          { k: 'Pedidos', v: String(s.orders) },
          { k: 'Ticket promedio', v: money(s.ticket) },
          { k: 'Clientes nuevos', v: String(s.newCustomers) },
        ].map(x => (
          <div key={x.k} className={`dw-kpi${x.hero ? ' hero' : ''}`}>
            <div className="dh-kpi-label">{x.k}</div>
            <div className="dw-kpi-value">{x.v}</div>
            <div className="dw-kpi-foot">{label}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Pedidos en curso ─────────────────────────────────────────────────────
const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Nuevo', color: '#F59E0B' },
  confirmed: { label: 'Confirmado', color: '#3B82F6' },
  processing: { label: 'En proceso', color: '#8B5CF6' },
  ready: { label: 'Listo', color: '#10B981' },
}
function ActiveOrders({ storeId }: WidgetProps) {
  const [rows, setRows] = useState<{ id: string; order_number: number | null; customer_name: string; total: number; status: string; created_at: string }[] | null>(null)
  useEffect(() => {
    let off = false
    const load = async () => {
      const { data } = await supabase.from('orders').select('id, order_number, customer_name, total, status, created_at')
        .eq('store_id', storeId).in('status', Object.keys(ORDER_STATUS)).gte('created_at', daysAgo(2).toISOString())
        .order('created_at', { ascending: false }).limit(40)
      if (!off) setRows(data ?? [])
    }
    load()
    const t = setInterval(load, 30000)
    return () => { off = true; clearInterval(t) }
  }, [storeId])
  const counts = Object.keys(ORDER_STATUS).map(k => ({ k, n: (rows ?? []).filter(r => r.status === k).length }))
  return (
    <>
      <Head title="Pedidos en curso" href="/dashboard/pedidos" link="Ir a pedidos" />
      <div className="dw-pills">
        {counts.map(c => (
          <div key={c.k} className="dw-pill">
            <span className="dw-dot" style={{ background: ORDER_STATUS[c.k].color }} />
            <b>{c.n}</b> {ORDER_STATUS[c.k].label}
          </div>
        ))}
      </div>
      {rows && rows.length === 0 && <Empty>No hay pedidos en curso.</Empty>}
      <div className="dw-list">
        {(rows ?? []).slice(0, 5).map(r => (
          <Link key={r.id} href="/dashboard/pedidos" className="dw-row">
            <span className="dw-row-num">#{r.order_number ?? r.id.slice(0, 5).toUpperCase()}</span>
            <span className="dw-row-name">{r.customer_name || 'Cliente'}</span>
            <span className="dw-badge" style={{ color: ORDER_STATUS[r.status]?.color, background: `${ORDER_STATUS[r.status]?.color}1A` }}>{ORDER_STATUS[r.status]?.label}</span>
            <span className="dw-row-amount">{money(Number(r.total ?? 0))}</span>
          </Link>
        ))}
      </div>
    </>
  )
}

// ── Ventas de la semana (barras por día) ─────────────────────────────────
function SalesWeek({ storeId }: WidgetProps) {
  const [days, setDays] = useState<{ label: string; total: number }[]>([])
  useEffect(() => {
    let off = false
    ;(async () => {
      const { data } = await supabase.from('orders').select('total, created_at, status')
        .eq('store_id', storeId).gte('created_at', daysAgo(6).toISOString())
      const list = Array.from({ length: 7 }, (_, i) => {
        const d = daysAgo(6 - i)
        return { key: d.toDateString(), label: d.toLocaleDateString('es', { weekday: 'short' }).replace('.', ''), total: 0 }
      })
      for (const o of data ?? []) {
        if (o.status === 'cancelled') continue
        const day = list.find(x => x.key === new Date(o.created_at).toDateString())
        if (day) day.total += Number(o.total ?? 0)
      }
      if (!off) setDays(list)
    })()
    return () => { off = true }
  }, [storeId])
  const max = Math.max(1, ...days.map(d => d.total))
  const sum = days.reduce((a, d) => a + d.total, 0)
  return (
    <>
      <Head title="Ventas de la semana" meta={money(sum)} href="/dashboard/analitics" link="Analíticas" />
      <div className="dw-bars">
        {days.map((d, i) => (
          <div key={d.label + i} className="dw-bar-col" title={money(d.total)}>
            <div className="dw-bar-track"><div className={`dw-bar${i === days.length - 1 ? ' today' : ''}`} style={{ height: `${Math.max(3, (d.total / max) * 100)}%` }} /></div>
            <div className="dw-bar-label">{d.label}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Lo más vendido (últimos 30 días) ─────────────────────────────────────
function TopProducts({ storeId }: WidgetProps) {
  const [top, setTop] = useState<{ name: string; qty: number; total: number }[] | null>(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      const { data } = await supabase.from('order_items')
        .select('product_name, quantity, subtotal, orders!inner(store_id, created_at, status)')
        .eq('orders.store_id', storeId).gte('orders.created_at', daysAgo(30).toISOString()).neq('orders.status', 'cancelled')
        .limit(2000)
      const by = new Map<string, { name: string; qty: number; total: number }>()
      for (const it of data ?? []) {
        const name = it.product_name || 'Producto'
        const cur = by.get(name) ?? { name, qty: 0, total: 0 }
        cur.qty += Number(it.quantity ?? 0); cur.total += Number(it.subtotal ?? 0)
        by.set(name, cur)
      }
      if (!off) setTop([...by.values()].sort((a, b) => b.qty - a.qty).slice(0, 5))
    })()
    return () => { off = true }
  }, [storeId])
  const max = Math.max(1, ...(top ?? []).map(t => t.qty))
  return (
    <>
      <Head title="Lo más vendido" meta="30 días" href="/dashboard/productos" link="Productos" />
      {top && top.length === 0 && <Empty>Aún no hay ventas este mes.</Empty>}
      <div className="dh-top-list">
        {(top ?? []).map((p, i) => (
          <div key={p.name} className="dh-top-row">
            <div className="dh-top-rank">0{i + 1}</div>
            <div>
              <div className="dh-top-name">{p.name}</div>
              <div className="dh-top-bar"><div className="dh-top-fill" style={{ width: `${(p.qty / max) * 100}%` }} /></div>
            </div>
            <div className="dh-top-meta">{p.qty}<span>vendidos</span></div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Tiempos de entrega (hoy) ─────────────────────────────────────────────
const BUCKETS = [
  { label: '0–15 min', min: 0, max: 15 },
  { label: '15–30 min', min: 15, max: 30 },
  { label: '30–45 min', min: 30, max: 45 },
  { label: '+45 min', min: 45, max: Infinity },
]
function DeliveryTimes({ storeId }: WidgetProps) {
  const [m, setM] = useState({ driver: [] as number[], instore: [] as number[], total: [] as number[] })
  useEffect(() => {
    let off = false
    const load = async () => {
      const since = startOfToday().toISOString()
      const mins = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
      const { data } = await supabase.from('deliveries').select('created_at, delivered_at, driver_id, order:order_id(created_at)')
        .eq('store_id', storeId).not('delivered_at', 'is', null).gte('delivered_at', since)
      const rows = data ?? []
      if (off) return
      setM({
        driver: rows.filter(d => d.driver_id).map(d => mins(d.created_at, d.delivered_at)),
        instore: rows.filter(d => !d.driver_id).map(d => mins(d.created_at, d.delivered_at)),
        total: rows.map(d => {
          const oc = (d.order as unknown as { created_at: string } | null)?.created_at
          return oc ? mins(oc, d.delivered_at) : 0
        }).filter(x => x > 0),
      })
    }
    load()
    const t = setInterval(load, 60000)
    return () => { off = true; clearInterval(t) }
  }, [storeId])
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null)
  const all = [...m.driver, ...m.instore]
  const counts = BUCKETS.map(b => all.filter(x => x >= b.min && x < b.max).length)
  const cmax = Math.max(1, ...counts)
  return (
    <>
      <Head title="Tiempos de entrega" meta="hoy" href="/dashboard/analitics" link="Ver detalle" />
      <div className="dw-stats3">
        {[
          { k: 'Delivery', sub: 'con despachador', v: avg(m.driver), n: m.driver.length },
          { k: 'En tienda', sub: 'sin despachador', v: avg(m.instore), n: m.instore.length },
          { k: 'Total', sub: 'pedido a entrega', v: avg(m.total), n: m.total.length },
        ].map(x => (
          <div key={x.k} className="dw-stat">
            <div className="dw-stat-k">{x.k}</div>
            <div className="dw-stat-v">{x.v ?? '—'}{x.v !== null && <small>min</small>}</div>
            <div className="dw-stat-sub">{x.sub} · {x.n}</div>
          </div>
        ))}
      </div>
      {all.length === 0 ? <Empty>Sin entregas completadas hoy.</Empty> : (
        <div className="dw-hbars">
          {BUCKETS.map((b, i) => (
            <div key={b.label} className="dw-hbar">
              <span>{b.label}</span>
              <div className="dw-hbar-track"><div style={{ width: `${(counts[i] / cmax) * 100}%` }} /></div>
              <b>{counts[i]}</b>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Caja de hoy (por método de pago) ─────────────────────────────────────
const PAY_LABEL: Record<string, string> = {
  pago_movil: 'Pago Móvil', 'pago movil': 'Pago Móvil', zelle: 'Zelle', paypal: 'PayPal', usdt: 'USDT',
  efectivo: 'Efectivo', transferencia: 'Transferencia', binance: 'Binance Pay', punto_venta: 'Punto de venta', 'punto de venta': 'Punto de venta',
}
function CashToday({ storeId }: WidgetProps) {
  const [rows, setRows] = useState<{ method: string; total: number; n: number }[] | null>(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      const { data } = await supabase.from('orders').select('payment_method, total, status')
        .eq('store_id', storeId).gte('created_at', startOfToday().toISOString())
      const by = new Map<string, { method: string; total: number; n: number }>()
      for (const o of data ?? []) {
        if (o.status === 'cancelled') continue
        const key = (o.payment_method || 'Sin método').toLowerCase()
        const cur = by.get(key) ?? { method: PAY_LABEL[key] ?? (o.payment_method || 'Sin método'), total: 0, n: 0 }
        cur.total += Number(o.total ?? 0); cur.n++
        by.set(key, cur)
      }
      if (!off) setRows([...by.values()].sort((a, b) => b.total - a.total))
    })()
    return () => { off = true }
  }, [storeId])
  const sum = (rows ?? []).reduce((a, r) => a + r.total, 0)
  return (
    <>
      <Head title="Caja de hoy" meta={money(sum)} href="/dashboard/caja" link="Ir a caja" />
      {rows && rows.length === 0 && <Empty>Aún no hay cobros hoy.</Empty>}
      <div className="dw-list">
        {(rows ?? []).map(r => (
          <div key={r.method} className="dw-row static">
            <span className="dw-row-name">{r.method}</span>
            <span className="dw-row-sub">{r.n} {r.n === 1 ? 'pedido' : 'pedidos'}</span>
            <span className="dw-row-amount">{money(r.total)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Delivery en vivo ─────────────────────────────────────────────────────
function DeliveryLive({ storeId }: WidgetProps) {
  const [c, setC] = useState({ waiting: 0, ready: 0, route: 0, done: 0 })
  useEffect(() => {
    let off = false
    const load = async () => {
      const { data } = await supabase.from('deliveries').select('status')
        .eq('store_id', storeId).gte('created_at', startOfToday().toISOString())
      const s = (data ?? []).map(d => d.status)
      if (!off) setC({
        waiting: s.filter(x => x === 'pending' || x === 'preparing').length,
        ready: s.filter(x => x === 'ready').length,
        route: s.filter(x => x === 'picked_up').length,
        done: s.filter(x => x === 'delivered').length,
      })
    }
    load()
    const t = setInterval(load, 30000)
    return () => { off = true; clearInterval(t) }
  }, [storeId])
  return (
    <>
      <Head title="Delivery de hoy" href="/dashboard/delivery" link="Ver mapa" />
      <div className="dw-grid2">
        {[
          { k: 'En preparación', v: c.waiting }, { k: 'Listos para salir', v: c.ready },
          { k: 'En camino', v: c.route }, { k: 'Entregados', v: c.done },
        ].map(x => (
          <div key={x.k} className="dw-mini"><b>{x.v}</b><span>{x.k}</span></div>
        ))}
      </div>
    </>
  )
}

// ── Inventario bajo ──────────────────────────────────────────────────────
function LowStock({ storeId }: WidgetProps) {
  const [rows, setRows] = useState<{ name: string; qty: number; min: number; unit: string }[] | null>(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      const { data: items } = await supabase.from('inv_items').select('id, name, unit, min_stock')
        .eq('store_id', storeId).eq('active', true).gt('min_stock', 0)
      const ids = (items ?? []).map(i => i.id)
      const { data: stock } = ids.length
        ? await supabase.from('inv_stock').select('item_id, qty').eq('store_id', storeId).in('item_id', ids)
        : { data: [] as { item_id: string; qty: number }[] }
      const qty = new Map<string, number>()
      for (const s of stock ?? []) qty.set(s.item_id, (qty.get(s.item_id) ?? 0) + Number(s.qty ?? 0))
      const low = (items ?? []).map(i => ({ name: i.name, qty: qty.get(i.id) ?? 0, min: Number(i.min_stock), unit: i.unit ?? '' }))
        .filter(i => i.qty <= i.min).sort((a, b) => a.qty / a.min - b.qty / b.min)
      if (!off) setRows(low)
    })()
    return () => { off = true }
  }, [storeId])
  return (
    <>
      <Head title="Inventario bajo" meta={rows ? `${rows.length}` : undefined} href="/dashboard/inventario" link="Inventario" />
      {rows && rows.length === 0 && <Empty>Todo en orden. Ningún artículo bajo el mínimo.</Empty>}
      <div className="dw-list">
        {(rows ?? []).slice(0, 6).map(r => (
          <div key={r.name} className="dw-row static">
            <span className="dw-row-name">{r.name}</span>
            <span className="dw-row-sub">mín. {r.min} {r.unit}</span>
            <span className="dw-row-amount" style={{ color: r.qty <= 0 ? '#DC2626' : '#D97706' }}>{r.qty} {r.unit}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Tu tienda pública ────────────────────────────────────────────────────
function StoreLink({ storeSlug }: WidgetProps) {
  const [copied, setCopied] = useState(false)
  return (
    <>
      <Head title="Tu tienda pública" />
      {storeSlug ? (
        <>
          <button type="button" className="dw-link-box" onClick={() => {
            navigator.clipboard.writeText(`https://lyte-app.com/${storeSlug}`); setCopied(true); setTimeout(() => setCopied(false), 1500)
          }}>
            <span>lyte-app.com/{storeSlug}</span>
            <small>{copied ? 'Copiado ✓' : 'Copiar'}</small>
          </button>
          <div className="dw-actions">
            <Link href={`/${storeSlug}`} target="_blank" className="dw-btn dark">Ver tienda</Link>
            <Link href="/dashboard/canal/vitrina/editor" className="dw-btn">Editar diseño</Link>
          </div>
        </>
      ) : <Empty>Configura tu tienda primero.</Empty>}
    </>
  )
}

// ── Accesos rápidos ──────────────────────────────────────────────────────
function QuickActions() {
  const items = [
    { href: '/dashboard/productos', label: 'Productos' },
    { href: '/dashboard/pedidos', label: 'Ver pedidos' },
    { href: '/dashboard/caja', label: 'Abrir caja' },
    { href: '/dashboard/productos/categorias', label: 'Categorías' },
    { href: '/dashboard/canal/vitrina/editor', label: 'Diseñar vitrina' },
    { href: '/dashboard/delivery', label: 'Delivery' },
  ]
  return (
    <>
      <Head title="Accesos rápidos" />
      <div className="dw-quick">
        {items.map(i => <Link key={i.href} href={i.href} className="dw-quick-btn">{i.label}<span>→</span></Link>)}
      </div>
    </>
  )
}

const I = (d: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>

export const WIDGETS: WidgetDef[] = [
  { id: 'summary', title: 'Resumen', desc: 'Ventas, pedidos, ticket promedio y clientes nuevos del día, la semana o el mes.', size: 'lg', icon: I(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>), Component: Summary },
  { id: 'active-orders', title: 'Pedidos en curso', desc: 'Los pedidos nuevos, en proceso y listos, al momento.', size: 'md', icon: I(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /></>), Component: ActiveOrders },
  { id: 'sales-week', title: 'Ventas de la semana', desc: 'Lo que vendiste cada día de los últimos 7 días.', size: 'md', icon: I(<><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="7" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="17" rx="1" /></>), Component: SalesWeek },
  { id: 'top-products', title: 'Lo más vendido', desc: 'Tus 5 productos estrella de los últimos 30 días.', size: 'md', icon: I(<path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7L12 17.8 5.8 21.2l1.3-7L2 9.4l7-.9z" />), Component: TopProducts },
  { id: 'cash-today', title: 'Caja de hoy', desc: 'Cuánto entró hoy por cada método de pago.', size: 'md', icon: I(<><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /></>), Component: CashToday },
  { id: 'delivery-times', title: 'Tiempos de entrega', desc: 'Cuánto tardan tus entregas de hoy.', size: 'md', icon: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>), Component: DeliveryTimes },
  { id: 'delivery-live', title: 'Delivery de hoy', desc: 'Entregas en preparación, listas, en camino y entregadas.', size: 'sm', icon: I(<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>), Component: DeliveryLive },
  { id: 'low-stock', title: 'Inventario bajo', desc: 'Artículos por debajo de su stock mínimo.', size: 'md', icon: I(<><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></>), Component: LowStock },
  { id: 'store-link', title: 'Tu tienda pública', desc: 'El enlace de tu tienda para copiar, verla o editar su diseño.', size: 'sm', icon: I(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>), Component: StoreLink },
  { id: 'quick-actions', title: 'Accesos rápidos', desc: 'Atajos a lo que más usas.', size: 'sm', icon: I(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />), Component: QuickActions },
]

export const DEFAULT_WIDGETS = ['summary', 'active-orders', 'sales-week', 'top-products', 'cash-today', 'store-link']
