'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/LocaleProvider'
import './productos.css'

type VariableChoice = { value: string; price: number; calories?: number; fat?: number; protein?: number; carbs?: number }
type VariableGroup  = { label: string; choices: VariableChoice[]; min?: number; max?: number }
function normalizeChoice(c: VariableChoice | string): VariableChoice {
  return typeof c === 'string'
    ? { value: c, price: 0 }
    : { value: c.value, price: c.price ?? 0, calories: c.calories, fat: c.fat, protein: c.protein, carbs: c.carbs }
}
const PRODUCT_VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
function isVideoUrl(url?: string | null): boolean {
  return !!url && PRODUCT_VIDEO_EXT_RE.test(url)
}
type Additional    = { name: string; price: number; calories?: number; fat?: number; protein?: number; carbs?: number }
type ColorVariant  = { label: string; color: string; imageUrl: string }
type NutritionInfo = { enabled?: boolean; calories?: number; fat?: number; protein?: number; carbs?: number }
type ProductOptions = {
  variables?:     VariableGroup[]
  colors?:        string[]
  colorVariants?: ColorVariant[]
  additionals?:   Additional[]
  allowNotes?:    boolean
  nutrition?:     NutritionInfo
}

type Product = {
  id: string; store_id: string; name: string
  description: string | null; price: number
  image_url: string | null; is_active: boolean
  options?: ProductOptions | null
  category_id?: string | null
}

