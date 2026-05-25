'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../productos.css'

type Category = { id: string; store_id: string; name: string; position: number }

export default function CategoriasPage() {
  const { user } = useAuth()
  const [storeId, setStoreId]         = useState<string | null>(null)
  const [categories, setCategories]   = useState<Category[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAddBar, setShowAddBar]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editName, setEditName]       = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: store } = await supabase
      .from('stores').select('id').eq('owner_id', user!.id).maybeSingle()
    if (!store) { setLoading(false); return }
    setStoreId(store.id)
    const { data } = await supabase
      .from('categories').select('*').eq('store_id', store.id).order('position')
    setCategories(data ?? [])
    setLoading(false)
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
    if (!confirm('Eliminar esta categoria? Los productos que la tienen quedaran sin categoria.')) return
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
          {categories.map((cat, idx) => (
            <div key={cat.id} className="cat-row">
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
          ))}
        </div>
      )}
    </div>
  )
}
