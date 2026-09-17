'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useDashboardStore } from '../../../lib/DashboardStoreProvider'
import '../productos.css'

type Category = { id: string; store_id: string; name: string; position: number }
type Product = { id: string; name: string; image_url: string | null; is_active: boolean; position: number | null; category_ids: string[] }

export default function CategoriasPage() {
  const { storeId } = useDashboardStore()
  const [categories, setCategories]   = useState<Category[]>([])
  const [products, setProducts]       = useState<Product[]>([])
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [showAddBar, setShowAddBar]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editName, setEditName]       = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => { if (storeId) loadData() }, [storeId])

  async function loadData() {
    if (!storeId) { setLoading(false); return }
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').eq('store_id', storeId).order('position'),
      supabase.from('products').select('id, name, image_url, is_active, position, category_id').eq('store_id', storeId).order('position', { ascending: true, nullsFirst: false }),
    ])
    setCategories(cats ?? [])
    // Full category membership per product — falls back to just category_id
    // if product_categories isn't there yet.
    const productIds = (prods ?? []).map(p => p.id)
    const catIdsByProduct: Record<string, string[]> = {}
    if (productIds.length > 0) {
      const { data: pcRows } = await supabase.from('product_categories').select('product_id, category_id').in('product_id', productIds)
      for (const row of pcRows ?? []) {
        (catIdsByProduct[row.product_id] ??= []).push(row.category_id)
      }
    }
    setProducts((prods ?? []).map(p => ({ ...p, category_ids: catIdsByProduct[p.id] ?? (p.category_id ? [p.category_id] : []) })))
    setLoading(false)
  }

  // Swaps two products' display order — a and b are whatever's currently
  // adjacent within the expanded category's own product list.
  async function swapProductPosition(a: Product, b: Product) {
    const posA = a.position ?? 0
    const posB = b.position ?? 0
    setProducts(prev => prev
      .map(p => p.id === a.id ? { ...p, position: posB } : p.id === b.id ? { ...p, position: posA } : p)
      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0)))
    await Promise.all([
      supabase.from('products').update({ position: posB }).eq('id', a.id),
      supabase.from('products').update({ position: posA }).eq('id', b.id),
    ])
  }

  async function handleAdd() {
    if (!storeId || !newName.trim() || saving) return
    setSaving(true)
    const maxPos = categories.length > 0 ? Math.max(...categories.map(c => c.position)) + 1 : 0
    const { data } = await supabase
      .from('categories')
      .insert({ store_id: storeId, name: newName.trim(), position: maxPos })
      .select().single()
    if (data) setCategories(c => [...c, data])
    setNewName(''); setShowAddBar(false); setSaving(false)
  }

  async function handleEdit(id: string) {
    if (!editName.trim() || saving) return
    setSaving(true)
    await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    setCategories(c => c.map(x => x.id === id ? { ...x, name: editName.trim() } : x))
    setEditingId(null); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar esta categoria? Se quitara de los productos que la tienen (si tenian otras categorias, las conservan).')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(c => c.filter(x => x.id !== id))
  }

  async function swap(idxA: number, idxB: number) {
    const updated = [...categories]
    const posA = updated[idxA].position
    const posB = updated[idxB].position
    updated[idxA] = { ...updated[idxA], position: posB }
    updated[idxB] = { ...updated[idxB], position: posA }
    ;[updated[idxA], updated[idxB]] = [updated[idxB], updated[idxA]]
    setCategories(updated)
    await Promise.all([
      supabase.from('categories').update({ position: posB }).eq('id', updated[idxB].id),
      supabase.from('categories').update({ position: posA }).eq('id', updated[idxA].id),
    ])
  }

  if (loading) return <div className="pr-spinner-wrap"><div className="pr-spinner" /></div>

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="pr-page-header">
        <div>
          <div className="pr-page-title">Categorias</div>
          <div className="pr-page-sub">
            Organiza tus productos en categorias. Los visitantes veran cada categoria como una seccion en tu tienda.
          </div>
        </div>
        {!showAddBar && (
          <button className="pr-add-btn" onClick={() => setShowAddBar(true)}>
            + Nueva categoria
          </button>
        )}
      </div>

      {showAddBar && (
        <div className="cat-add-bar">
          <input
            autoFocus
            className="pr-input"
            placeholder="Nombre (ej: Comidas, Bebidas, Postres...)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setShowAddBar(false); setNewName('') }
            }}
          />
          <button className="pr-save-btn" onClick={handleAdd} disabled={saving || !newName.trim()}>
            Guardar
          </button>
          <button className="pr-cancel-btn" onClick={() => { setShowAddBar(false); setNewName('') }}>
            Cancelar
          </button>
        </div>
      )}

      {categories.length === 0 && !showAddBar ? (
        <div className="db-empty" style={{ marginTop: 32 }}>
          <div className="db-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <div className="db-empty-title">Sin categorias</div>
          <div className="db-empty-sub">
            Agrega categorias para que tus visitantes encuentren los productos mas facil.
          </div>
        </div>
      ) : (
        <div className="cat-list">
          {categories.map((cat, idx) => {
            const catProducts = products.filter(p => p.category_ids.includes(cat.id))
            const isExpanded = expandedId === cat.id
            return (
            <div key={cat.id}>
            <div className="cat-row">
              <div className="cat-order-btns">
                <button className="cat-order-btn" onClick={() => swap(idx, idx - 1)} disabled={idx === 0}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button className="cat-order-btn" onClick={() => swap(idx, idx + 1)} disabled={idx === categories.length - 1}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {editingId === cat.id ? (
                <div className="cat-edit-inline">
                  <input
                    autoFocus
                    className="pr-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEdit(cat.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <button className="pr-save-btn" onClick={() => handleEdit(cat.id)} disabled={saving}>Guardar</button>
                  <button className="pr-cancel-btn" onClick={() => setEditingId(null)}>Cancelar</button>
                </div>
              ) : (
                <>
                  <div className="cat-name">{cat.name}</div>
                  <div className="cat-actions">
                    <button className="cat-edit-btn" onClick={() => setExpandedId(isExpanded ? null : cat.id)}>
                      {isExpanded ? 'Ocultar productos' : `Ordenar productos${catProducts.length ? ` (${catProducts.length})` : ''}`}
                    </button>
                    <button className="cat-edit-btn" onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}>
                      Editar
                    </button>
                    <button className="cat-del-btn" onClick={() => handleDelete(cat.id)}>
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="cat-products-panel">
                {catProducts.length === 0 ? (
                  <div className="cat-products-empty">Esta categoria todavia no tiene productos.</div>
                ) : (
                  catProducts.map((p, i) => (
                    <div key={p.id} className="cat-product-row">
                      <div className="cat-order-btns">
                        <button className="cat-order-btn" onClick={() => swapProductPosition(p, catProducts[i - 1])} disabled={i === 0}>
                          <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button className="cat-order-btn" onClick={() => swapProductPosition(p, catProducts[i + 1])} disabled={i === catProducts.length - 1}>
                          <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      {p.image_url
                        ? <img src={p.image_url} alt="" className="cat-product-img" />
                        : <div className="cat-product-img cat-product-img-empty" />
                      }
                      <div className="cat-product-name">{p.name}</div>
                      {!p.is_active && <div className="pr-card-opts-badge">Oculto</div>}
                    </div>
                  ))
                )}
              </div>
            )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
