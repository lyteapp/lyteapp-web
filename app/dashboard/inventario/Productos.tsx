'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ItemPicker from './ItemPicker'
import ListControls, { Thumb, sortAndGroup, useListPrefs } from './ListControls'

// The store's products in Inventario: each one is not tracked, sold as one
// inventory item ("tal cual"), or made from a recipe / formula. Selling it
// in the store discounts that stock (see the inventory_recipes_and_sales
// migration: inv_sync_order runs on order status changes).

type Item = { id: string; name: string; unit: string; avg_cost: number; active: boolean; sku?: string | null; barcode?: string | null; category?: string | null }
type Warehouse = { id: string; name: string; is_default: boolean; active: boolean }
type Product = { id: string; name: string; price: number; image_url: string | null; is_active: boolean; category_id: string | null }
type Link = { product_id: string; mode: 'item' | 'recipe'; item_id: string | null }
type RecipeLine = { product_id: string; item_id: string; qty: number; position: number }
type Settings = { sales_warehouse_id: string | null; deduct_on: 'pending' | 'confirmed' | 'delivered' }

const money = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const parseNum = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const DEDUCT_LABEL = { pending: 'Cuando entra el pedido', confirmed: 'Cuando confirmas el pedido', delivered: 'Cuando se entrega' }

