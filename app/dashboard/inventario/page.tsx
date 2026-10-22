'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDashboardStore } from '../../lib/DashboardStoreProvider'
import LyteLeafLoader from '../../components/LyteLeafLoader'
import Compras from './Compras'
import Productos from './Productos'
import ListControls, { Thumb, sortAndGroup, useListPrefs } from './ListControls'
import './inventario.css'

// Inventory, phase 1: stock per warehouse, items, warehouses, suppliers and
// the movement ledger (kardex). Every stock change goes through the
// inv_apply_movement() database function (see the inventory_base migration).

type Warehouse = { id: string; name: string; description: string | null; is_default: boolean; active: boolean }
type Supplier = {
  id: string; name: string; tax_id: string | null; contact_name: string | null; phone: string | null
  email: string | null; address: string | null; notes: string | null; active: boolean
}
type Item = {
  id: string; name: string; sku: string | null; barcode: string | null; category: string | null
  unit: string; purchase_unit: string | null; purchase_factor: number; min_stock: number
  avg_cost: number; last_cost: number | null; supplier_id: string | null; product_id: string | null
  notes: string | null; active: boolean
}
type Stock = { warehouse_id: string; item_id: string; qty: number }
type Movement = {
  id: string; item_id: string; warehouse_id: string; type: string; qty: number
  unit_cost: number | null; balance: number; note: string | null; created_at: string
}
// 'home' picks a warehouse; stock/purchases/kardex work inside the chosen
// warehouse; items/products/suppliers/warehouses are the shared catalog.
type Tab = 'home' | 'stock' | 'purchases' | 'products' | 'items' | 'warehouses' | 'suppliers' | 'kardex'
const WAREHOUSE_TABS: [Tab, string][] = [
  ['stock', 'Existencias'], ['purchases', 'Compras'], ['kardex', 'Movimientos'],
  ['items', 'Artículos'], ['products', 'Productos y recetas'], ['suppliers', 'Proveedores'],
]
const CATALOG_TITLE: Partial<Record<Tab, string>> = { warehouses: 'Administrar almacenes' }

const UNITS = [
  { id: 'und', label: 'Unidad (und)' }, { id: 'kg', label: 'Kilogramo (kg)' }, { id: 'g', label: 'Gramo (g)' },
  { id: 'l', label: 'Litro (l)' }, { id: 'ml', label: 'Mililitro (ml)' }, { id: 'lb', label: 'Libra (lb)' },
  { id: 'oz', label: 'Onza (oz)' }, { id: 'm', label: 'Metro (m)' }, { id: 'par', label: 'Par' },
]
const MOVE_LABEL: Record<string, string> = {
  initial: 'Stock inicial', adjust: 'Ajuste', count: 'Conteo físico', purchase: 'Compra',
  transfer_in: 'Transferencia (entra)', transfer_out: 'Transferencia (sale)', waste: 'Desperdicio',
  production_in: 'Producción', production_out: 'Consumo producción', sale: 'Venta', sale_return: 'Venta cancelada (vuelve)', requisition: 'Requisición',
}

const num = (v: unknown) => Number(v) || 0
const fmtQty = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 3 })
const money = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const parseNum = (s: string) => parseFloat(s.replace(',', '.'))
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const EMPTY_ITEM = { name: '', sku: '', barcode: '', category: '', unit: 'und', purchase_unit: '', purchase_factor: '1', min_stock: '', supplier_id: '', product_id: '', notes: '' }
const EMPTY_SUPPLIER = { name: '', tax_id: '', contact_name: '', phone: '', email: '', address: '', notes: '' }

