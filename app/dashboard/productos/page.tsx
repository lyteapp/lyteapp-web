'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/LocaleProvider'
import './productos.css'

type VariableGroup = { label: string; choices: string[] }
type Additional    = { name: string; price: number }
type ProductOptions = {
  variables?:   VariableGroup[]
  colors?:      string[]
  additionals?: Additional[]
  allowNotes?:  boolean
}

type Product = {
  id: string; store_id: string; name: string
  description: string | null; price: number
  image_url: string | null; is_active: boolean
  options?: ProductOptions | null
  category_id?: string | null
}

type Category = { id: string; name: string; position: number }
type Store = { id: string; slug: string }

export default function ProductosPage() {
  const { user } = useAuth()
  const t = useT()
  const [store, setStore]       = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [mode, setMode]         = useState<'list' | 'form'>('list')
  const [editing, setEditing]   = useState<Product | null>(null)

  // basic fields
  const [name, setName]             = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice]           = useState('')
  const [isActive, setIsActive]     = useState(true)
  const [imageUrl, setImageUrl]     = useState('')
  const [imgUploading, setImgUploading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string>('')

  // options state
  const [optVariables, setOptVariables]     = useState<VariableGroup[]>([])
  const [choiceInputs, setChoiceInputs]     = useState<Record<number, string>>({})
  const [optColors, setOptColors]           = useState<string[]>([])
  const [colorInput, setColorInput]         = useState('')
  const [optAdditionals, setOptAdditionals] = useState<Additional[]>([])
  const [optAllowNotes, setOptAllowNotes]   = useState(false)

  const imgRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: storeData } = await supabase
      .from('stores').select('id, slug').eq('owner_id', user!.id).maybeSingle()
    setStore(storeData)
    if (storeData) {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', storeData.id).order('created_at', { ascending: false }),
        supabase.from('categories').select('*').eq('store_id', storeData.id).order('position'),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
    }
    setLoading(false)
  }

  function resetOpts() {
    setOptVariables([]); setChoiceInputs({})
    setOptColors([]); setColorInput('')
    setOptAdditionals([]); setOptAllowNotes(false)
  }

  function openAdd() {
    setEditing(null)
    setName(''); setDescription(''); setPrice('')
    setIsActive(true); setImageUrl(''); setError('')
    setCategoryId('')
    resetOpts(); setMode('form')
  }

  function openEdit(p: Product) {
    setEditing(p)
    setName(p.name); setDescription(p.description ?? '')
    setPrice(String(p.price)); setIsActive(p.is_active)
    setImageUrl(p.image_url ?? ''); setError('')
    setCategoryId(p.category_id ?? '')
    const opts = p.options ?? {}
    setOptVariables(opts.variables ?? [])
    setOptColors(opts.colors ?? [])
    setOptAdditionals(opts.additionals ?? [])
    setOptAllowNotes(opts.allowNotes ?? false)
    setChoiceInputs({}); setColorInput('')
    setMode('form')
  }

  // --- variable helpers ---
  function addVarGroup() {
    setOptVariables(v => [...v, { label: '', choices: [] }])
  }
  function updateVarLabel(i: number, label: string) {
    setOptVariables(v => v.map((g, idx) => idx === i ? { ...g, label } : g))
  }
  function addChoice(gi: number, val: string) {
    if (!val.trim()) return
    setOptVariables(v => v.map((g, i) => i === gi ? { ...g, choices: [...g.choices, val.trim()] } : g))
    setChoiceInputs(p => ({ ...p, [gi]: '' }))
  }
  function removeChoice(gi: number, ci: number) {
    setOptVariables(v => v.map((g, i) => i === gi
      ? { ...g, choices: g.choices.filter((_, j) => j !== ci) } : g))
  }
  function removeVarGroup(i: number) {
    setOptVariables(v => v.filter((_, idx) => idx !== i))
    setChoiceInputs(p => { const n = { ...p }; delete n[i]; return n })
  }

  async function handleImgUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file || !store) return
    setImgUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${store.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) setImageUrl(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
    setImgUploading(false)
  }

  async function handleSave() {
    if (!store || !name.trim()) { setError(t('prod.error.name')); return }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { setError(t('prod.error.price')); return }
    setSaving(true); setError('')

    const opts: ProductOptions = {
      variables:   optVariables.filter(g => g.label.trim() && g.choices.length > 0),
      colors:      optColors.filter(Boolean),
      additionals: optAdditionals.filter(a => a.name.trim()),
      allowNotes:  optAllowNotes,
    }
    const hasOpts = opts.variables!.length > 0 || opts.colors!.length > 0 ||
      opts.additionals!.length > 0 || opts.allowNotes

    const payload = {
      store_id: store.id, name: name.trim(),
      description: description.trim() || null,
      price: priceNum, image_url: imageUrl || null, is_active: isActive,
      options: hasOpts ? opts : null,
      category_id: categoryId || null,
    }
    const { error: err } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload)

    if (err) setError(err.message)
    else { await loadData(); setMode('list') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm(t('prod.delete.confirm'))) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
  }

  if (loading) return <div className="pr-spinner-wrap"><div className="pr-spinner" /></div>

  if (!store) return (
    <div className="db-panel" style={{ maxWidth: 480 }}>
      <div className="db-empty">
        <div className="db-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
        </div>
        <div className="db-empty-title">{t('prod.noStore.title')}</div>
        <div className="db-empty-sub">{t('prod.noStore.sub')}</div>
        <a href="/dashboard/tienda" className="db-empty-btn">{t('prod.noStore.btn')}</a>
      </div>
    </div>
  )

  /* ── FORM ── */
  if (mode === 'form') return (
    <div className="pr-form-wrap">
      <div className="pr-form-header">
        <button className="pr-back-btn" onClick={() => setMode('list')}>{t('prod.back')}</button>
        <h2 className="pr-form-title">{editing ? t('prod.edit.title') : t('prod.new.title')}</h2>
      </div>

      {/* Main card: image + fields */}
      <div className="pr-form-card">
        <div className="pr-img-col">
          <div className="pr-img-upload" onClick={() => imgRef.current?.click()}>
            {imageUrl
              ? <img src={imageUrl} alt="Producto" className="pr-img-preview" />
              : <div className="pr-img-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, color: '#CBD5E1' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                  <div className="pr-img-label">{t('prod.img.upload')}</div>
                  <div className="pr-img-hint">{t('prod.img.hint')}</div>
                </div>
            }
            {imgUploading && <div className="pr-img-overlay">{t('prod.img.uploading')}</div>}
            {imageUrl && !imgUploading && <div className="pr-img-overlay pr-img-hover">{t('prod.img.change')}</div>}
          </div>
          <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />
          <p className="pr-img-tip">{t('prod.img.tip')}</p>
        </div>

        <div className="pr-fields-col">
          <div className="pr-field">
            <label className="pr-label">{t('prod.name.label')}</label>
            <input type="text" className="pr-input" placeholder={t('prod.name.placeholder')}
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="pr-field">
            <label className="pr-label">{t('prod.desc.label')}</label>
            <textarea className="pr-textarea" placeholder={t('prod.desc.placeholder')} rows={3}
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {categories.length > 0 && (
            <div className="pr-field">
              <label className="pr-label">Categoria</label>
              <select
                className="pr-select"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">Sin categoria</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="pr-two-col">
            <div className="pr-field">
              <label className="pr-label">{t('prod.price.label')}</label>
              <div className="pr-prefix-wrap">
                <span className="pr-prefix">$</span>
                <input type="number" className="pr-prefix-input" placeholder="0.00" min="0" step="0.01"
                  value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="pr-field">
              <label className="pr-label">{t('prod.visible.label')}</label>
              <div className="pr-toggle-row" onClick={() => setIsActive(a => !a)}>
                <div className={`pr-toggle ${isActive ? 'on' : ''}`}><div className="pr-toggle-knob" /></div>
                <span className="pr-toggle-lbl">{isActive ? t('prod.status.active') : t('prod.status.inactive')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── OPTIONS SECTION ── */}
      <div className="pr-opts-wrap">
        <div className="pr-opts-header">
          <span className="pr-opts-header-title">Opciones del producto</span>
          <span className="pr-opts-header-sub">Variables, colores, adicionales y comentarios opcionales</span>
        </div>

        {/* Variables */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head">
            <div>
              <div className="pr-opts-box-label">Variables</div>
              <div className="pr-opts-box-hint">Tallas, sabores, formatos, etc. — el cliente elige una opcion</div>
            </div>
            <button className="pr-opts-add-btn" onClick={addVarGroup}>+ Agregar grupo</button>
          </div>
          {optVariables.length > 0 && (
            <div className="pr-opts-box-body">
              {optVariables.map((g, gi) => (
                <div key={gi} className="pr-opt-group-row">
                  <div className="pr-opt-group-top">
                    <input
                      className="pr-opt-group-label-input"
                      placeholder="Nombre del grupo (ej: Talla, Sabor)"
                      value={g.label}
                      onChange={e => updateVarLabel(gi, e.target.value)}
                    />
                    <button className="pr-opt-del-group" onClick={() => removeVarGroup(gi)}>Eliminar grupo</button>
                  </div>
                  <div className="pr-opt-choices">
                    {g.choices.map((c, ci) => (
                      <div key={ci} className="pr-opt-chip">
                        {c}
                        <button onClick={() => removeChoice(gi, ci)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="pr-opt-add-choice-row">
                    <input
                      className="pr-opt-chip-input"
                      placeholder="Nueva opcion (ej: M, Fresa, 500ml...)"
                      value={choiceInputs[gi] ?? ''}
                      onChange={e => setChoiceInputs(p => ({ ...p, [gi]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          addChoice(gi, choiceInputs[gi] ?? '')
                          e.preventDefault()
                        }
                      }}
                    />
                    <button
                      className="pr-opt-add-choice-btn"
                      onClick={() => addChoice(gi, choiceInputs[gi] ?? '')}
                    >
                      + Agregar opcion
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colores */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head">
            <div>
              <div className="pr-opts-box-label">Colores</div>
              <div className="pr-opts-box-hint">El cliente elige el color del producto</div>
            </div>
          </div>
          <div className="pr-opts-box-body">
            <div className="pr-opt-choices">
              {optColors.map((c, i) => (
                <div key={i} className="pr-opt-chip">
                  {c}
                  <button onClick={() => setOptColors(colors => colors.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <input
                className="pr-opt-chip-input"
                placeholder="Escribe un color y presiona Enter"
                value={colorInput}
                onChange={e => setColorInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && colorInput.trim()) {
                    setOptColors(c => [...c, colorInput.trim()])
                    setColorInput('')
                    e.preventDefault()
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Adicionales */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head">
            <div>
              <div className="pr-opts-box-label">Adicionales</div>
              <div className="pr-opts-box-hint">El cliente puede agregar extras opcionales al producto</div>
            </div>
            <button className="pr-opts-add-btn" onClick={() => setOptAdditionals(a => [...a, { name: '', price: 0 }])}>
              + Agregar
            </button>
          </div>
          {optAdditionals.length > 0 && (
            <div className="pr-opts-box-body">
              {optAdditionals.map((a, i) => (
                <div key={i} className="pr-opt-extra-row">
                  <input
                    className="pr-opt-extra-name"
                    placeholder="Nombre del adicional (ej: Extra queso)"
                    value={a.name}
                    onChange={e => setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  />
                  <div className="pr-opt-extra-price-wrap">
                    <span className="pr-opt-extra-dollar">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      className="pr-opt-extra-price"
                      placeholder="0.00"
                      value={a.price || ''}
                      onChange={e => setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                    />
                  </div>
                  <button className="pr-opt-del" onClick={() => setOptAdditionals(arr => arr.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comentarios */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head" style={{ alignItems: 'center' }}>
            <div>
              <div className="pr-opts-box-label">Comentarios del cliente</div>
              <div className="pr-opts-box-hint">Casilla opcional para instrucciones especiales del comprador</div>
            </div>
            <div className="pr-toggle-row" style={{ padding: 0 }} onClick={() => setOptAllowNotes(n => !n)}>
              <div className={`pr-toggle ${optAllowNotes ? 'on' : ''}`}><div className="pr-toggle-knob" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SAVE BAR ── */}
      {error && <div className="pr-error" style={{ maxWidth: 720 }}>{error}</div>}
      <div className="pr-bottom-save">
        <button className="pr-cancel-btn" onClick={() => setMode('list')}>{t('prod.cancel')}</button>
        <button className="pr-save-btn pr-save-btn-lg" onClick={handleSave} disabled={saving || imgUploading}>
          {saving ? t('prod.saving') : 'Guardar producto'}
        </button>
      </div>
    </div>
  )

  /* ── LIST ── */
  const countLabel = products.length === 0
    ? t('prod.count.none')
    : products.length === 1
      ? t('prod.count.one')
      : t('prod.count.many', { n: String(products.length) })

  return (
    <div>
      <div className="pr-list-header">
        <div>
          <div className="pr-list-count">{countLabel}</div>
          {products.length > 0 && <div className="pr-list-hint">{t('prod.hint')}</div>}
        </div>
        <button className="pr-add-btn" onClick={openAdd}>{t('prod.addBtn')}</button>
      </div>

      {products.length === 0 ? (
        <div className="db-panel">
          <div className="db-empty">
            <div className="db-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <div className="db-empty-title">{t('prod.empty.title')}</div>
            <div className="db-empty-sub">{t('prod.empty.sub')}</div>
            <button className="db-empty-btn" onClick={openAdd}>{t('prod.addBtn')}</button>
          </div>
        </div>
      ) : (
        <div className="pr-list">
          {products.map(p => {
            const hasOpts = !!(p.options?.variables?.length || p.options?.colors?.length || p.options?.additionals?.length || p.options?.allowNotes)
            return (
              <div key={p.id} className="pr-card" onClick={() => openEdit(p)}>
                <div className="pr-card-img-wrap">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="pr-card-img" />
                    : <div className="pr-card-img-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg></div>
                  }
                </div>
                <div className="pr-card-info">
                  <div className="pr-card-name">{p.name}</div>
                  {p.description && <div className="pr-card-desc">{p.description}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="pr-card-price">${Number(p.price).toFixed(2)}</div>
                    {hasOpts && <div className="pr-card-opts-badge">Con opciones</div>}
                  </div>
                </div>
                <div className="pr-card-right" onClick={e => e.stopPropagation()}>
                  <div className={`pr-pill ${p.is_active ? 'active' : 'inactive'}`} onClick={() => toggleActive(p)}>
                    {p.is_active ? t('prod.status.active') : t('prod.status.inactive')}
                  </div>
                  <button className="pr-del-btn" onClick={() => handleDelete(p.id)}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