export default function Productos({ storeId, items, warehouses, onChanged, flash }: {
  storeId: string
  items: Item[]
  warehouses: Warehouse[]
  onChanged: () => void
  flash: (m: string) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [lines, setLines] = useState<RecipeLine[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [extraItems, setExtraItems] = useState<Item[]>([])
  // The store's own categories (a product can be in several; the first one groups it)
  const [catName, setCatName] = useState<Record<string, string>>({})
  const [catOfProduct, setCatOfProduct] = useState<Record<string, string>>({})
  const prefs = useListPrefs('products', 'category')

  const load = useCallback(async () => {
    const [p, l, r, s] = await Promise.all([
      supabase.from('products').select('id, name, price, image_url, is_active, category_id').eq('store_id', storeId).order('name'),
      supabase.from('inv_product_links').select('product_id, mode, item_id').eq('store_id', storeId),
      supabase.from('inv_recipe_lines').select('product_id, item_id, qty, position').eq('store_id', storeId).order('position'),
      supabase.from('inv_settings').select('sales_warehouse_id, deduct_on').eq('store_id', storeId).maybeSingle(),
    ])
    setProducts(((p.data ?? []) as Product[]).map(x => ({ ...x, price: Number(x.price) || 0 })))
    setLinks((l.data ?? []) as Link[])
    setLines(((r.data ?? []) as RecipeLine[]).map(x => ({ ...x, qty: Number(x.qty) })))
    setSettings((s.data as Settings | null) ?? null)
    const prods = (p.data ?? []) as Product[]
    const [{ data: cats }, { data: pcs }] = await Promise.all([
      supabase.from('categories').select('id, name, position').eq('store_id', storeId).order('position'),
      prods.length ? supabase.from('product_categories').select('product_id, category_id').in('product_id', prods.map(x => x.id)) : Promise.resolve({ data: [] }),
    ])
    const names: Record<string, string> = {}
    for (const c of (cats ?? []) as { id: string; name: string }[]) names[c.id] = c.name
    const byProduct: Record<string, string> = {}
    for (const r of (pcs ?? []) as { product_id: string; category_id: string }[]) byProduct[r.product_id] ??= r.category_id
    for (const x of prods) if (!byProduct[x.id] && x.category_id) byProduct[x.id] = x.category_id
    setCatName(names)
    setCatOfProduct(byProduct)
    setLoaded(true)
  }, [storeId])
  useEffect(() => { Promise.resolve().then(load) }, [load])

  const allItems = [...items, ...extraItems.filter(e => !items.some(i => i.id === e.id))]
  const itemById = new Map(allItems.map(i => [i.id, i]))
  const activeItems = allItems.filter(i => i.active)
  const activeWh = warehouses.filter(w => w.active)
  const linkOf = (pid: string) => links.find(l => l.product_id === pid)
  const recipeOf = (pid: string) => lines.filter(l => l.product_id === pid)
  const costOf = (pid: string) => {
    const link = linkOf(pid)
    if (!link) return null
    if (link.mode === 'item') return link.item_id ? itemById.get(link.item_id)?.avg_cost ?? 0 : null
    return recipeOf(pid).reduce((t, l) => t + l.qty * (itemById.get(l.item_id)?.avg_cost ?? 0), 0)
  }

  // ── sales settings ──
  async function saveSettings(next: Settings | null) {
    if (next) {
      const { error } = await supabase.from('inv_settings').upsert({ store_id: storeId, ...next, updated_at: new Date().toISOString() })
      if (error) return flash(error.message)
    } else {
      await supabase.from('inv_settings').delete().eq('store_id', storeId)
    }
    setSettings(next)
    flash(next ? 'Las ventas descontarán inventario' : 'Las ventas ya no descuentan inventario')
  }

  // ── bulk: create products as items sold "tal cual" ──
  async function bulkAsItems() {
    const targets = products.filter(p => picked.has(p.id) && !linkOf(p.id))
    if (!targets.length) return
    setBulkBusy(true)
    const { data: created, error } = await supabase.from('inv_items')
      .insert(targets.map(p => ({ store_id: storeId, name: p.name, unit: 'und' })))
      .select('id, name, unit, avg_cost, active, sku, barcode, category')
    if (error || !created) { setBulkBusy(false); return flash(error?.message ?? 'No se pudieron crear') }
    // inserts come back in the same order
    const newLinks = targets.map((p, i) => ({ product_id: p.id, store_id: storeId, mode: 'item' as const, item_id: created[i]?.id ?? null }))
    const { error: lErr } = await supabase.from('inv_product_links').upsert(newLinks)
    setBulkBusy(false)
    if (lErr) return flash(lErr.message)
    setPicked(new Set())
    setExtraItems(prev => [...prev, ...(created as Item[]).map(x => ({ ...x, avg_cost: Number(x.avg_cost) || 0 }))])
    flash(`${targets.length} ${targets.length === 1 ? 'producto agregado' : 'productos agregados'} al inventario`)
    load(); onChanged()
  }

  // ── editor ──
  type EditLine = { itemId: string; qty: string }
  const [edit, setEdit] = useState<null | { product: Product; mode: 'none' | 'item' | 'recipe'; itemId: string; lines: EditLine[] }>(null)
  const [saving, setSaving] = useState(false)
  function openEdit(p: Product) {
    const link = linkOf(p.id)
    const rec = recipeOf(p.id)
    setEdit({
      product: p,
      mode: link?.mode ?? 'none',
      itemId: link?.mode === 'item' ? link.item_id ?? '' : '',
      lines: rec.length ? rec.map(l => ({ itemId: l.item_id, qty: String(l.qty) })) : [{ itemId: '', qty: '' }],
    })
  }
  async function createItemForProduct() {
    if (!edit) return
    const { data, error } = await supabase.from('inv_items').insert({ store_id: storeId, name: edit.product.name, unit: 'und' })
      .select('id, name, unit, avg_cost, active, sku, barcode, category').single()
    if (error || !data) return flash(error?.message ?? 'No se pudo crear')
    setExtraItems(prev => [...prev, { ...(data as Item), avg_cost: 0 }])
    setEdit(e => e ? { ...e, itemId: data.id } : e)
    onChanged()
  }
  async function saveEdit() {
    if (!edit) return
    const pid = edit.product.id
    const recipe = edit.lines.filter(l => l.itemId && parseNum(l.qty) > 0)
    if (edit.mode === 'item' && !edit.itemId) return flash('Elige el artículo que se descuenta')
    if (edit.mode === 'recipe' && recipe.length === 0) return flash('Agrega al menos un ingrediente con su cantidad')
    setSaving(true)
    await supabase.from('inv_recipe_lines').delete().eq('product_id', pid)
    let error = null
    if (edit.mode === 'none') {
      ({ error } = await supabase.from('inv_product_links').delete().eq('product_id', pid))
    } else {
      ({ error } = await supabase.from('inv_product_links').upsert({
        product_id: pid, store_id: storeId, mode: edit.mode,
        item_id: edit.mode === 'item' ? edit.itemId : null, updated_at: new Date().toISOString(),
      }))
      if (!error && edit.mode === 'recipe') {
        ({ error } = await supabase.from('inv_recipe_lines').insert(recipe.map((l, i) => ({
          store_id: storeId, product_id: pid, item_id: l.itemId, qty: parseNum(l.qty), position: i,
        }))))
      }
    }
    setSaving(false)
    if (error) return flash(error.message)
    setEdit(null)
    flash('Guardado')
    load()
  }

  if (!loaded) return null

  const q = fold(search.trim())
  const shown = products.filter(p => !q || fold(p.name).includes(q))
  const untracked = shown.filter(p => !linkOf(p.id))
  const linkedCount = links.length

  return (
    <>
      {/* sales → stock settings */}
      <div className={`inv-sales${settings ? ' on' : ''}`}>
        <label className="inv-check">
          <input type="checkbox" checked={!!settings} disabled={activeWh.length === 0}
            onChange={e => saveSettings(e.target.checked ? { sales_warehouse_id: activeWh.find(w => w.is_default)?.id ?? activeWh[0]?.id ?? null, deduct_on: 'confirmed' } : null)} />
          <span><strong>Descontar inventario con las ventas de la tienda</strong>
            <small>Cada producto vendido descuenta su artículo o los ingredientes de su receta. Si el pedido se cancela, vuelve al inventario.</small></span>
        </label>
        {settings && (
          <div className="inv-two">
            <label className="inv-field"><span>Sale del almacén</span>
              <select className="inv-input" value={settings.sales_warehouse_id ?? ''} onChange={e => saveSettings({ ...settings, sales_warehouse_id: e.target.value || null })}>
                {activeWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="inv-field"><span>Momento del descuento</span>
              <select className="inv-input" value={settings.deduct_on} onChange={e => saveSettings({ ...settings, deduct_on: e.target.value as Settings['deduct_on'] })}>
                {(Object.keys(DEDUCT_LABEL) as Settings['deduct_on'][]).map(k => <option key={k} value={k}>{DEDUCT_LABEL[k]}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="inv-toolbar">
        <input className="inv-input inv-search" placeholder="Buscar producto de la tienda" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="inv-toolbar-title" style={{ flex: 'none' }}>{linkedCount} de {products.length} en inventario</div>
      </div>

      {untracked.length > 0 && (
        <div className="inv-bulk">
          <label className="inv-check">
            <input type="checkbox" checked={untracked.every(p => picked.has(p.id))}
              onChange={e => setPicked(e.target.checked ? new Set(untracked.map(p => p.id)) : new Set())} />
            Seleccionar los {untracked.length} que no están en inventario
          </label>
          <button className="inv-btn primary small" disabled={bulkBusy || ![...picked].some(id => !linkOf(id))} onClick={bulkAsItems}>
            {bulkBusy ? 'Agregando…' : `Agregar como artículos (${[...picked].filter(id => !linkOf(id)).length})`}
          </button>
        </div>
      )}

      {products.length > 0 && (
        <ListControls
          sorts={[
            { id: 'category', label: 'Por categoría' }, { id: 'name', label: 'Nombre A → Z' }, { id: 'name_desc', label: 'Nombre Z → A' },
            { id: 'price:asc', label: 'Precio menor' }, { id: 'price:desc', label: 'Precio mayor' },
            { id: 'margin:asc', label: 'Menor margen' }, { id: 'margin:desc', label: 'Mayor margen' },
            { id: 'status:asc', label: 'Configurados primero' }, { id: 'status:desc', label: 'Sin configurar primero' },
          ]}
          sort={prefs.sort} onSort={prefs.setSort} view={prefs.view} onView={prefs.setView}
        />
      )}

      {products.length === 0 ? (
        <div className="inv-empty"><span>Tu tienda todavía no tiene productos.</span></div>
      ) : sortAndGroup(shown, prefs.sort, {
        name: p => p.name,
        category: p => catName[catOfProduct[p.id] ?? ''],
        keys: {
          price: p => p.price,
          margin: p => { const c = costOf(p.id); return c != null && p.price > 0 ? (p.price - c) / p.price : prefs.sort === 'margin:asc' ? 9 : -9 },
          status: p => (linkOf(p.id) ? 0 : 1),
        },
      }).map(group => (
        <section key={group.title ?? 'all'}>
          {group.title && <div className="inv-group-title">{group.title} <span>{group.rows.length}</span></div>}
        <div className={`inv-list view-${prefs.view}`}>
          {group.rows.map(p => {
            const link = linkOf(p.id)
            const cost = costOf(p.id)
            const margin = cost != null && p.price > 0 ? ((p.price - cost) / p.price) * 100 : null
            return (
              <div key={p.id} className="inv-row">
                {!link && (
                  <input type="checkbox" className="inv-row-check" checked={picked.has(p.id)}
                    onChange={e => setPicked(prev => { const n = new Set(prev); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n })} />
                )}
                <Thumb src={p.image_url} name={p.name} />
                <div className="inv-row-main">
                  <div className="inv-row-name">
                    {p.name}
                    {!link && <span className="inv-tag">No se controla</span>}
                    {link?.mode === 'item' && <span className="inv-tag link">Tal cual: {itemById.get(link.item_id ?? '')?.name ?? '—'}</span>}
                    {link?.mode === 'recipe' && <span className="inv-tag ok">Receta · {recipeOf(p.id).length} ingredientes</span>}
                  </div>
                  {link?.mode === 'recipe' && (
                    <div className="inv-row-meta">
                      {recipeOf(p.id).slice(0, 4).map(l => {
                        const it = itemById.get(l.item_id)
                        return <span key={l.item_id} className="inv-muted">{it?.name} {l.qty} {it?.unit}</span>
                      })}
                      {recipeOf(p.id).length > 4 && <span className="inv-muted">…</span>}
                    </div>
                  )}
                </div>
                <div className="inv-row-qty">
                  <strong>{money(p.price)}</strong>
                  {cost != null && <div className="inv-muted">costo {money(cost)}{margin != null && <> · <span className={margin < 30 ? 'warn-text' : ''}>{Math.round(margin)}%</span></>}</div>}
                </div>
                <button className="inv-btn small" onClick={() => openEdit(p)}>{link ? 'Editar' : 'Configurar'}</button>
              </div>
            )
          })}
        </div>
        </section>
      ))}

      {/* ══ EDITOR ══ */}
      {edit && (() => {
        const recipeCost = edit.lines.reduce((t, l) => t + (parseNum(l.qty) > 0 ? parseNum(l.qty) * (itemById.get(l.itemId)?.avg_cost ?? 0) : 0), 0)
        const itemCost = edit.itemId ? itemById.get(edit.itemId)?.avg_cost ?? 0 : 0
        const cost = edit.mode === 'recipe' ? recipeCost : edit.mode === 'item' ? itemCost : 0
        const margin = edit.product.price > 0 ? ((edit.product.price - cost) / edit.product.price) * 100 : 0
        return (
          <div className="inv-overlay" onClick={() => setEdit(null)}>
            <div className="inv-modal inv-modal-wide" onClick={e => e.stopPropagation()}>
              <div className="inv-modal-head">
                <strong>{edit.product.name}</strong>
                <button className="inv-x" onClick={() => setEdit(null)} aria-label="Cerrar">✕</button>
              </div>
              <div className="inv-seg inv-seg-3">
                <button className={edit.mode === 'none' ? 'on' : ''} onClick={() => setEdit({ ...edit, mode: 'none' })}>No se controla</button>
                <button className={edit.mode === 'item' ? 'on' : ''} onClick={() => setEdit({ ...edit, mode: 'item' })}>Se vende tal cual</button>
                <button className={edit.mode === 'recipe' ? 'on' : ''} onClick={() => setEdit({ ...edit, mode: 'recipe' })}>Receta / fórmula</button>
              </div>

              {edit.mode === 'none' && <div className="inv-hint">Vender este producto no toca el inventario.</div>}

              {edit.mode === 'item' && (
                <>
                  <div className="inv-hint">Cada unidad vendida descuenta 1 del artículo que elijas (ej.: un refresco, una camisa).</div>
                  <label className="inv-field"><span>Artículo</span>
                    <ItemPicker items={activeItems} value={edit.itemId} onPick={i => setEdit({ ...edit, itemId: i.id })} />
                  </label>
                  {!edit.itemId && (
                    <button className="inv-btn small" onClick={createItemForProduct}>Crear el artículo “{edit.product.name}”</button>
                  )}
                </>
              )}

              {edit.mode === 'recipe' && (
                <>
                  <div className="inv-hint">Lo que lleva <strong>una unidad</strong> de este producto. Al venderlo se descuenta cada ingrediente.</div>
                  <div className="inv-lines">
                    <div className="inv-lines-head inv-recipe-cols"><span>Ingrediente</span><span>Cantidad</span><span>Costo</span><span /></div>
                    {edit.lines.map((l, i) => {
                      const it = itemById.get(l.itemId)
                      const set = (patch: Partial<EditLine>) => setEdit({ ...edit, lines: edit.lines.map((x, j) => j === i ? { ...x, ...patch } : x) })
                      const lineCost = it && parseNum(l.qty) > 0 ? parseNum(l.qty) * it.avg_cost : 0
                      return (
                        <div key={i} className="inv-line inv-recipe-cols">
                          <ItemPicker items={activeItems} value={l.itemId} onPick={n => set({ itemId: n.id })} />
                          <div className="inv-line-qty">
                            <input className="inv-input" inputMode="decimal" placeholder="0" value={l.qty} onChange={e => set({ qty: e.target.value.replace(/[^0-9.,]/g, '') })} />
                            <span className="inv-muted">{it?.unit ?? ''}</span>
                          </div>
                          <span className="inv-muted">{lineCost ? money(lineCost) : '—'}</span>
                          <button className="inv-x" onClick={() => setEdit({ ...edit, lines: edit.lines.length > 1 ? edit.lines.filter((_, j) => j !== i) : [{ itemId: '', qty: '' }] })} aria-label="Quitar">✕</button>
                        </div>
                      )
                    })}
                    <button className="inv-btn small" onClick={() => setEdit({ ...edit, lines: [...edit.lines, { itemId: '', qty: '' }] })}>+ Agregar ingrediente</button>
                  </div>
                </>
              )}

              {edit.mode !== 'none' && (
                <div className="inv-total">
                  <span>Costo {money(cost)} · Precio {money(edit.product.price)}</span>
                  <strong className={margin < 30 ? 'warn-text' : 'pos'}>Margen {Math.round(margin)}%</strong>
                </div>
              )}

              <div className="inv-modal-actions">
                <button className="inv-btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
                <button className="inv-btn primary" onClick={saveEdit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
