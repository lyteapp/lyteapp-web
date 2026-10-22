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

const money = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const parseNum = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

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
    const [p, l, r] = await Promise.all([
      supabase.from('products').select('id, name, price, image_url, is_active, category_id').eq('store_id', storeId).order('name'),
      supabase.from('inv_product_links').select('product_id, mode, item_id').eq('store_id', storeId),
      supabase.from('inv_recipe_lines').select('product_id, item_id, qty, position').eq('store_id', storeId).order('position'),
    ])
    setProducts(((p.data ?? []) as Product[]).map(x => ({ ...x, price: Number(x.price) || 0 })))
    setLinks((l.data ?? []) as Link[])
    setLines(((r.data ?? []) as RecipeLine[]).map(x => ({ ...x, qty: Number(x.qty) })))
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
  const mainWh = activeWh.find(w => w.is_default) ?? activeWh[0]
  const linkOf = (pid: string) => links.find(l => l.product_id === pid)
  const recipeOf = (pid: string) => lines.filter(l => l.product_id === pid)
  const costOf = (pid: string) => {
    const link = linkOf(pid)
    if (!link) return null
    if (link.mode === 'item') return link.item_id ? itemById.get(link.item_id)?.avg_cost ?? 0 : null
    return recipeOf(pid).reduce((t, l) => t + l.qty * (itemById.get(l.item_id)?.avg_cost ?? 0), 0)
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
  // 'Crear receta': pick the product, then its recipe editor opens
  const [newRecipe, setNewRecipe] = useState(false)
  function openEdit(p: Product, forceRecipe = false) {
    const link = linkOf(p.id)
    const rec = recipeOf(p.id)
    setEdit({
      product: p,
      mode: forceRecipe ? 'recipe' : link?.mode ?? 'none',
      itemId: link?.mode === 'item' ? link.item_id ?? '' : '',
      lines: rec.length ? rec.map(l => ({ itemId: l.item_id, qty: String(l.qty) })) : [{ itemId: '', qty: '' }],
    })
  }
  // Create an ingredient / item without leaving the recipe
  const UNITS = ['und', 'kg', 'g', 'l', 'ml', 'lb', 'oz', 'm', 'par']
  const [newIng, setNewIng] = useState<null | { target: number | 'item'; name: string; unit: string; cost: string; category: string }>(null)
  const [ingSaving, setIngSaving] = useState(false)
  async function saveNewIngredient() {
    if (!newIng?.name.trim()) return
    setIngSaving(true)
    const cost = parseNum(newIng.cost)
    const { data, error } = await supabase.from('inv_items').insert({
      store_id: storeId, name: newIng.name.trim(), unit: newIng.unit,
      category: newIng.category.replace('\u0000', '').trim() || null, avg_cost: cost > 0 ? cost : 0,
    }).select('id, name, unit, avg_cost, active, sku, barcode, category').single()
    setIngSaving(false)
    if (error || !data) return flash(error?.message ?? 'No se pudo crear')
    const it = { ...(data as Item), avg_cost: Number(data.avg_cost) || 0 }
    setExtraItems(prev => [...prev, it])
    const target = newIng.target
    setEdit(e => !e ? e : target === 'item'
      ? { ...e, itemId: it.id }
      : { ...e, lines: e.lines.map((l, j) => j === target ? { ...l, itemId: it.id } : l) })
    setNewIng(null)
    flash(`"${it.name}" creado`)
    onChanged()
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
      {/* sales always discount the main warehouse (see inv_sync_order) */}
      <div className="inv-shared-note" style={{ marginTop: 0 }}>
        Cada venta de la tienda descuenta su artículo o los ingredientes de su receta del almacén principal
        {mainWh ? <> (<strong>{mainWh.name}</strong>)</> : ''} en cuanto entra el pedido. Si el pedido se cancela, vuelve al inventario.
      </div>

      <div className="inv-toolbar">
        <input className="inv-input inv-search" placeholder="Buscar producto de la tienda" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="inv-toolbar-title" style={{ flex: 'none' }}>{linkedCount} de {products.length} en inventario</div>
        <button className="inv-btn primary" onClick={() => setNewRecipe(true)} disabled={products.length === 0}>+ Crear receta</button>
      </div>

      {newRecipe && (
        <div className="inv-overlay" onClick={() => setNewRecipe(false)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-head">
              <strong>Crear receta</strong>
              <button className="inv-x" onClick={() => setNewRecipe(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="inv-hint">¿Para qué producto de tu tienda es la receta? Después agregas sus ingredientes.</div>
            <label className="inv-field"><span>Producto</span>
              <ItemPicker
                items={[...products]
                  .sort((a, b) => Number(linkOf(a.id)?.mode === 'recipe') - Number(linkOf(b.id)?.mode === 'recipe') || a.name.localeCompare(b.name, 'es'))
                  .map(p => ({
                    id: p.id, name: p.name, unit: money(p.price),
                    category: [catName[catOfProduct[p.id] ?? ''], linkOf(p.id)?.mode === 'recipe' ? 'ya tiene receta' : null].filter(Boolean).join(' · ') || null,
                  }))}
                value=""
                placeholder="Escribe el nombre del producto…"
                onPick={x => { const p = products.find(pp => pp.id === x.id); setNewRecipe(false); if (p) openEdit(p, true) }}
              />
            </label>
          </div>
        </div>
      )}

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
                    <ItemPicker items={activeItems} value={edit.itemId} onPick={i => setEdit({ ...edit, itemId: i.id })}
                      onCreate={name => setNewIng({ target: 'item', name: name || edit.product.name, unit: 'und', cost: '', category: '' })} />
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
                          <ItemPicker items={activeItems} value={l.itemId} onPick={n => set({ itemId: n.id })}
                            onCreate={name => setNewIng({ target: i, name, unit: 'kg', cost: '', category: '' })} />
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

              {newIng && (
                <div className="inv-subform">
                  <div className="inv-subform-title">{newIng.target === 'item' ? 'Nuevo artículo' : 'Nuevo ingrediente'}</div>
                  <input className="inv-input" placeholder="Nombre *" value={newIng.name} onChange={e => setNewIng({ ...newIng, name: e.target.value })} autoFocus />
                  <div className="inv-two">
                    <label className="inv-field"><span>Unidad</span>
                      <select className="inv-input" value={newIng.unit} onChange={e => setNewIng({ ...newIng, unit: e.target.value })}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </label>
                    <label className="inv-field"><span>Costo por {newIng.unit} ($, aprox.)</span>
                      <input className="inv-input" inputMode="decimal" placeholder="0,00" value={newIng.cost} onChange={e => setNewIng({ ...newIng, cost: e.target.value.replace(/[^0-9.,]/g, '') })} />
                    </label>
                  </div>
                  {(() => {
                    // Inventory categories already in use; '+ Nueva' switches to typing one
                    const cats = [...new Set(allItems.map(i => i.category?.trim()).filter((c): c is string => !!c))].sort((x, y) => x.localeCompare(y, 'es'))
                    const typing = newIng.category === '\u0000' || (!!newIng.category && !cats.includes(newIng.category))
                    return typing ? (
                      <div className="inv-cat-new">
                        <input className="inv-input" placeholder="Nombre de la nueva categoría" autoFocus
                          value={newIng.category === '\u0000' ? '' : newIng.category}
                          onChange={e => setNewIng({ ...newIng, category: e.target.value || '\u0000' })} />
                        {cats.length > 0 && <button className="inv-btn ghost small" onClick={() => setNewIng({ ...newIng, category: '' })}>Elegir existente</button>}
                      </div>
                    ) : (
                      <label className="inv-field"><span>Categoría</span>
                        <select className="inv-input" value={newIng.category} onChange={e => setNewIng({ ...newIng, category: e.target.value })}>
                          <option value="">Sin categoría</option>
                          {cats.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value={'\u0000'}>+ Nueva categoría…</option>
                        </select>
                      </label>
                    )
                  })()}
                  <div className="inv-modal-actions">
                    <button className="inv-btn ghost small" onClick={() => setNewIng(null)}>Cancelar</button>
                    <button className="inv-btn primary small" onClick={saveNewIngredient} disabled={ingSaving || !newIng.name.trim()}>{ingSaving ? 'Creando…' : 'Crear y usar'}</button>
                  </div>
                </div>
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
