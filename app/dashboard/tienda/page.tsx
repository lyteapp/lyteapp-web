'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import PhoneInput from '../../components/PhoneInput'
import './tienda.css'

type Store = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  whatsapp: string | null
  instagram: string | null
  template: string | null
}

const TEMPLATES = [
  {
    id: 'clasico',
    name: 'Clásico',
    desc: 'Blanco, limpio, rejilla de productos',
    preview: (
      <div style={{ background: '#FAFAF9', borderRadius: 10, padding: 10, height: '100%' }}>
        <div style={{ background: 'white', borderRadius: 6, height: 22, marginBottom: 8, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#E2E8F0' }} />
          <div style={{ flex: 1, height: 6, borderRadius: 100, background: '#E2E8F0' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 6, overflow: 'hidden', border: '1px solid #F1F5F9' }}>
              <div style={{ background: '#F1F5F9', aspectRatio: '1' }} />
              <div style={{ padding: '4px 5px' }}>
                <div style={{ height: 4, background: '#E2E8F0', borderRadius: 100, marginBottom: 3 }} />
                <div style={{ height: 4, background: '#7C3AED', borderRadius: 100, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'oscuro',
    name: 'Oscuro',
    desc: 'Fondo negro, elegante y moderno',
    preview: (
      <div style={{ background: '#0F172A', borderRadius: 10, padding: 10, height: '100%' }}>
        <div style={{ background: '#1E293B', borderRadius: 6, height: 22, marginBottom: 8, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#334155' }} />
          <div style={{ flex: 1, height: 6, borderRadius: 100, background: '#334155' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: '#1E293B', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ background: '#334155', aspectRatio: '1' }} />
              <div style={{ padding: '4px 5px' }}>
                <div style={{ height: 4, background: '#475569', borderRadius: 100, marginBottom: 3 }} />
                <div style={{ height: 4, background: '#C4B5FD', borderRadius: 100, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Lista limpia, precio al frente',
    preview: (
      <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 10, height: '100%' }}>
        <div style={{ background: 'white', borderRadius: 6, height: 22, marginBottom: 8, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#F1F5F9' }} />
          <div style={{ flex: 1, height: 6, borderRadius: 100, background: '#F1F5F9' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 6, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 5, background: '#F1F5F9', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 4, background: '#E2E8F0', borderRadius: 100, marginBottom: 3, width: '70%' }} />
                <div style={{ height: 4, background: '#0F172A', borderRadius: 100, width: '35%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

function toSlug(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export default function TiendaPage() {
  const { user } = useAuth()
  const [store, setStore] = useState<Store | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugLocked, setSlugLocked] = useState(false)
  const [description, setDescription] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [template, setTemplate] = useState('clasico')
  const [logoUploading, setLogoUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)

  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('*').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setStore(data)
        setName(data.name ?? '')
        setSlug(data.slug ?? '')
        setSlugLocked(true)
        setDescription(data.description ?? '')
        setWhatsapp(data.whatsapp ?? '')
        setInstagram(data.instagram ?? '')
        setLogoUrl(data.logo_url ?? '')
        setBannerUrl(data.banner_url ?? '')
        setTemplate(data.template ?? 'clasico')
      }
      setPageLoading(false)
    })
  }, [user])

  function handleNameChange(val: string) {
    setName(val)
    if (!slugLocked) setSlug(toSlug(val))
  }

  async function uploadFile(file: File, bucket: string, folder: string) {
    const ext = file.name.split('.').pop()
    const path = `${folder}/${user!.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  async function handleLogoUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try { setLogoUrl(await uploadFile(file, 'store-assets', 'logos')) }
    catch { setError('No se pudo subir el logo.') }
    setLogoUploading(false)
  }

  async function handleBannerUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerUploading(true)
    try { setBannerUrl(await uploadFile(file, 'store-assets', 'banners')) }
    catch { setError('No se pudo subir el banner.') }
    setBannerUploading(false)
  }

  async function handleSave() {
    if (!user || !name.trim() || !slug.trim()) { setError('El nombre y la URL son obligatorios.'); return }
    setSaving(true); setError('')
    const payload = {
      owner_id: user.id,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      whatsapp: whatsapp.trim() || null,
      instagram: instagram.trim() || null,
      logo_url: logoUrl || null,
      banner_url: bannerUrl || null,
      template,
    }
    const { error: err, data } = store
      ? await supabase.from('stores').update(payload).eq('id', store.id).select().single()
      : await supabase.from('stores').insert(payload).select().single()

    if (err) {
      setError(err.message.includes('slug') ? 'Esa URL ya está en uso, elige otra.' : err.message)
    } else {
      setStore(data)
      setSlugLocked(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (pageLoading) return (
    <div className="ts-spinner-wrap"><div className="ts-spinner" /></div>
  )

  return (
    <div className="ts-page">

      {/* ── BANNER ── */}
      <div className="ts-banner" onClick={() => bannerRef.current?.click()}>
        {bannerUrl
          ? <img src={bannerUrl} alt="Banner" className="ts-banner-img" />
          : (
            <div className="ts-banner-empty">
              <div className="ts-up-icon">🖼️</div>
              <div className="ts-up-text">Subir banner</div>
              <div className="ts-up-hint">Recomendado 1200 × 400 px · JPG o PNG</div>
            </div>
          )
        }
        {bannerUploading && <div className="ts-overlay">Subiendo...</div>}
        {bannerUrl && !bannerUploading && <div className="ts-banner-hint">Haz clic para cambiar el banner</div>}
      </div>
      <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />

      <div className="ts-body">

        {/* ── LOGO + NAME ── */}
        <div className="ts-identity">
          <div className="ts-logo-btn" onClick={() => logoRef.current?.click()}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="ts-logo-img" />
              : <div className="ts-logo-empty"><span style={{ fontSize: 22 }}>+</span><span style={{ fontSize: 11 }}>Logo</span></div>
            }
            {logoUploading && <div className="ts-overlay ts-overlay-round">...</div>}
            <div className="ts-logo-hover">✏️</div>
          </div>
          <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />

          <div className="ts-name-block">
            <input
              type="text"
              className="ts-name-input"
              placeholder="Nombre de tu tienda"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
            />
            <div className="ts-slug-row">
              <span className="ts-slug-base">lyte-app.com/</span>
              <input
                type="text"
                className="ts-slug-input"
                placeholder="mi-tienda"
                value={slug}
                onChange={e => { setSlug(toSlug(e.target.value)); setSlugLocked(true) }}
              />
            </div>
          </div>
        </div>

        {/* ── FOTOS ── */}
        <div className="ts-section">
          <div className="ts-section-title">Fotos de la tienda</div>
          <div className="ts-photos-grid">

            {/* Logo upload */}
            <div className="ts-photo-card" onClick={() => logoRef.current?.click()}>
              <div className="ts-photo-preview ts-photo-square">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }} />
                  : <div className="ts-photo-empty"><span>🏪</span><span>Logo</span></div>
                }
                {logoUploading && <div className="ts-photo-uploading">Subiendo...</div>}
              </div>
              <div className="ts-photo-info">
                <div className="ts-photo-label">Logo de la tienda</div>
                <div className="ts-photo-hint">Cuadrado · PNG con fondo transparente · mín. 200×200</div>
                <button className="ts-photo-btn" onClick={e => { e.stopPropagation(); logoRef.current?.click() }}>
                  {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                </button>
              </div>
            </div>

            {/* Banner upload */}
            <div className="ts-photo-card" onClick={() => bannerRef.current?.click()}>
              <div className="ts-photo-preview ts-photo-wide">
                {bannerUrl
                  ? <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                  : <div className="ts-photo-empty"><span>🖼️</span><span>Banner</span></div>
                }
                {bannerUploading && <div className="ts-photo-uploading">Subiendo...</div>}
              </div>
              <div className="ts-photo-info">
                <div className="ts-photo-label">Banner principal</div>
                <div className="ts-photo-hint">Horizontal · JPG o PNG · recomendado 1200×400</div>
                <button className="ts-photo-btn" onClick={e => { e.stopPropagation(); bannerRef.current?.click() }}>
                  {bannerUrl ? 'Cambiar banner' : 'Subir banner'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ── TEMPLATE ── */}
        <div className="ts-section">
          <div className="ts-section-title">Diseño de tu tienda</div>
          <div className="ts-template-grid">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                className={`ts-template-card${template === t.id ? ' selected' : ''}`}
                onClick={() => setTemplate(t.id)}
              >
                <div className="ts-template-preview">{t.preview}</div>
                <div className="ts-template-foot">
                  <div className="ts-template-name">{t.name}</div>
                  <div className="ts-template-desc">{t.desc}</div>
                </div>
                {template === t.id && <div className="ts-template-check">✓</div>}
              </button>
            ))}
          </div>
        </div>

        {/* ── INFORMACIÓN ── */}
        <div className="ts-section">
          <div className="ts-section-title">Descripción</div>
          <textarea
            className="ts-textarea"
            placeholder="Cuéntale a tus clientes qué vendes..."
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="ts-section">
          <div className="ts-section-title">Contacto y redes</div>
          <div className="ts-two-col">
            <div className="ts-field">
              <label className="ts-label">WhatsApp</label>
              <PhoneInput value={whatsapp} onChange={setWhatsapp} />
            </div>
            <div className="ts-field">
              <label className="ts-label">Instagram</label>
              <div className="ts-prefix-wrap">
                <span className="ts-prefix">@</span>
                <input type="text" className="ts-input" placeholder="mi_tienda" value={instagram} onChange={e => setInstagram(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="ts-error">{error}</div>}

        <div className="ts-actions">
          {store && (
            <Link href={`/${store.slug}`} target="_blank" className="ts-ghost-btn">Ver mi tienda →</Link>
          )}
          <button className="ts-save-btn" onClick={handleSave} disabled={saving || logoUploading || bannerUploading}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : store ? 'Guardar cambios' : 'Crear tienda'}
          </button>
        </div>
      </div>
    </div>
  )
}
