'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import PhoneInput from '../../components/PhoneInput'

const STEPS = 6

const PRESET_COLORS = [
  '#C4B5FD', '#93C5FD', '#6EE7B7', '#FCA5A5',
  '#FCD34D', '#F9A8D4', '#67E8F9', '#D1D5DB',
]

function toSlug(name: string) {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function TiendaOnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [color, setColor] = useState('#C4B5FD')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const customColorRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: { target: { files: FileList | null } }) {
    const f = e.target.files?.[0]
    if (!f) return
    setLogoFile(f)
    const url = URL.createObjectURL(f)
    setLogoPreview(url)
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    if (!name.trim()) { setError('El nombre de la tienda es obligatorio.'); return }
    setError('')
    setSaving(true)

    try {
      const slug = toSlug(name)

      let logo_url: string | null = null
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${user.id}/logo.${ext}`
        await supabase.storage.from('store-assets').upload(path, logoFile, { upsert: true, contentType: logoFile.type })
        const { data: pub } = supabase.storage.from('store-assets').getPublicUrl(path)
        logo_url = pub.publicUrl
      }

      const { data: existing } = await supabase
        .from('stores').select('id').eq('owner_id', user.id).maybeSingle()

      const payload = {
        name: name.trim(),
        slug,
        whatsapp: phone.replace(/\D/g, '') || null,
        brand_color: color,
        ...(logo_url ? { logo_url } : {}),
      }

      let err
      if (existing) {
        const { error: e } = await supabase.from('stores').update(payload).eq('id', existing.id)
        err = e
      } else {
        const { error: e } = await supabase.from('stores').insert({ owner_id: user.id, ...payload })
        err = e
      }

      if (err) { setError(err.message); setSaving(false); return }

      localStorage.setItem('ob_slug', slug)
      router.push('/onboarding/productos')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
    setSaving(false)
  }

  const storeName = name.trim() || 'Mi Tienda'

  return (
    <div className="ob-screen">
      <div className="ob-brand">Lyte<span>app</span></div>

      <div className="ob-progress">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className={`ob-dot ${i === 2 ? 'active' : i < 2 ? 'done' : ''}`} />
        ))}
      </div>

      <div className="ob-card">
        <div className="ob-step-label">Paso 3 de {STEPS}</div>
        <h1 className="ob-title">Crea tu tienda</h1>
        <p className="ob-sub">Dale nombre y personalidad. Puedes cambiar todo esto después.</p>

        <form onSubmit={handleSubmit}>
          {/* Logo */}
          <div className="ob-field">
            <label className="ob-label">Logo (opcional)</label>
            <div
              className="ob-img-upload"
              style={{ maxWidth: 120, height: 120, aspectRatio: '1', borderRadius: 16 }}
              onClick={() => fileRef.current?.click()}
            >
              {logoPreview
                ? <Image src={logoPreview} alt="logo" fill style={{ objectFit: 'cover' }} />
                : (
                  <div className="ob-img-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28, color: '#CBD5E1' }} className="ob-img-empty-icon"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    <span className="ob-img-empty-label">Subir logo</span>
                  </div>
                )
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
          </div>

          {/* Name */}
          <div className="ob-field">
            <label className="ob-label">Nombre de la tienda *</label>
            <input
              className="ob-input"
              placeholder="Ej: Dulcería Mafer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            {name.trim() && (
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                Tu URL: <span style={{ color: '#7C3AED', fontWeight: 600 }}>lyte-app.com/{toSlug(name)}</span>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="ob-field">
            <label className="ob-label">WhatsApp para recibir pedidos</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>

          {/* Color */}
          <div className="ob-field">
            <label className="ob-label">Color principal de tu tienda</label>
            <div className="ob-color-row">
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  className={`ob-color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <div
                className={`ob-color-custom${!PRESET_COLORS.includes(color) ? ' selected' : ''}`}
                style={{ background: PRESET_COLORS.includes(color) ? 'transparent' : color }}
                onClick={() => customColorRef.current?.click()}
              >
                {PRESET_COLORS.includes(color) ? '＋' : ''}
              </div>
              <input
                ref={customColorRef}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ position: 'fixed', top: '-100px', left: '-100px', width: '1px', height: '1px', opacity: 0 }}
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="ob-preview" style={{ background: `${color}08` }}>
            <div className="ob-preview-label">Vista previa</div>
            <div className="ob-preview-bar">
              <div className="ob-preview-logo" style={{ background: color }}>
                {storeName.slice(0, 1).toUpperCase()}
              </div>
              <div className="ob-preview-name">{storeName}</div>
              <div style={{ marginLeft: 'auto' }}>
                <div className="ob-preview-btn" style={{ background: color }}>Ver tienda</div>
              </div>
            </div>
            <div className="ob-preview-dots">
              {[1, 0.5, 0.25].map((o, i) => (
                <div key={i} className="ob-preview-dot" style={{ background: color, opacity: o }} />
              ))}
            </div>
          </div>

          {error && <div className="ob-error">{error}</div>}

          <div className="ob-actions">
            <button type="button" className="ob-btn-skip" onClick={() => router.push('/onboarding/productos')}>
              Omitir por ahora
            </button>
            <button type="submit" className="ob-btn-primary" disabled={saving}>
              {saving ? 'Creando tienda...' : 'Crear tienda →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
