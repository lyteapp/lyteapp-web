'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const STEPS = 6

export default function ProductosOnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: { target: { files: FileList | null } }) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  function skip() {
    router.push('/onboarding/pagos')
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    if (!name.trim() || !price) { setError('Nombre y precio son obligatorios.'); return }
    setSaving(true)
    setError('')

    try {
      const { data: store } = await supabase
        .from('stores').select('id').eq('owner_id', user.id).maybeSingle()
      if (!store) { setError('No encontramos tu tienda.'); setSaving(false); return }

      let image_url: string | null = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${store.id}/${Date.now()}.${ext}`
        await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true, contentType: imageFile.type })
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
        image_url = pub.publicUrl
      }

      const { error: err } = await supabase.from('products').insert({
        store_id: store.id,
        name: name.trim(),
        price: parseFloat(price),
        description: description.trim() || null,
        image_url,
        is_active: true,
      })

      if (err) { setError(err.message); setSaving(false); return }
      router.push('/onboarding/pagos')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
    setSaving(false)
  }

  return (
    <div className="ob-screen">
      <div className="ob-brand">Lyte<span>app</span></div>

      <div className="ob-progress">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className={`ob-dot ${i === 3 ? 'active' : i < 3 ? 'done' : ''}`} />
        ))}
      </div>

      <div className="ob-card">
        <div className="ob-step-label">Paso 4 de {STEPS}</div>
        <h1 className="ob-title">Agrega tu primer producto</h1>
        <p className="ob-sub">Solo uno para empezar. Puedes agregar más desde el dashboard cuando quieras.</p>

        <form onSubmit={handleSubmit}>
          {/* Image */}
          <div className="ob-field">
            <label className="ob-label">Foto del producto</label>
            <div
              className="ob-img-upload"
              onClick={() => fileRef.current?.click()}
              style={{ maxWidth: 160, height: 160, borderRadius: 16, aspectRatio: '1' }}
            >
              {imagePreview
                ? <Image src={imagePreview} alt="producto" fill style={{ objectFit: 'cover' }} />
                : (
                  <div className="ob-img-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28, color: '#CBD5E1' }} className="ob-img-empty-icon"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                    <span className="ob-img-empty-label">Agregar foto</span>
                    <span className="ob-img-empty-hint">JPG, PNG — hasta 5 MB</span>
                  </div>
                )
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
          </div>

          {/* Name + Price */}
          <div className="ob-two-col">
            <div className="ob-field">
              <label className="ob-label">Nombre del producto *</label>
              <input
                className="ob-input"
                placeholder="Ej: Hamburguesa clásica"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="ob-field">
              <label className="ob-label">Precio (USD) *</label>
              <div className="ob-prefix-wrap">
                <span className="ob-prefix">$</span>
                <input
                  className="ob-prefix-input"
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="ob-field">
            <label className="ob-label">Descripción (opcional)</label>
            <textarea
              className="ob-input"
              placeholder="Describe brevemente el producto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {error && <div className="ob-error">{error}</div>}

          <div className="ob-actions">
            <button type="button" className="ob-btn-skip" onClick={skip}>
              Omitir por ahora
            </button>
            <button type="submit" className="ob-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Agregar y continuar →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