type VariableGroupPreset   = { id: string; name: string; group: VariableGroup }
type AdditionalGroupPreset = { id: string; name: string; items: Additional[] }

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
  const [isDirty, setIsDirty]       = useState(false)
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({})

  // options state
  const [optVariables, setOptVariables]     = useState<VariableGroup[]>([])
  const [choiceInputs, setChoiceInputs]     = useState<Record<number, string>>({})
  const [optColors, setOptColors]           = useState<string[]>([])
  const [colorInput, setColorInput]         = useState('')
  const [optAdditionals, setOptAdditionals] = useState<Additional[]>([])
  const [optAllowNotes, setOptAllowNotes]   = useState(false)

  const [optNutritionEnabled, setOptNutritionEnabled] = useState(false)
  const [optCalories, setOptCalories] = useState('')
  const [optFat,      setOptFat]      = useState('')
  const [optProtein,  setOptProtein]  = useState('')
  const [optCarbs,    setOptCarbs]    = useState('')

  const [optColorVariants, setOptColorVariants]       = useState<ColorVariant[]>([])
  const [variantImgUploadIdx, setVariantImgUploadIdx] = useState<number | null>(null)
  const [variantImgUploading, setVariantImgUploading] = useState(false)

  // reusable option-group presets (saved on the store, applied across products)
  const [checkoutSettings, setCheckoutSettings]           = useState<Record<string, unknown>>({})
  const [variableGroupPresets, setVariableGroupPresets]     = useState<VariableGroupPreset[]>([])
  const [additionalGroupPresets, setAdditionalGroupPresets] = useState<AdditionalGroupPreset[]>([])
  const [applyVarPresetId, setApplyVarPresetId]           = useState('')
  const [applyAddPresetId, setApplyAddPresetId]           = useState('')
  const [savingVarPresetFor, setSavingVarPresetFor]       = useState<number | null>(null)
  const [varPresetNameInput, setVarPresetNameInput]       = useState('')
  const [savingAddPreset, setSavingAddPreset]             = useState(false)
  const [addPresetNameInput, setAddPresetNameInput]       = useState('')
  const [mounted, setMounted] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const variantImgRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: storeData } = await supabase
      .from('stores').select('id, slug').eq('owner_id', user!.id).maybeSingle()
    setStore(storeData)
    if (storeData) {
      const [{ data: prods }, { data: cats }, { data: storeCs }] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', storeData.id).order('created_at', { ascending: false }),
        supabase.from('categories').select('*').eq('store_id', storeData.id).order('position'),
        supabase.from('stores').select('checkout_settings').eq('id', storeData.id).maybeSingle(),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
      const cs = (storeCs?.checkout_settings && typeof storeCs.checkout_settings === 'object') ? storeCs.checkout_settings as Record<string, unknown> : {}
      setCheckoutSettings(cs)
      const presets = (cs.optionPresets && typeof cs.optionPresets === 'object') ? cs.optionPresets as { variableGroups?: VariableGroupPreset[]; additionalGroups?: AdditionalGroupPreset[] } : {}
      setVariableGroupPresets(presets.variableGroups ?? [])
      setAdditionalGroupPresets(presets.additionalGroups ?? [])
    }
    setLoading(false)
  }

  function resetOpts() {
    setOptVariables([]); setChoiceInputs({})
    setOptColors([]); setColorInput('')
    setOptColorVariants([])
    setOptAdditionals([]); setOptAllowNotes(false)
    setOptNutritionEnabled(false)
    setOptCalories(''); setOptFat(''); setOptProtein(''); setOptCarbs('')
  }

  function openAdd() {
    setEditing(null)
    setName(''); setDescription(''); setPrice('')
    setIsActive(true); setImageUrl(''); setError('')
    setCategoryId(''); setIsDirty(false)
    resetOpts(); setMode('form')
  }

  function openEdit(p: Product) {
    setEditing(p)
    setName(p.name); setDescription(p.description ?? '')
    setPrice(String(p.price)); setIsActive(p.is_active)
    setImageUrl(p.image_url ?? ''); setError('')
    setCategoryId(p.category_id ?? ''); setIsDirty(false)
    const opts = p.options ?? {}
    setOptVariables((opts.variables ?? []).map(g => ({ ...g, choices: (g.choices ?? []).map(normalizeChoice) })))
    setOptColors(opts.colors ?? [])
    setOptColorVariants(opts.colorVariants ?? [])
    setOptAdditionals(opts.additionals ?? [])
    setOptAllowNotes(opts.allowNotes ?? false)
    setOptNutritionEnabled(opts.nutrition?.enabled ?? false)
    setOptCalories(opts.nutrition?.calories !== undefined ? String(opts.nutrition.calories) : '')
    setOptFat(opts.nutrition?.fat !== undefined ? String(opts.nutrition.fat) : '')
    setOptProtein(opts.nutrition?.protein !== undefined ? String(opts.nutrition.protein) : '')
    setOptCarbs(opts.nutrition?.carbs !== undefined ? String(opts.nutrition.carbs) : '')
    setChoiceInputs({}); setColorInput('')
    setMode('form')
  }

  // --- variable helpers ---
  function addVarGroup() {
    setOptVariables(v => [...v, { label: '', choices: [] }])
    setIsDirty(true)
  }
  function updateVarLabel(i: number, label: string) {
    setOptVariables(v => v.map((g, idx) => idx === i ? { ...g, label } : g))
    setIsDirty(true)
  }
  function addChoice(gi: number, val: string) {
    if (!val.trim()) return
    setOptVariables(v => v.map((g, i) => i === gi ? { ...g, choices: [...g.choices, { value: val.trim(), price: 0 }] } : g))
    setChoiceInputs(p => ({ ...p, [gi]: '' }))
    setIsDirty(true)
  }
  function removeChoice(gi: number, ci: number) {
    setOptVariables(v => v.map((g, i) => i === gi
      ? { ...g, choices: g.choices.filter((_, j) => j !== ci) } : g))
    setIsDirty(true)
  }
  function updateChoicePrice(gi: number, ci: number, price: number) {
    setOptVariables(v => v.map((g, i) => i === gi
      ? { ...g, choices: g.choices.map((c, j) => j === ci ? { ...c, price } : c) } : g))
    setIsDirty(true)
  }
  function updateChoiceNutrition(gi: number, ci: number, field: 'calories' | 'fat' | 'protein' | 'carbs', value: number) {
    setOptVariables(v => v.map((g, i) => i === gi
      ? { ...g, choices: g.choices.map((c, j) => j === ci ? { ...c, [field]: value } : c) } : g))
    setIsDirty(true)
  }
  function removeVarGroup(i: number) {
    setOptVariables(v => v.filter((_, idx) => idx !== i))
    setChoiceInputs(p => { const n = { ...p }; delete n[i]; return n })
    setIsDirty(true)
  }
  function updateVarMinMax(i: number, field: 'min' | 'max', value: number) {
    setOptVariables(v => v.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
    setIsDirty(true)
  }
  function moveVarGroup(i: number, dir: -1 | 1) {
    const j = i + dir
    setOptVariables(arr => {
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setIsDirty(true)
  }
  function moveAdditional(i: number, dir: -1 | 1) {
    const j = i + dir
    setOptAdditionals(arr => {
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setIsDirty(true)
  }

  // --- option-group presets (store-level, reusable across products) ---
  async function persistOptionPresets(next: { variableGroups: VariableGroupPreset[]; additionalGroups: AdditionalGroupPreset[] }) {
    if (!store) return
    const newCs = { ...checkoutSettings, optionPresets: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', store.id)
    setCheckoutSettings(newCs)
  }

  function saveVariableGroupPreset(gi: number) {
    const name = varPresetNameInput.trim()
    if (!name) return
    const group = optVariables[gi]
    if (!group || (group.choices ?? []).length === 0) return
    const preset: VariableGroupPreset = { id: crypto.randomUUID(), name, group: { label: group.label, choices: group.choices.map(normalizeChoice) } }
    const next = [...variableGroupPresets, preset]
    setVariableGroupPresets(next)
    persistOptionPresets({ variableGroups: next, additionalGroups: additionalGroupPresets })
    setSavingVarPresetFor(null); setVarPresetNameInput('')
  }

  function applyVariableGroupPreset() {
    const preset = variableGroupPresets.find(p => p.id === applyVarPresetId)
    if (!preset) return
    setOptVariables(v => [...v, { label: preset.group.label, choices: (preset.group.choices ?? []).map(normalizeChoice) }])
    setIsDirty(true)
    setApplyVarPresetId('')
  }

  function deleteVariableGroupPreset(id: string) {
    const next = variableGroupPresets.filter(p => p.id !== id)
    setVariableGroupPresets(next)
    persistOptionPresets({ variableGroups: next, additionalGroups: additionalGroupPresets })
  }

  function saveAdditionalGroupPreset() {
    const name = addPresetNameInput.trim()
    const items = optAdditionals.filter(a => a.name.trim())
    if (!name || items.length === 0) return
    const preset: AdditionalGroupPreset = { id: crypto.randomUUID(), name, items }
    const next = [...additionalGroupPresets, preset]
    setAdditionalGroupPresets(next)
    persistOptionPresets({ variableGroups: variableGroupPresets, additionalGroups: next })
    setSavingAddPreset(false); setAddPresetNameInput('')
  }

  function applyAdditionalGroupPreset() {
    const preset = additionalGroupPresets.find(p => p.id === applyAddPresetId)
    if (!preset) return
    setOptAdditionals(a => [...a, ...(preset.items ?? []).map(item => ({ ...item }))])
    setIsDirty(true)
    setApplyAddPresetId('')
  }

  function deleteAdditionalGroupPreset(id: string) {
    const next = additionalGroupPresets.filter(p => p.id !== id)
    setAdditionalGroupPresets(next)
    persistOptionPresets({ variableGroups: variableGroupPresets, additionalGroups: next })
  }

  async function handleImgUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file || !store) return
    setImgUploading(true)
    setIsDirty(true)
    const ext  = file.name.split('.').pop()
    const path = `${store.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type })
    if (!uploadError) {
      setImageUrl(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
    }
    setImgUploading(false)
  }

  async function handleVariantImgUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file || !store || variantImgUploadIdx === null) return
    setVariantImgUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${store.id}-var-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      setOptColorVariants(prev => prev.map((v, i) => i === variantImgUploadIdx ? { ...v, imageUrl: url } : v))
      setIsDirty(true)
    }
    setVariantImgUploading(false)
    setVariantImgUploadIdx(null)
  }

  function moveVariant(i: number, dir: -1 | 1) {
    const j = i + dir
    setOptColorVariants(arr => {
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setIsDirty(true)
  }

  async function handleSave() {
    if (!store || !name.trim()) { setError(t('prod.error.name')); return }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { setError(t('prod.error.price')); return }
    setSaving(true); setError('')

    const opts: ProductOptions = {
      variables:     optVariables.filter(g => g.label.trim() && g.choices.length > 0),
      colors:        optColors.filter(Boolean),
      colorVariants: optColorVariants.filter(v => v.label.trim() || v.imageUrl),
      additionals:   optAdditionals.filter(a => a.name.trim()),
      allowNotes:    optAllowNotes,
      nutrition: optNutritionEnabled ? {
        enabled:  true,
        calories: parseFloat(optCalories) || 0,
        fat:      parseFloat(optFat) || 0,
        protein:  parseFloat(optProtein) || 0,
        carbs:    parseFloat(optCarbs) || 0,
      } : undefined,
    }
    const hasOpts = opts.variables!.length > 0 || opts.colors!.length > 0 ||
      (opts.colorVariants?.length ?? 0) > 0 ||
      opts.additionals!.length > 0 || opts.allowNotes || !!opts.nutrition

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
    else { await loadData(); setMode('list'); setIsDirty(false) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm(t('prod.delete.confirm'))) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }

  function toggleActive(p: Product) {
    const current = pendingToggles[p.id] ?? p.is_active
    setPendingToggles(prev => ({ ...prev, [p.id]: !current }))
  }

  async function savePendingToggle(p: Product) {
    const newVal = pendingToggles[p.id] ?? p.is_active
    await supabase.from('products').update({ is_active: newVal }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: newVal } : x))
    setPendingToggles(prev => { const n = { ...prev }; delete n[p.id]; return n })
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
              ? (isVideoUrl(imageUrl)
                  ? <video src={imageUrl} autoPlay muted loop playsInline className="pr-img-preview" />
                  : <img src={imageUrl} alt="Producto" className="pr-img-preview" />)
              : <div className="pr-img-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, color: '#CBD5E1' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                  <div className="pr-img-label">{t('prod.img.upload')}</div>
                  <div className="pr-img-hint">{t('prod.img.hint')}</div>
                </div>
            }
            {imgUploading && <div className="pr-img-overlay">{t('prod.img.uploading')}</div>}
            {imageUrl && !imgUploading && <div className="pr-img-overlay pr-img-hover">{t('prod.img.change')}</div>}
          </div>
          <input ref={imgRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} onChange={handleImgUpload} />
          <input ref={variantImgRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} onChange={handleVariantImgUpload} />
          <p className="pr-img-tip">{t('prod.img.tip')}</p>
        </div>

        <div className="pr-fields-col">
          <div className="pr-field">
            <label className="pr-label">{t('prod.name.label')}</label>
            <input type="text" className="pr-input" placeholder={t('prod.name.placeholder')}
              value={name} onChange={e => { setName(e.target.value); setIsDirty(true) }} />
          </div>
          <div className="pr-field">
            <label className="pr-label">{t('prod.desc.label')}</label>
            <textarea className="pr-textarea" placeholder={t('prod.desc.placeholder')} rows={3}
              value={description} onChange={e => { setDescription(e.target.value); setIsDirty(true) }} />
          </div>
          {categories.length > 0 && (
            <div className="pr-field">
              <label className="pr-label">Categoria</label>
              <select
                className="pr-select"
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); setIsDirty(true) }}
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
                  value={price} onChange={e => { setPrice(e.target.value); setIsDirty(true) }} />
              </div>
            </div>
            <div className="pr-field">
              <label className="pr-label">{t('prod.visible.label')}</label>
              <div className="pr-toggle-row" onClick={() => { setIsActive(a => !a); setIsDirty(true) }}>
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
          {variableGroupPresets.length > 0 && (
            <div className="pr-preset-apply-row">
              <select className="pr-preset-select" value={applyVarPresetId} onChange={e => setApplyVarPresetId(e.target.value)}>
                <option value="">Usar un grupo guardado...</option>
                {variableGroupPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="pr-preset-apply-btn" onClick={applyVariableGroupPreset} disabled={!applyVarPresetId}>Aplicar</button>
              {applyVarPresetId && (
                <button className="pr-preset-del-btn" title="Eliminar preset guardado" onClick={() => deleteVariableGroupPreset(applyVarPresetId)}>Eliminar guardado</button>
              )}
            </div>
          )}
          {optVariables.length > 0 && (
            <div className="pr-opts-box-body">
              {optVariables.map((g, gi) => (
                <div key={gi} className="pr-opt-group-row">
                  <div className="pr-opt-group-top">
                    <div className="cat-order-btns">
                      <button className="cat-order-btn" onClick={() => moveVarGroup(gi, -1)} disabled={gi === 0}>▲</button>
                      <button className="cat-order-btn" onClick={() => moveVarGroup(gi, 1)} disabled={gi === optVariables.length - 1}>▼</button>
                    </div>
                    <input
                      className="pr-opt-group-label-input"
                      placeholder="Nombre del grupo (ej: Talla, Sabor)"
                      value={g.label}
                      onChange={e => updateVarLabel(gi, e.target.value)}
                    />
                    <button
                      className="pr-opt-save-preset"
                      disabled={!g.label.trim() || g.choices.length === 0}
                      onClick={() => { setSavingVarPresetFor(gi); setVarPresetNameInput(g.label) }}
                    >
                      Guardar como preset
                    </button>
                    <button className="pr-opt-del-group" onClick={() => removeVarGroup(gi)}>Eliminar grupo</button>
                  </div>
                  <div className="pr-opt-group-minmax">
                    <label>
                      Minimo
                      <input
                        type="number" min="0" step="1" placeholder="0"
                        value={g.min ?? ''}
                        onChange={e => updateVarMinMax(gi, 'min', parseInt(e.target.value) || 0)}
                      />
                    </label>
                    <label>
                      Maximo
                      <input
                        type="number" min="1" step="1" placeholder="1"
                        value={g.max ?? ''}
                        onChange={e => updateVarMinMax(gi, 'max', Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </label>
                    <span className="pr-opt-group-minmax-hint">
                      {(g.max ?? 1) > 1 ? `El cliente elige entre ${g.min ?? 0} y ${g.max ?? 1} opciones` : (g.min ?? 0) > 0 ? 'El cliente debe elegir una opcion' : 'El cliente elige una opcion (opcional)'}
                    </span>
                  </div>
                  {savingVarPresetFor === gi && (
                    <div className="pr-preset-name-row">
                      <input
                        className="pr-opt-chip-input"
                        placeholder="Nombre del preset (ej: Tallas)"
                        value={varPresetNameInput}
                        onChange={e => setVarPresetNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveVariableGroupPreset(gi) }}
                        autoFocus
                      />
                      <button className="pr-preset-apply-btn" onClick={() => saveVariableGroupPreset(gi)} disabled={!varPresetNameInput.trim()}>Guardar</button>
                      <button className="pr-preset-cancel-btn" onClick={() => { setSavingVarPresetFor(null); setVarPresetNameInput('') }}>Cancelar</button>
                    </div>
                  )}
                  <div className="pr-opt-choices">
                    {g.choices.map((c, ci) => {
                      const choice = normalizeChoice(c)
                      return (
                        <div key={ci} className="pr-opt-choice-block">
                          <div className="pr-opt-chip">
                            <span className="pr-opt-chip-label">{choice.value}</span>
                            <span className="pr-opt-chip-price-wrap">
                              <span className="pr-opt-chip-dollar">+$</span>
                              <input
                                type="number" min="0" step="0.01" placeholder="0.00"
                                className="pr-opt-chip-price"
                                value={choice.price || ''}
                                onChange={e => updateChoicePrice(gi, ci, parseFloat(e.target.value) || 0)}
                              />
                            </span>
                            <button onClick={() => removeChoice(gi, ci)}>×</button>
                          </div>
                          {optNutritionEnabled && (
                            <div className="pr-opt-choice-nutrition-row">
                              <input
                                type="number" step="1" placeholder="kcal"
                                value={choice.calories ?? ''}
                                onChange={e => updateChoiceNutrition(gi, ci, 'calories', parseFloat(e.target.value) || 0)}
                              />
                              <input
                                type="number" step="0.1" placeholder="grasa (g)"
                                value={choice.fat ?? ''}
                                onChange={e => updateChoiceNutrition(gi, ci, 'fat', parseFloat(e.target.value) || 0)}
                              />
                              <input
                                type="number" step="0.1" placeholder="prot (g)"
                                value={choice.protein ?? ''}
                                onChange={e => updateChoiceNutrition(gi, ci, 'protein', parseFloat(e.target.value) || 0)}
                              />
                              <input
                                type="number" step="0.1" placeholder="carbs (g)"
                                value={choice.carbs ?? ''}
                                onChange={e => updateChoiceNutrition(gi, ci, 'carbs', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
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

        {/* Variantes de color */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head">
            <div>
              <div className="pr-opts-box-label">Variantes de color</div>
              <div className="pr-opts-box-hint">Cada color puede tener su propia foto del producto</div>
            </div>
            <button className="pr-opts-add-btn" onClick={() => {
              setOptColorVariants(v => [...v, { label: '', color: '#7C3AED', imageUrl: '' }])
              setIsDirty(true)
            }}>+ Agregar</button>
          </div>
          {optColorVariants.length > 0 && (
            <div className="pr-opts-box-body">
              {optColorVariants.map((v, i) => (
                <div key={i} className="pr-variant-row">
                  <div className="cat-order-btns">
                    <button className="cat-order-btn" onClick={() => moveVariant(i, -1)} disabled={i === 0}>▲</button>
                    <button className="cat-order-btn" onClick={() => moveVariant(i, 1)} disabled={i === optColorVariants.length - 1}>▼</button>
                  </div>
                  <input
                    type="color"
                    className="pr-variant-color-input"
                    value={v.color}
                    onChange={e => {
                      setOptColorVariants(arr => arr.map((x, j) => j === i ? { ...x, color: e.target.value } : x))
                      setIsDirty(true)
                    }}
                  />
                  <div className="pr-variant-fields">
                    <input
                      className="pr-variant-label-input"
                      placeholder="Nombre del color (ej: Rojo, Azul marino...)"
                      value={v.label}
                      onChange={e => {
                        setOptColorVariants(arr => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))
                        setIsDirty(true)
                      }}
                    />
                    <div
                      className="pr-variant-img-btn"
                      onClick={() => { setVariantImgUploadIdx(i); variantImgRef.current?.click() }}
                    >
                      {v.imageUrl
                        ? <>{isVideoUrl(v.imageUrl)
                              ? <video src={v.imageUrl} autoPlay muted loop playsInline className="pr-variant-img-preview" />
                              : <img src={v.imageUrl} alt="" className="pr-variant-img-preview" />}<span>Cambiar foto</span></>
                        : <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                            </svg>
                            <span>{variantImgUploading && variantImgUploadIdx === i ? 'Subiendo...' : 'Agregar foto'}</span>
                          </>
                      }
                    </div>
                  </div>
                  <button className="pr-opt-del" onClick={() => {
                    setOptColorVariants(arr => arr.filter((_, j) => j !== i))
                    setIsDirty(true)
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adicionales */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head">
            <div>
              <div className="pr-opts-box-label">Adicionales</div>
              <div className="pr-opts-box-hint">El cliente puede agregar extras opcionales al producto</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="pr-opt-save-preset"
                disabled={optAdditionals.filter(a => a.name.trim()).length === 0}
                onClick={() => { setSavingAddPreset(true); setAddPresetNameInput('') }}
              >
                Guardar como preset
              </button>
              <button className="pr-opts-add-btn" onClick={() => { setOptAdditionals(a => [...a, { name: '', price: 0 }]); setIsDirty(true) }}>
                + Agregar
              </button>
            </div>
          </div>
          {additionalGroupPresets.length > 0 && (
            <div className="pr-preset-apply-row">
              <select className="pr-preset-select" value={applyAddPresetId} onChange={e => setApplyAddPresetId(e.target.value)}>
                <option value="">Usar un grupo guardado...</option>
                {additionalGroupPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="pr-preset-apply-btn" onClick={applyAdditionalGroupPreset} disabled={!applyAddPresetId}>Aplicar</button>
              {applyAddPresetId && (
                <button className="pr-preset-del-btn" title="Eliminar preset guardado" onClick={() => deleteAdditionalGroupPreset(applyAddPresetId)}>Eliminar guardado</button>
              )}
            </div>
          )}
          {savingAddPreset && (
            <div className="pr-preset-name-row">
              <input
                className="pr-opt-chip-input"
                placeholder="Nombre del preset (ej: Salsas)"
                value={addPresetNameInput}
                onChange={e => setAddPresetNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveAdditionalGroupPreset() }}
                autoFocus
              />
              <button className="pr-preset-apply-btn" onClick={saveAdditionalGroupPreset} disabled={!addPresetNameInput.trim()}>Guardar</button>
              <button className="pr-preset-cancel-btn" onClick={() => { setSavingAddPreset(false); setAddPresetNameInput('') }}>Cancelar</button>
            </div>
          )}
          {optAdditionals.length > 0 && (
            <div className="pr-opts-box-body">
              {optAdditionals.map((a, i) => (
                <div key={i} className="pr-opt-extra-row-wrap">
                  <div className="pr-opt-extra-row">
                    <div className="cat-order-btns">
                      <button className="cat-order-btn" onClick={() => moveAdditional(i, -1)} disabled={i === 0}>▲</button>
                      <button className="cat-order-btn" onClick={() => moveAdditional(i, 1)} disabled={i === optAdditionals.length - 1}>▼</button>
                    </div>
                    <input
                      className="pr-opt-extra-name"
                      placeholder="Nombre del adicional (ej: Extra queso)"
                      value={a.name}
                      onChange={e => { setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x)); setIsDirty(true) }}
                    />
                    <div className="pr-opt-extra-price-wrap">
                      <span className="pr-opt-extra-dollar">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        className="pr-opt-extra-price"
                        placeholder="0.00"
                        value={a.price || ''}
                        onChange={e => { setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x)); setIsDirty(true) }}
                      />
                    </div>
                    <button className="pr-opt-del" onClick={() => { setOptAdditionals(arr => arr.filter((_, j) => j !== i)); setIsDirty(true) }}>×</button>
                  </div>
                  {optNutritionEnabled && (
                    <div className="pr-opt-extra-nutrition-row">
                      <input
                        type="number" step="1" placeholder="kcal"
                        value={a.calories ?? ''}
                        onChange={e => { setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, calories: parseFloat(e.target.value) || 0 } : x)); setIsDirty(true) }}
                      />
                      <input
                        type="number" step="0.1" placeholder="grasa (g)"
                        value={a.fat ?? ''}
                        onChange={e => { setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, fat: parseFloat(e.target.value) || 0 } : x)); setIsDirty(true) }}
                      />
                      <input
                        type="number" step="0.1" placeholder="prot (g)"
                        value={a.protein ?? ''}
                        onChange={e => { setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, protein: parseFloat(e.target.value) || 0 } : x)); setIsDirty(true) }}
                      />
                      <input
                        type="number" step="0.1" placeholder="carbs (g)"
                        value={a.carbs ?? ''}
                        onChange={e => { setOptAdditionals(arr => arr.map((x, j) => j === i ? { ...x, carbs: parseFloat(e.target.value) || 0 } : x)); setIsDirty(true) }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informacion nutricional */}
        <div className="pr-opts-box">
          <div className="pr-opts-box-head" style={{ alignItems: 'center' }}>
            <div>
              <div className="pr-opts-box-label">Información nutricional</div>
              <div className="pr-opts-box-hint">Muestra calorías, grasas, proteínas y carbohidratos en la tienda — se actualiza según los adicionales elegidos</div>
            </div>
            <div className="pr-toggle-row" style={{ padding: 0 }} onClick={() => { setOptNutritionEnabled(n => !n); setIsDirty(true) }}>
              <div className={`pr-toggle ${optNutritionEnabled ? 'on' : ''}`}><div className="pr-toggle-knob" /></div>
            </div>
          </div>
          {optNutritionEnabled && (
            <div className="pr-opts-box-body">
              <div className="pr-nutrition-grid">
                <div className="pr-nutrition-field">
                  <label>Calorías <span className="pr-nutrition-unit">kcal</span></label>
                  <input type="number" min="0" step="1" placeholder="0" value={optCalories} onChange={e => { setOptCalories(e.target.value); setIsDirty(true) }} />
                </div>
                <div className="pr-nutrition-field">
                  <label>Grasas <span className="pr-nutrition-unit">g</span></label>
                  <input type="number" min="0" step="0.1" placeholder="0" value={optFat} onChange={e => { setOptFat(e.target.value); setIsDirty(true) }} />
                </div>
                <div className="pr-nutrition-field">
                  <label>Proteínas <span className="pr-nutrition-unit">g</span></label>
                  <input type="number" min="0" step="0.1" placeholder="0" value={optProtein} onChange={e => { setOptProtein(e.target.value); setIsDirty(true) }} />
                </div>
                <div className="pr-nutrition-field">
                  <label>Carbohidratos <span className="pr-nutrition-unit">g</span></label>
                  <input type="number" min="0" step="0.1" placeholder="0" value={optCarbs} onChange={e => { setOptCarbs(e.target.value); setIsDirty(true) }} />
                </div>
              </div>
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

      {error && <div className="pr-error" style={{ maxWidth: 720 }}>{error}</div>}

      {mounted && isDirty && createPortal(
        <div className="pr-bottom-save">
          <button className="pr-cancel-btn" onClick={() => setMode('list')}>{t('prod.cancel')}</button>
          <button className="pr-save-btn pr-save-btn-lg" onClick={handleSave} disabled={saving || imgUploading}>
            {saving ? t('prod.saving') : 'Guardar producto'}
          </button>
        </div>,
        document.body
      )}
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
            const hasOpts = !!(p.options?.variables?.length || p.options?.colors?.length || p.options?.additionals?.length || p.options?.allowNotes || p.options?.nutrition?.enabled)
            const hasPending = p.id in pendingToggles
            const displayActive = hasPending ? pendingToggles[p.id] : p.is_active
            return (
              <div key={p.id} className={`pr-card${hasPending ? ' pr-card-pending' : ''}`} onClick={() => openEdit(p)}>
                <div className="pr-card-img-wrap">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="pr-card-img" />
                    : <div className="pr-card-img-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg></div>
                  }
                </div>
                <div className="pr-card-info">
                  <div className="pr-card-name">{p.name}</div>
                  {p.description && <div className="pr-card-desc">{p.description}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="pr-card-price">${Number(p.price).toFixed(2)}</div>
                    {hasOpts && <div className="pr-card-opts-badge">Con opciones</div>}
                    {p.category_id && categories.find(c => c.id === p.category_id) && (
                      <div className="pr-card-cat">{categories.find(c => c.id === p.category_id)!.name}</div>
                    )}
                  </div>
                </div>
                <div className="pr-card-right" onClick={e => e.stopPropagation()}>
                  {hasPending && (
                    <button className="pr-card-save-btn" onClick={() => savePendingToggle(p)}>
                      Guardar
                    </button>
                  )}
                  <div className={`pr-pill ${displayActive ? 'active' : 'inactive'}`} onClick={() => toggleActive(p)}>
                    {displayActive ? t('prod.status.active') : t('prod.status.inactive')}
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
