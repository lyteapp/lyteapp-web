'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import PhoneInput from '../../components/PhoneInput'
import './tienda.css'

const StoreMapPicker = dynamic(() => import('./StoreMapPicker'), { ssr: false })

type Store = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  whatsapp: string | null
  instagram: string | null
  store_address: string | null
  store_lat: number | null
  store_lng: number | null
  template_config?: Record<string, unknown> | null
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim() || !MAPBOX_TOKEN) return null
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
  const res = await fetch(url)
  const data = await res.json()
  if (data.features?.length > 0) {
    const [lng, lat] = data.features[0].center as [number, number]
    return { lat, lng }
  }
  return null
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`
  const res = await fetch(url)
  const data = await res.json()
  if (data.features?.length > 0) return data.features[0].place_name as string
  return null
}

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
  const [showWhatsapp, setShowWhatsapp] = useState(true)
  const [showInstagram, setShowInstagram] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [pwaIconUrl, setPwaIconUrl] = useState('')
  const [logoUploading, setLogoUploading]   = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [pwaIconUploading, setPwaIconUploading] = useState(false)
  const [storeAddress, setStoreAddress]     = useState('')
  const [storeLat, setStoreLat]             = useState<number | null>(null)
  const [storeLng, setStoreLng]             = useState<number | null>(null)
  const [locLoading, setLocLoading]         = useState(false)

  const logoRef   = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const pwaIconRef = useRef<HTMLInputElement>(null)

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
        setShowWhatsapp(data.template_config?.showWhatsapp !== false)
        setShowInstagram(data.template_config?.showInstagram !== false)
        setLogoUrl(data.logo_url ?? '')
        setBannerUrl(data.banner_url ?? '')
        setPwaIconUrl((data.template_config?.pwaIconUrl as string | undefined) ?? '')
        setStoreAddress(data.store_address ?? '')
        setStoreLat(data.store_lat ?? null)
        setStoreLng(data.store_lng ?? null)
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

  async function handlePwaIconUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file) return
    setPwaIconUploading(true)
    try { setPwaIconUrl(await uploadFile(file, 'store-assets', 'pwa-icons')) }
    catch { setError('No se pudo subir el icono.') }
    setPwaIconUploading(false)
  }

  async function handleDetectLocation() {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setStoreLat(lat)
        setStoreLng(lng)
        const address = await reverseGeocode(lat, lng)
        if (address) setStoreAddress(address)
        setLocLoading(false)
      },
      () => setLocLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleAddressBlur() {
    if (!storeAddress.trim()) { setStoreLat(null); setStoreLng(null); return }
    const coords = await geocodeAddress(storeAddress)
    if (coords) { setStoreLat(coords.lat); setStoreLng(coords.lng) }
  }

  async function handleMapLocationChange(lat: number, lng: number) {
    setStoreLat(lat)
    setStoreLng(lng)
    const address = await reverseGeocode(lat, lng)
    if (address) setStoreAddress(address)
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
      store_address: storeAddress.trim() || null,
      store_lat: storeLat,
      store_lng: storeLng,
      template_config: {
        ...(store?.template_config && typeof store.template_config === 'object' ? store.template_config : {}),
        showWhatsapp,
        showInstagram,
        pwaIconUrl: pwaIconUrl || undefined,
      },
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
      <input ref={pwaIconRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePwaIconUpload} />

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

            <div className="ts-photo-card" onClick={() => pwaIconRef.current?.click()}>
              <div className="ts-photo-preview ts-photo-square">
                {pwaIconUrl
                  ? <img src={pwaIconUrl} alt="Icono" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                  : <div className="ts-photo-empty"><span>📲</span><span>Icono</span></div>
                }
                {pwaIconUploading && <div className="ts-photo-uploading">Subiendo...</div>}
              </div>
              <div className="ts-photo-info">
                <div className="ts-photo-label">Icono para pantalla de inicio</div>
                <div className="ts-photo-hint">Se usa al guardar o descargar la tienda como app · cuadrado, fondo solido, mín. 512×512. Si no subes uno, se usa el logo.</div>
                <button className="ts-photo-btn" onClick={e => { e.stopPropagation(); pwaIconRef.current?.click() }}>
                  {pwaIconUrl ? 'Cambiar icono' : 'Subir icono'}
                </button>
                {pwaIconUrl && (
                  <button
                    className="ts-photo-btn"
                    style={{ marginTop: 6, background: 'transparent', color: '#DC2626' }}
                    onClick={e => { e.stopPropagation(); setPwaIconUrl('') }}
                  >
                    Quitar y usar el logo
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── DESCRIPCIÓN ── */}
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

        {/* ── UBICACION ── */}
        <div className="ts-section">
          <div className="ts-section-title">Ubicacion de la tienda</div>
          <div className="ts-field" style={{ marginBottom: 10 }}>
            <label className="ts-label">Direccion</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="ts-input"
                style={{ flex: 1, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12, padding: '12px 14px' }}
                placeholder="Ej: Av. Libertador 1234, Caracas"
                value={storeAddress}
                onChange={e => { setStoreAddress(e.target.value); setStoreLat(null); setStoreLng(null) }}
                onBlur={handleAddressBlur}
              />
              <button
                type="button"
                className="ts-photo-btn"
                style={{ flexShrink: 0, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, height: 46 }}
                onClick={handleDetectLocation}
                disabled={locLoading}
                title="Detectar mi ubicacion"
              >
                {locLoading
                  ? <div className="ts-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  : (
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  )
                }
                Mi ubicacion
              </button>
            </div>
          </div>

          {/* Interactive map */}
          <div style={{
            height: 280, borderRadius: 16, overflow: 'hidden',
            border: '1.5px solid rgba(15,23,42,0.08)',
            boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
          }}>
            <StoreMapPicker
              lat={storeLat}
              lng={storeLng}
              mapboxToken={MAPBOX_TOKEN}
              onLocationChange={handleMapLocationChange}
            />
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
            Haz clic en el mapa o arrastra el pin para ajustar la posicion exacta
          </div>
        </div>

        {/* ── CONTACTO ── */}
        <div className="ts-section">
          <div className="ts-section-title">Contacto y redes</div>
          <div className="ts-two-col">
            <div className="ts-field">
              <div className="ts-field-header">
                <label className="ts-label">WhatsApp</label>
                <label className="ts-toggle">
                  <input type="checkbox" checked={showWhatsapp} onChange={e => setShowWhatsapp(e.target.checked)} />
                  <span className="ts-toggle-track" />
                  <span className="ts-toggle-label-text">{showWhatsapp ? 'Visible' : 'Oculto'}</span>
                </label>
              </div>
              <PhoneInput value={whatsapp} onChange={setWhatsapp} />
            </div>
            <div className="ts-field">
              <div className="ts-field-header">
                <label className="ts-label">Instagram</label>
                <label className="ts-toggle">
                  <input type="checkbox" checked={showInstagram} onChange={e => setShowInstagram(e.target.checked)} />
                  <span className="ts-toggle-track" />
                  <span className="ts-toggle-label-text">{showInstagram ? 'Visible' : 'Oculto'}</span>
                </label>
              </div>
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
          <button className="ts-save-btn" onClick={handleSave} disabled={saving || logoUploading || bannerUploading || pwaIconUploading}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : store ? 'Guardar cambios' : 'Crear tienda'}
          </button>
        </div>
      </div>
    </div>
  )
}