export default function InventarioPage() {
  const { storeId } = useDashboardStore()
  const [tab, setTab] = useState<Tab>('home')
  // The warehouse being worked on (kept in the URL so a reload stays there)
  const [whSel, setWhSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stock, setStock] = useState<Stock[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [debtBySupplier, setDebtBySupplier] = useState<Record<string, number>>({})
  // Item photo: the store product it's sold as, if any
  const [photoByItem, setPhotoByItem] = useState<Record<string, string>>({})
  const stockPrefs = useListPrefs('stock', 'category')
  const itemPrefs = useListPrefs('items', 'category')
  const [toast, setToast] = useState('')

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600) }


  const load = useCallback(async (sid: string) => {
    const [w, i, s, st, mv] = await Promise.all([
      supabase.from('inv_warehouses').select('*').eq('store_id', sid).order('created_at'),
      supabase.from('inv_items').select('*').eq('store_id', sid).order('name'),
      supabase.from('inv_suppliers').select('*').eq('store_id', sid).order('name'),
      supabase.from('inv_stock').select('warehouse_id, item_id, qty').eq('store_id', sid),
      supabase.from('inv_movements').select('id, item_id, warehouse_id, type, qty, unit_cost, balance, note, created_at')
        .eq('store_id', sid).order('created_at', { ascending: false }).limit(300),
    ])
    const { data: dues } = await supabase.from('inv_purchases').select('supplier_id, total_usd, paid_usd').eq('store_id', sid).neq('status', 'paid')
    const debt: Record<string, number> = {}
    for (const d of (dues ?? []) as { supplier_id: string | null; total_usd: number; paid_usd: number }[]) {
      if (d.supplier_id) debt[d.supplier_id] = (debt[d.supplier_id] ?? 0) + Math.max(0, num(d.total_usd) - num(d.paid_usd))
    }
    setDebtBySupplier(debt)
    const { data: pics } = await supabase.from('inv_product_links').select('item_id, products(image_url)').eq('store_id', sid).eq('mode', 'item')
    const photos: Record<string, string> = {}
    for (const r of (pics ?? []) as unknown as { item_id: string | null; products: { image_url: string | null } | null }[]) {
      if (r.item_id && r.products?.image_url) photos[r.item_id] = r.products.image_url
    }
    setPhotoByItem(photos)
    setWarehouses((w.data ?? []) as Warehouse[])
    setItems(((i.data ?? []) as Item[]).map(x => ({ ...x, purchase_factor: num(x.purchase_factor) || 1, min_stock: num(x.min_stock), avg_cost: num(x.avg_cost) })))
    setSuppliers((s.data ?? []) as Supplier[])
    setStock(((st.data ?? []) as Stock[]).map(x => ({ ...x, qty: num(x.qty) })))
    setMovements(((mv.data ?? []) as Movement[]).map(x => ({ ...x, qty: num(x.qty), balance: num(x.balance), unit_cost: x.unit_cost == null ? null : num(x.unit_cost) })))
    setLoading(false)
  }, [])
  useEffect(() => { if (storeId) Promise.resolve().then(() => load(storeId)) }, [storeId, load])

  // ── derived ──
  const activeWarehouses = warehouses.filter(w => w.active)
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items])
  const whById = useMemo(() => new Map(warehouses.map(w => [w.id, w])), [warehouses])
  const qtyOf = (itemId: string, whId?: string) =>
    stock.filter(s => s.item_id === itemId && (!whId || s.warehouse_id === whId)).reduce((t, s) => t + s.qty, 0)

  // ── stock tab state ──
  const [whFilter, setWhFilter] = useState('')
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)

  // ── movement modal (stock inicial / entrada / salida / conteo) ──
  const [mv, setMv] = useState<null | { itemId: string; whId: string; kind: 'initial' | 'in' | 'out' | 'count'; qty: string; cost: string; note: string }>(null)
  const [mvSaving, setMvSaving] = useState(false)
  const [mvError, setMvError] = useState('')
  async function saveMovement() {
    if (!mv || !storeId) return
    const item = itemById.get(mv.itemId)
    const q = parseNum(mv.qty)
    if (!item || !mv.whId || !Number.isFinite(q)) { setMvError('Completa artículo, almacén y cantidad.'); return }
    let delta = q
    let type = 'adjust'
    if (mv.kind === 'initial') type = 'initial'
    if (mv.kind === 'out') delta = -Math.abs(q)
    if (mv.kind === 'count') { type = 'count'; delta = q - qtyOf(mv.itemId, mv.whId) }
    if (delta === 0) { setMvError(mv.kind === 'count' ? 'El conteo coincide con el sistema: no hay nada que ajustar.' : 'La cantidad no puede ser cero.'); return }
    const cost = parseNum(mv.cost)
    setMvSaving(true); setMvError('')
    const { error } = await supabase.rpc('inv_apply_movement', {
      p_store: storeId, p_item: mv.itemId, p_warehouse: mv.whId, p_type: type, p_qty: delta,
      p_unit_cost: delta > 0 && Number.isFinite(cost) ? cost : null,
      p_note: mv.note.trim() || null,
    })
    setMvSaving(false)
    if (error) { setMvError(error.message); return }
    setMv(null)
    flash('Movimiento registrado')
    load(storeId)
  }

  // ── item form ──
  const [itemForm, setItemForm] = useState<null | (typeof EMPTY_ITEM & { id?: string })>(null)
  const [itemSaving, setItemSaving] = useState(false)
  async function saveItem() {
    if (!itemForm || !storeId || !itemForm.name.trim()) return
    setItemSaving(true)
    const payload = {
      store_id: storeId, name: itemForm.name.trim(),
      sku: itemForm.sku.trim() || null, barcode: itemForm.barcode.trim() || null,
      category: itemForm.category.trim() || null, unit: itemForm.unit,
      purchase_unit: itemForm.purchase_unit.trim() || null,
      purchase_factor: parseNum(itemForm.purchase_factor) > 0 ? parseNum(itemForm.purchase_factor) : 1,
      min_stock: parseNum(itemForm.min_stock) || 0,
      supplier_id: itemForm.supplier_id || null,
      notes: itemForm.notes.trim() || null,
    }
    const { error } = itemForm.id
      ? await supabase.from('inv_items').update(payload).eq('id', itemForm.id)
      : await supabase.from('inv_items').insert(payload)
    setItemSaving(false)
    if (error) { flash(error.message); return }
    setItemForm(null)
    flash(itemForm.id ? 'Artículo actualizado' : 'Artículo creado')
    load(storeId)
  }
  async function toggleItemActive(it: Item) {
    if (!storeId) return
    await supabase.from('inv_items').update({ active: !it.active }).eq('id', it.id)
    load(storeId)
  }

  // ── warehouse form ──
  const [whForm, setWhForm] = useState<null | { id?: string; name: string; description: string; is_default: boolean }>(null)
  async function saveWarehouse() {
    if (!whForm || !storeId || !whForm.name.trim()) return
    const payload = { store_id: storeId, name: whForm.name.trim(), description: whForm.description.trim() || null, is_default: whForm.is_default }
    if (whForm.is_default) await supabase.from('inv_warehouses').update({ is_default: false }).eq('store_id', storeId)
    const { error } = whForm.id
      ? await supabase.from('inv_warehouses').update(payload).eq('id', whForm.id)
      : await supabase.from('inv_warehouses').insert({ ...payload, is_default: whForm.is_default || warehouses.length === 0 })
    if (error) { flash(error.message); return }
    setWhForm(null)
    flash(whForm.id ? 'Almacén actualizado' : 'Almacén creado')
    load(storeId)
  }
  async function toggleWarehouseActive(w: Warehouse) {
    if (!storeId) return
    const has = stock.some(s => s.warehouse_id === w.id && s.qty !== 0)
    if (w.active && has && !confirm(`"${w.name}" todavía tiene existencias. ¿Desactivarlo igual? Su stock se mantiene, pero no aparecerá para nuevos movimientos.`)) return
    await supabase.from('inv_warehouses').update({ active: !w.active }).eq('id', w.id)
    load(storeId)
  }

  // ── supplier form ──
  const [supForm, setSupForm] = useState<null | (typeof EMPTY_SUPPLIER & { id?: string })>(null)
  const [supSearch, setSupSearch] = useState('')
  async function saveSupplier() {
    if (!supForm || !storeId || !supForm.name.trim()) return
    const clean = (v: string) => v.trim() || null
    const payload = {
      store_id: storeId, name: supForm.name.trim(), tax_id: clean(supForm.tax_id), contact_name: clean(supForm.contact_name),
      phone: clean(supForm.phone), email: clean(supForm.email), address: clean(supForm.address), notes: clean(supForm.notes),
    }
    const { error } = supForm.id
      ? await supabase.from('inv_suppliers').update(payload).eq('id', supForm.id)
      : await supabase.from('inv_suppliers').insert(payload)
    if (error) { flash(error.message); return }
    setSupForm(null)
    flash(supForm.id ? 'Proveedor actualizado' : 'Proveedor creado')
    load(storeId)
  }
  async function toggleSupplierActive(s: Supplier) {
    if (!storeId) return
    await supabase.from('inv_suppliers').update({ active: !s.active }).eq('id', s.id)
    load(storeId)
  }

  // ── kardex filters ──
  const [kxItem, setKxItem] = useState('')
  const [kxWh, setKxWh] = useState('')

  // ── navigation: pick a warehouse first ──
  const setUrl = (params: Record<string, string | null>) => {
    const u = new URL(window.location.href)
    for (const [k, v] of Object.entries(params)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k) }
    window.history.replaceState(null, '', u)
  }
  function openWarehouse(id: string) {
    setWhSel(id); setWhFilter(id); setKxWh(id); setKxItem(''); setSearch(''); setLowOnly(false)
    setTab('stock'); setUrl({ almacen: id, ver: null })
  }
  function openCatalog(t: Tab) { setWhSel(null); setTab(t); setUrl({ almacen: null, ver: t }) }
  function goHome() { setWhSel(null); setTab('home'); setUrl({ almacen: null, ver: null }) }
  // Reopen the warehouse / catalog page the URL points to
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    if (loading || restored) return
    const u = new URL(window.location.href)
    const wh = u.searchParams.get('almacen'), ver = u.searchParams.get('ver') as Tab | null
    Promise.resolve().then(() => {
      if (wh && warehouses.some(w => w.id === wh)) openWarehouse(wh)
      else if (ver && CATALOG_TITLE[ver]) openCatalog(ver)
      setRestored(true)
    })
  }, [loading, restored, warehouses]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="inv-loading"><LyteLeafLoader size={44} /></div>

  // First run: nothing set up yet
  const needsSetup = warehouses.length === 0

  const visibleItems = items.filter(i => i.active)
  const stockRows = visibleItems
    .map(i => ({ item: i, qty: qtyOf(i.id, whFilter || undefined) }))
    .filter(r => {
      const q = search.trim().toLowerCase()
      if (q && ![r.item.name, r.item.sku, r.item.barcode, r.item.category].some(v => v?.toLowerCase().includes(q))) return false
      if (lowOnly && !(r.item.min_stock > 0 && r.qty < r.item.min_stock)) return false
      return true
    })
  const totalValue = visibleItems.reduce((t, i) => t + qtyOf(i.id, whFilter || undefined) * i.avg_cost, 0)
  const lowCount = visibleItems.filter(i => i.min_stock > 0 && qtyOf(i.id, whFilter || undefined) < i.min_stock).length
  const defaultWh = activeWarehouses.find(w => w.is_default)?.id ?? activeWarehouses[0]?.id ?? ''

  const kxRows = movements.filter(m => (!kxItem || m.item_id === kxItem) && (!kxWh || m.warehouse_id === kxWh))

  return (
    <div className="inv-root">
      {/* ══ INICIO: elegir almacén ══ */}
      {tab === 'home' && (
        <div className="inv-home">
          <div className="inv-home-title">
            <h2>{needsSetup ? 'Empieza creando tu primer almacén' : '¿Con qué almacén vas a trabajar?'}</h2>
            <p>{needsSetup
              ? 'Un almacén es donde guardas la mercancía: depósito, cocina, bodega, tienda. Puedes tener varios.'
              : 'Elige uno para ver sus existencias, cargar compras y hacer movimientos.'}</p>
          </div>
          <div className="inv-wh-grid">
            {activeWarehouses.map(w => {
              const rows = stock.filter(x => x.warehouse_id === w.id)
              const value = rows.reduce((t, x) => t + x.qty * (itemById.get(x.item_id)?.avg_cost ?? 0), 0)
              const count = rows.filter(x => x.qty !== 0).length
              const low = items.filter(i => i.active && i.min_stock > 0 && rows.some(x => x.item_id === i.id) && qtyOf(i.id, w.id) < i.min_stock).length
              return (
                <button key={w.id} className="inv-wh-card" onClick={() => openWarehouse(w.id)}>
                  <div className="inv-wh-card-top">
                    <span className="inv-wh-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" /><path d="M7 21v-8h10v8M7 17h10" /></svg>
                    </span>
                    {w.is_default && <span className="inv-tag link">Principal</span>}
                  </div>
                  <strong className="inv-wh-name">{w.name}</strong>
                  {w.description && <span className="inv-muted">{w.description}</span>}
                  <div className="inv-wh-stats">
                    <span><b>{money(value)}</b> en mercancía</span>
                    <span>{count} {count === 1 ? 'artículo' : 'artículos'}</span>
                    {low > 0 && <span className="inv-tag warn">{low} bajo mínimo</span>}
                  </div>
                  <span className="inv-wh-go">Entrar →</span>
                </button>
              )
            })}
            <button className="inv-wh-card inv-wh-new" onClick={() => setWhForm({ name: needsSetup ? 'Almacén principal' : '', description: '', is_default: needsSetup })}>
              <span className="inv-wh-plus">+</span>
              <strong>Nuevo almacén</strong>
            </button>
          </div>

          {warehouses.length > 0 && (
            <button className="inv-home-admin" onClick={() => openCatalog('warehouses')}>Administrar almacenes (editar, desactivar)</button>
          )}
        </div>
      )}

      {/* ══ DENTRO DE UN ALMACÉN ══ */}
      {whSel && tab !== 'home' && (
        <>
          <div className="inv-ws-head">
            <button className="inv-back" onClick={goHome}>‹ Almacenes</button>
            <div className="inv-ws-title">
              <small>Almacén</small>
              <h2>{whById.get(whSel)?.name}</h2>
            </div>
            {activeWarehouses.length > 1 && (
              <select className="inv-input inv-ws-switch" value={whSel} onChange={e => openWarehouse(e.target.value)} aria-label="Cambiar de almacén">
                {activeWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>
          <nav className="inv-tabs">
            {WAREHOUSE_TABS.map(([k, l], i) => (
              <button key={k} className={`inv-tab${tab === k ? ' active' : ''}${i === 3 ? ' sep' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </nav>
          {(tab === 'items' || tab === 'products' || tab === 'suppliers') && (
            <div className="inv-shared-note">Esto es común a todos tus almacenes.</div>
          )}
        </>
      )}

      {/* ══ CATÁLOGO ══ */}
      {!whSel && CATALOG_TITLE[tab] && (
        <div className="inv-ws-head">
          <button className="inv-back" onClick={goHome}>‹ Inventario</button>
          <div className="inv-ws-title"><small>Catálogo</small><h2>{CATALOG_TITLE[tab]}</h2></div>
        </div>
      )}

      {/* ══ EXISTENCIAS ══ */}
      {tab === 'stock' && whSel && (
        <>
          <div className="inv-cards">
            <div className="inv-card featured"><span>Valor del inventario</span><strong>{money(totalValue)}</strong></div>
            <div className="inv-card"><span>Artículos</span><strong>{visibleItems.length}</strong></div>
            <button className={`inv-card${lowOnly ? ' on' : ''}`} onClick={() => setLowOnly(v => !v)}>
              <span>Bajo mínimo</span><strong className={lowCount ? 'warn' : ''}>{lowCount}</strong>
            </button>
            <div className="inv-card"><span>Almacenes</span><strong>{activeWarehouses.length}</strong></div>
          </div>

          <div className="inv-toolbar">
            <input className="inv-input inv-search" placeholder="Buscar por nombre, código o categoría" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="inv-btn primary" disabled={visibleItems.length === 0}
              onClick={() => { setMvError(''); setMv({ itemId: visibleItems[0]?.id ?? '', whId: whFilter || defaultWh, kind: 'in', qty: '', cost: '', note: '' }) }}>
              + Movimiento
            </button>
          </div>

          {visibleItems.length === 0 ? (
            <div className="inv-empty">
              <strong>Todavía no tienes artículos</strong>
              <span>Crea los insumos o productos que quieres controlar.</span>
              <button className="inv-btn primary" onClick={() => { setTab('items'); setItemForm({ ...EMPTY_ITEM }) }}>Crear artículo</button>
            </div>
          ) : stockRows.length === 0 ? (
            <div className="inv-empty"><span>Ningún artículo coincide con el filtro.</span></div>
          ) : (
            <>
            <ListControls
              sorts={[
                { id: 'category', label: 'Por categoría' }, { id: 'name', label: 'Nombre A → Z' }, { id: 'name_desc', label: 'Nombre Z → A' },
                { id: 'low:asc', label: 'Bajo mínimo primero' }, { id: 'stock:asc', label: 'Menos stock' }, { id: 'stock:desc', label: 'Más stock' },
                { id: 'value:desc', label: 'Mayor valor' },
              ]}
              sort={stockPrefs.sort} onSort={stockPrefs.setSort} view={stockPrefs.view} onView={stockPrefs.setView}
            />
            {sortAndGroup(stockRows, stockPrefs.sort, {
              name: r => r.item.name, category: r => r.item.category,
              keys: {
                stock: r => r.qty, value: r => r.qty * r.item.avg_cost,
                low: r => (r.item.min_stock > 0 && r.qty < r.item.min_stock ? 0 : 1),
              },
            }).map(group => (
            <section key={group.title ?? 'all'}>
              {group.title && <div className="inv-group-title">{group.title} <span>{group.rows.length}</span></div>}
            <div className={`inv-list view-${stockPrefs.view}`}>
              {group.rows.map(({ item, qty }) => {
                const low = item.min_stock > 0 && qty < item.min_stock
                const perWh = !whFilter && activeWarehouses.length > 1
                  ? activeWarehouses.map(w => ({ w, q: qtyOf(item.id, w.id) })).filter(x => x.q !== 0)
                  : []
                return (
                  <div key={item.id} className={`inv-row${low ? ' low' : ''}`}>
                    <Thumb src={photoByItem[item.id]} name={item.name} />
                    <div className="inv-row-main">
                      <div className="inv-row-name">{item.name}{item.sku && <span className="inv-muted"> · {item.sku}</span>}</div>
                      <div className="inv-row-meta">
                        {item.category && stockPrefs.sort !== 'category' && <span className="inv-tag">{item.category}</span>}
                        {low && <span className="inv-tag warn">Bajo mínimo ({fmtQty(item.min_stock)} {item.unit})</span>}
                        {perWh.map(x => <span key={x.w.id} className="inv-muted">{x.w.name}: {fmtQty(x.q)}</span>)}
                      </div>
                    </div>
                    <div className="inv-row-qty">
                      <strong>{fmtQty(qty)}</strong> <span>{item.unit}</span>
                      <div className="inv-muted">{money(qty * item.avg_cost)}</div>
                    </div>
                    <button className="inv-btn small" onClick={() => { setMvError(''); setMv({ itemId: item.id, whId: whFilter || defaultWh, kind: qty === 0 && !movements.some(m => m.item_id === item.id) ? 'initial' : 'in', qty: '', cost: item.avg_cost ? String(item.avg_cost) : '', note: '' }) }}>
                      Mover
                    </button>
                  </div>
                )
              })}
            </div>
            </section>
            ))}
            </>
          )}
        </>
      )}

      {/* ══ COMPRAS ══ */}
      {tab === 'purchases' && whSel && storeId && (
        <Compras storeId={storeId} items={items} suppliers={suppliers} warehouses={warehouses} warehouseId={whSel} onChanged={() => load(storeId)} flash={flash} />
      )}

      {/* ══ PRODUCTOS DE LA TIENDA / RECETAS ══ */}
      {tab === 'products' && whSel && storeId && (
        <Productos storeId={storeId} items={items} warehouses={warehouses} onChanged={() => load(storeId)} flash={flash} />
      )}

      {/* ══ ARTÍCULOS ══ */}
      {tab === 'items' && whSel && (
        <>
          <div className="inv-toolbar">
            <div className="inv-toolbar-title">{items.filter(i => i.active).length} artículos activos</div>
            <button className="inv-btn primary" onClick={() => setItemForm({ ...EMPTY_ITEM })}>+ Nuevo artículo</button>
          </div>
          {items.length === 0 ? (
            <div className="inv-empty">
              <strong>Sin artículos</strong>
              <span>Un artículo es cualquier cosa que guardas y cuentas: insumos (harina, queso), empaques o productos para la venta.</span>
            </div>
          ) : (
            <>
            <ListControls
              sorts={[
                { id: 'category', label: 'Por categoría' }, { id: 'name', label: 'Nombre A → Z' }, { id: 'name_desc', label: 'Nombre Z → A' },
                { id: 'cost:asc', label: 'Costo menor' }, { id: 'cost:desc', label: 'Costo mayor' }, { id: 'active:asc', label: 'Activos primero' },
              ]}
              sort={itemPrefs.sort} onSort={itemPrefs.setSort} view={itemPrefs.view} onView={itemPrefs.setView}
            />
            {sortAndGroup(items, itemPrefs.sort, {
              name: it => it.name, category: it => it.category,
              keys: { cost: it => it.avg_cost, active: it => (it.active ? 0 : 1) },
            }).map(group => (
            <section key={group.title ?? 'all'}>
              {group.title && <div className="inv-group-title">{group.title} <span>{group.rows.length}</span></div>}
            <div className={`inv-list view-${itemPrefs.view}`}>
              {group.rows.map(it => (
                <div key={it.id} className={`inv-row${it.active ? '' : ' off'}`}>
                  <Thumb src={photoByItem[it.id]} name={it.name} />
                  <div className="inv-row-main">
                    <div className="inv-row-name">{it.name}{!it.active && <span className="inv-tag">Inactivo</span>}</div>
                    <div className="inv-row-meta">
                      <span className="inv-muted">Unidad: {it.unit}</span>
                      {it.purchase_unit && <span className="inv-muted">Compra: {it.purchase_unit} = {fmtQty(it.purchase_factor)} {it.unit}</span>}
                      {it.sku && <span className="inv-muted">SKU {it.sku}</span>}
                      {it.barcode && <span className="inv-muted">Cód. {it.barcode}</span>}
                      {it.category && itemPrefs.sort !== 'category' && <span className="inv-tag">{it.category}</span>}
                      {it.supplier_id && <span className="inv-muted">Prov.: {suppliers.find(s => s.id === it.supplier_id)?.name}</span>}
                    </div>
                  </div>
                  <div className="inv-row-qty">
                    <strong>{money(it.avg_cost)}</strong> <span>/{it.unit}</span>
                    <div className="inv-muted">costo promedio</div>
                  </div>
                  <div className="inv-row-actions">
                    <button className="inv-btn small" onClick={() => setItemForm({
                      id: it.id, name: it.name, sku: it.sku ?? '', barcode: it.barcode ?? '', category: it.category ?? '',
                      unit: it.unit, purchase_unit: it.purchase_unit ?? '', purchase_factor: String(it.purchase_factor),
                      min_stock: it.min_stock ? String(it.min_stock) : '', supplier_id: it.supplier_id ?? '', product_id: it.product_id ?? '', notes: it.notes ?? '',
                    })}>Editar</button>
                    <button className="inv-btn small ghost" onClick={() => toggleItemActive(it)}>{it.active ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </div>
              ))}
            </div>
            </section>
            ))}
            </>
          )}
        </>
      )}

      {/* ══ ALMACENES ══ */}
      {tab === 'warehouses' && !whSel && (
        <>
          <div className="inv-toolbar">
            <div className="inv-toolbar-title">{activeWarehouses.length} {activeWarehouses.length === 1 ? 'almacén activo' : 'almacenes activos'}</div>
            <button className="inv-btn primary" onClick={() => setWhForm({ name: '', description: '', is_default: warehouses.length === 0 })}>+ Nuevo almacén</button>
          </div>
          {warehouses.length === 0 && !whForm && (
            <div className="inv-empty"><span>Crea tu primer almacén: depósito, cocina, bodega, sucursal…</span></div>
          )}
          <div className="inv-list">
            {warehouses.map(w => {
              const value = stock.filter(s => s.warehouse_id === w.id).reduce((t, s) => t + s.qty * (itemById.get(s.item_id)?.avg_cost ?? 0), 0)
              const count = stock.filter(s => s.warehouse_id === w.id && s.qty !== 0).length
              return (
                <div key={w.id} className={`inv-row${w.active ? '' : ' off'}`}>
                  <div className="inv-row-main">
                    <div className="inv-row-name">
                      {w.name}
                      {w.is_default && <span className="inv-tag link">Principal</span>}
                      {!w.active && <span className="inv-tag">Inactivo</span>}
                    </div>
                    <div className="inv-row-meta">
                      {w.description && <span className="inv-muted">{w.description}</span>}
                      <span className="inv-muted">{count} {count === 1 ? 'artículo con stock' : 'artículos con stock'}</span>
                    </div>
                  </div>
                  <div className="inv-row-qty"><strong>{money(value)}</strong><div className="inv-muted">valor</div></div>
                  <div className="inv-row-actions">
                    <button className="inv-btn small" onClick={() => setWhForm({ id: w.id, name: w.name, description: w.description ?? '', is_default: w.is_default })}>Editar</button>
                    <button className="inv-btn small ghost" onClick={() => toggleWarehouseActive(w)}>{w.active ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ══ PROVEEDORES ══ */}
      {tab === 'suppliers' && whSel && (
        <>
          <div className="inv-toolbar">
            <input className="inv-input inv-search" placeholder="Buscar proveedor" value={supSearch} onChange={e => setSupSearch(e.target.value)} />
            <button className="inv-btn primary" onClick={() => setSupForm({ ...EMPTY_SUPPLIER })}>+ Nuevo proveedor</button>
          </div>
          {suppliers.length === 0 ? (
            <div className="inv-empty">
              <strong>Sin proveedores</strong>
              <span>Guarda a quién le compras, con su RIF y contacto. Los usarás al cargar compras.</span>
            </div>
          ) : (
            <div className="inv-list">
              {suppliers
                .filter(s => !supSearch.trim() || [s.name, s.tax_id, s.contact_name, s.phone].some(v => v?.toLowerCase().includes(supSearch.trim().toLowerCase())))
                .map(s => (
                  <div key={s.id} className={`inv-row${s.active ? '' : ' off'}`}>
                    <div className="inv-row-main">
                      <div className="inv-row-name">{s.name}{!s.active && <span className="inv-tag">Inactivo</span>}</div>
                      <div className="inv-row-meta">
                        {s.tax_id && <span className="inv-muted">RIF {s.tax_id}</span>}
                        {s.contact_name && <span className="inv-muted">{s.contact_name}</span>}
                        {s.phone && <a className="inv-link" href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{s.phone}</a>}
                        {s.email && <a className="inv-link" href={`mailto:${s.email}`}>{s.email}</a>}
                        <span className="inv-muted">{items.filter(i => i.supplier_id === s.id).length} artículos</span>
                      </div>
                    </div>
                    {(debtBySupplier[s.id] ?? 0) > 0 && (
                      <div className="inv-row-qty"><strong className="warn-text">{money(debtBySupplier[s.id])}</strong><div className="inv-muted">le debes</div></div>
                    )}
                    <div className="inv-row-actions">
                      <button className="inv-btn small" onClick={() => setSupForm({
                        id: s.id, name: s.name, tax_id: s.tax_id ?? '', contact_name: s.contact_name ?? '', phone: s.phone ?? '',
                        email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '',
                      })}>Editar</button>
                      <button className="inv-btn small ghost" onClick={() => toggleSupplierActive(s)}>{s.active ? 'Desactivar' : 'Activar'}</button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* ══ KARDEX ══ */}
      {tab === 'kardex' && whSel && (
        <>
          <div className="inv-toolbar">
            <select className="inv-input" value={kxItem} onChange={e => setKxItem(e.target.value)}>
              <option value="">Todos los artículos</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          {kxRows.length === 0 ? (
            <div className="inv-empty"><span>Todavía no hay movimientos{kxItem || kxWh ? ' con este filtro' : ''}.</span></div>
          ) : (
            <div className="inv-list">
              {kxRows.map(m => {
                const it = itemById.get(m.item_id)
                return (
                  <div key={m.id} className="inv-row">
                    <div className="inv-row-main">
                      <div className="inv-row-name">{it?.name ?? '—'} <span className="inv-tag">{MOVE_LABEL[m.type] ?? m.type}</span></div>
                      <div className="inv-row-meta">
                        <span className="inv-muted">{fmtDate(m.created_at)}</span>
                        <span className="inv-muted">{whById.get(m.warehouse_id)?.name}</span>
                        {m.unit_cost != null && <span className="inv-muted">{money(m.unit_cost)}/{it?.unit}</span>}
                        {m.note && <span className="inv-muted">“{m.note}”</span>}
                      </div>
                    </div>
                    <div className="inv-row-qty">
                      <strong className={m.qty > 0 ? 'pos' : 'neg'}>{m.qty > 0 ? '+' : ''}{fmtQty(m.qty)}</strong> <span>{it?.unit}</span>
                      <div className="inv-muted">queda {fmtQty(m.balance)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══ MODAL: movimiento ══ */}
      {mv && (() => {
        const it = itemById.get(mv.itemId)
        const current = mv.itemId && mv.whId ? qtyOf(mv.itemId, mv.whId) : 0
        return (
          <div className="inv-overlay" onClick={() => setMv(null)}>
            <div className="inv-modal" onClick={e => e.stopPropagation()}>
              <div className="inv-modal-head">
                <strong>Movimiento de inventario</strong>
                <button className="inv-x" onClick={() => setMv(null)} aria-label="Cerrar">✕</button>
              </div>
              <div className="inv-seg">
                {([['initial', 'Stock inicial'], ['in', 'Entrada'], ['out', 'Salida'], ['count', 'Conteo']] as const).map(([k, l]) => (
                  <button key={k} className={mv.kind === k ? 'on' : ''} onClick={() => setMv({ ...mv, kind: k })}>{l}</button>
                ))}
              </div>
              <label className="inv-field"><span>Artículo</span>
                <select className="inv-input" value={mv.itemId} onChange={e => { const n = itemById.get(e.target.value); setMv({ ...mv, itemId: e.target.value, cost: n?.avg_cost ? String(n.avg_cost) : '' }) }}>
                  {visibleItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </label>
              <label className="inv-field"><span>Almacén</span>
                <select className="inv-input" value={mv.whId} onChange={e => setMv({ ...mv, whId: e.target.value })}>
                  {activeWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <div className="inv-hint">Hay <strong>{fmtQty(current)} {it?.unit}</strong> en este almacén.</div>
              <div className="inv-two">
                <label className="inv-field"><span>{mv.kind === 'count' ? 'Cantidad contada' : 'Cantidad'} ({it?.unit})</span>
                  <input className="inv-input" inputMode="decimal" value={mv.qty} onChange={e => setMv({ ...mv, qty: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="0" autoFocus />
                </label>
                {(mv.kind === 'initial' || mv.kind === 'in') && (
                  <label className="inv-field"><span>Costo por {it?.unit} ($)</span>
                    <input className="inv-input" inputMode="decimal" value={mv.cost} onChange={e => setMv({ ...mv, cost: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="0,00" />
                  </label>
                )}
              </div>
              {mv.kind === 'count' && Number.isFinite(parseNum(mv.qty)) && (
                <div className="inv-hint">Diferencia: <strong>{parseNum(mv.qty) - current > 0 ? '+' : ''}{fmtQty(parseNum(mv.qty) - current)} {it?.unit}</strong></div>
              )}
              <label className="inv-field"><span>Nota (opcional)</span>
                <input className="inv-input" value={mv.note} onChange={e => setMv({ ...mv, note: e.target.value })} placeholder={mv.kind === 'out' ? 'Ej: uso interno, muestra' : 'Ej: inventario de apertura'} />
              </label>
              {mvError && <div className="inv-error">{mvError}</div>}
              <div className="inv-modal-actions">
                <button className="inv-btn ghost" onClick={() => setMv(null)}>Cancelar</button>
                <button className="inv-btn primary" onClick={saveMovement} disabled={mvSaving}>{mvSaving ? 'Guardando…' : 'Registrar'}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══ MODAL: artículo ══ */}
      {itemForm && (
        <div className="inv-overlay" onClick={() => setItemForm(null)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-head">
              <strong>{itemForm.id ? 'Editar artículo' : 'Nuevo artículo'}</strong>
              <button className="inv-x" onClick={() => setItemForm(null)} aria-label="Cerrar">✕</button>
            </div>
            <label className="inv-field"><span>Nombre *</span>
              <input className="inv-input" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Ej: Harina de trigo, Caja de pizza, Camisa M" autoFocus />
            </label>
            <div className="inv-two">
              <label className="inv-field"><span>Categoría</span>
                <input className="inv-input" list="inv-cats" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} placeholder="Ej: Lácteos, Empaques" />
                <datalist id="inv-cats">{[...new Set(items.map(i => i.category).filter(Boolean))].map(c => <option key={c!} value={c!} />)}</datalist>
              </label>
              <label className="inv-field"><span>Unidad de control</span>
                <select className="inv-input" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </label>
            </div>
            <div className="inv-two">
              <label className="inv-field"><span>Se compra por (opcional)</span>
                <input className="inv-input" value={itemForm.purchase_unit} onChange={e => setItemForm({ ...itemForm, purchase_unit: e.target.value })} placeholder="Ej: caja, saco, bulto" />
              </label>
              <label className="inv-field"><span>…que trae ({itemForm.unit})</span>
                <input className="inv-input" inputMode="decimal" value={itemForm.purchase_factor} onChange={e => setItemForm({ ...itemForm, purchase_factor: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="1" disabled={!itemForm.purchase_unit.trim()} />
              </label>
            </div>
            <div className="inv-two">
              <label className="inv-field"><span>Stock mínimo ({itemForm.unit})</span>
                <input className="inv-input" inputMode="decimal" value={itemForm.min_stock} onChange={e => setItemForm({ ...itemForm, min_stock: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="0" />
              </label>
              <label className="inv-field"><span>Proveedor habitual</span>
                <select className="inv-input" value={itemForm.supplier_id} onChange={e => setItemForm({ ...itemForm, supplier_id: e.target.value })}>
                  <option value="">—</option>
                  {suppliers.filter(s => s.active || s.id === itemForm.supplier_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <div className="inv-two">
              <label className="inv-field"><span>SKU / código interno</span>
                <input className="inv-input" value={itemForm.sku} onChange={e => setItemForm({ ...itemForm, sku: e.target.value })} />
              </label>
              <label className="inv-field"><span>Código de barras</span>
                <input className="inv-input" inputMode="numeric" value={itemForm.barcode} onChange={e => setItemForm({ ...itemForm, barcode: e.target.value })} />
              </label>
            </div>
            <label className="inv-field"><span>Notas</span>
              <input className="inv-input" value={itemForm.notes} onChange={e => setItemForm({ ...itemForm, notes: e.target.value })} />
            </label>
            <div className="inv-modal-actions">
              <button className="inv-btn ghost" onClick={() => setItemForm(null)}>Cancelar</button>
              <button className="inv-btn primary" onClick={saveItem} disabled={itemSaving || !itemForm.name.trim()}>{itemSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: almacén ══ */}
      {whForm && (
        <div className="inv-overlay" onClick={() => setWhForm(null)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-head">
              <strong>{whForm.id ? 'Editar almacén' : 'Nuevo almacén'}</strong>
              <button className="inv-x" onClick={() => setWhForm(null)} aria-label="Cerrar">✕</button>
            </div>
            <label className="inv-field"><span>Nombre *</span>
              <input className="inv-input" value={whForm.name} onChange={e => setWhForm({ ...whForm, name: e.target.value })} placeholder="Ej: Depósito, Cocina, Bodega, Sucursal Centro" autoFocus />
            </label>
            <label className="inv-field"><span>Descripción</span>
              <input className="inv-input" value={whForm.description} onChange={e => setWhForm({ ...whForm, description: e.target.value })} placeholder="Ej: Cuarto frío del local" />
            </label>
            <label className="inv-check">
              <input type="checkbox" checked={whForm.is_default} onChange={e => setWhForm({ ...whForm, is_default: e.target.checked })} />
              Almacén principal (se elige por defecto en los movimientos)
            </label>
            <div className="inv-modal-actions">
              <button className="inv-btn ghost" onClick={() => setWhForm(null)}>Cancelar</button>
              <button className="inv-btn primary" onClick={saveWarehouse} disabled={!whForm.name.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: proveedor ══ */}
      {supForm && (
        <div className="inv-overlay" onClick={() => setSupForm(null)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-head">
              <strong>{supForm.id ? 'Editar proveedor' : 'Nuevo proveedor'}</strong>
              <button className="inv-x" onClick={() => setSupForm(null)} aria-label="Cerrar">✕</button>
            </div>
            <label className="inv-field"><span>Nombre o razón social *</span>
              <input className="inv-input" value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })} autoFocus />
            </label>
            <div className="inv-two">
              <label className="inv-field"><span>RIF</span>
                <input className="inv-input" value={supForm.tax_id} onChange={e => setSupForm({ ...supForm, tax_id: e.target.value })} placeholder="J-12345678-9" />
              </label>
              <label className="inv-field"><span>Persona de contacto</span>
                <input className="inv-input" value={supForm.contact_name} onChange={e => setSupForm({ ...supForm, contact_name: e.target.value })} />
              </label>
            </div>
            <div className="inv-two">
              <label className="inv-field"><span>Teléfono / WhatsApp</span>
                <input className="inv-input" inputMode="tel" value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: e.target.value })} />
              </label>
              <label className="inv-field"><span>Correo</span>
                <input className="inv-input" inputMode="email" value={supForm.email} onChange={e => setSupForm({ ...supForm, email: e.target.value })} />
              </label>
            </div>
            <label className="inv-field"><span>Dirección</span>
              <input className="inv-input" value={supForm.address} onChange={e => setSupForm({ ...supForm, address: e.target.value })} />
            </label>
            <label className="inv-field"><span>Notas</span>
              <input className="inv-input" value={supForm.notes} onChange={e => setSupForm({ ...supForm, notes: e.target.value })} placeholder="Ej: entrega martes y viernes, crédito 15 días" />
            </label>
            <div className="inv-modal-actions">
              <button className="inv-btn ghost" onClick={() => setSupForm(null)}>Cancelar</button>
              <button className="inv-btn primary" onClick={saveSupplier} disabled={!supForm.name.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="inv-toast">{toast}</div>}
    </div>
  )
}
