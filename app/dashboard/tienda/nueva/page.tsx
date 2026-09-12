'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useDashboardStore } from '../../../lib/DashboardStoreProvider'
import PhoneInput from '../../../components/PhoneInput'
import '../tienda.css'

const StoreMapPicker = dynamic(() => import('../StoreMapPicker'), { ssr: false })

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const PRESET_COLORS = [
  '#7C3AED', '#C4B5FD', '#93C5FD', '#6EE7B7', '#FCA5A5',
  '#FCD34D', '#F9A8D4', '#67E8F9', '#D1D5DB', '#0F172A',
]

function toSlug(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

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

export default function NuevaTiendaPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { stores, refreshStores, setActiveStoreId } = useDashboardStore()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugLocked, setSlugLocked] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [color, setColor] = useState('#7C3AED')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [storeAddress, setStoreAddress] = useState('')
  const [storeLat, setStoreLat] = useState<number | null>(null)
  const [storeLng, setStoreLng] = useState<number | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [parentStoreId, setParentStoreId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const logoRef = useRef<HTMLInputElement>(null)
  const customColorRef = useRef<HTMLInputElement>(null)

  // Only top-level stores can take a branch — no nesting a sucursal under
  // another sucursal.
  const parentCandidates = stores.filter(s => !s.parent_store_id)

  function handleNameChange(val: string) {
    setName(val)
    if (!slugLocked) setSlug(toSlug(val))
  }

  async function handleLogoUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setLogoUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `logos/${user.id}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('store-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr
      setLogoUrl(supabase.storage.from('store-assets').getPublicUrl(path).data.publicUrl)
    } catch { setError('No se pudo subir el logo.') }
    setLogoUploading(false)
  }

  function handleDetectLocation() {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setStoreLat(lat); setStoreLng(lng)
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
    setStoreLat(lat); setStoreLng(lng)
    const address = await reverseGeocode(lat, lng)
    if (address) setStoreAddress(address)
  }

  async function handleSave() {
    if (!user || !name.trim() || !slug.trim()) { setError('El nombre y la URL son obligatorios.'); return }
    setSaving(true); setError('')

    // A sucursal starts from its principal's look as a convenience — it's
    // just a starting point, not a lasting link. Everything else (catalog,
    // checkout, diseño) is independent from the moment it's created.
    const parent = parentCandidates.find(s => s.id === parentStoreId)

    const { data, error: err } = await supabase.from('stores').insert({
      owner_id: user.id,
      name: name.trim(),
      slug: slug.trim(),
      whatsapp: whatsapp.trim() || null,
      brand_color: color,
      logo_url: logoUrl || parent?.logo_url || null,
      store_address: storeAddress.trim() || null,
      store_lat: storeLat,
      store_lng: storeLng,
      parent_store_id: parentStoreId || null,
    }).select().single()

    if (err) {
      setError(err.message.includes('slug') ? 'Esa URL ya está en uso, elige otra.' : err.message)
      setSaving(false)
      return
    }

    await refreshStores()
    setActiveStoreId(data.id)
    router.push('/dashboard/productos')
  }

  return (
    <div className="ts-page" style={{ margin: 0 }}>
      <div className="ts-body" style={{ padding: '28px 0 56px' }}>
        <div className="ts-section-title" style={{ marginBottom: 4 }}>Crear tienda</div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>
          Una tienda nueva, con su propio catálogo, diseño y checkout — independiente de las que ya tienes.
        </div>

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
              autoFocus
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

        {/* ── SUCURSAL DE ── */}
        {parentCandidates.length > 0 && (
          <div className="ts-section">
            <div className="ts-section-title">¿Es una sucursal de una tienda existente?</div>
            <div className="ts-field">
              <select
                className="ts-input"
                value={parentStoreId}
                onChange={e => setParentStoreId(e.target.value)}
              >
                <option value="">No, es una tienda independiente</option>
                {parentCandidates.map(s => (
                  <option key={s.id} value={s.id}>Sucursal de {s.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                Una sucursal tiene su propio catálogo, diseño y checkout — solo queda agrupada bajo la tienda principal en tu panel.
              </div>
            </div>
          </div>
        )}

        {/* ── UBICACION ── */}
        <div className="ts-section">
          <div className="ts-section-title">Ubicación (opcional)</div>
          <div className="ts-field" style={{ marginBottom: 10 }}>
            <label className="ts-label">Dirección</label>
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
                Mi ubicación
              </button>
            </div>
          </div>
          <div style={{ height: 220, borderRadius: 16, overflow: 'hidden', border: '1.5px solid rgba(15,23,42,0.08)' }}>
            <StoreMapPicker lat={storeLat} lng={storeLng} mapboxToken={MAPBOX_TOKEN} onLocationChange={handleMapLocationChange} />
          </div>
        </div>

        {/* ── CONTACTO ── */}
        <div className="ts-section">
          <div className="ts-section-title">WhatsApp para recibir pedidos</div>
          <PhoneInput value={whatsapp} onChange={setWhatsapp} />
        </div>

        {/* ── COLOR ── */}
        <div className="ts-section">
          <div className="ts-section-title">Color principal</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '2.5px solid #0F172A' : '2px solid transparent',
                  boxShadow: color === c ? '0 0 0 2px white inset' : undefined,
                }}
              />
            ))}
            <div
              onClick={() => customColorRef.current?.click()}
              style={{
                width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                border: '1.5px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#94A3B8',
                background: PRESET_COLORS.includes(color) ? 'transparent' : color,
              }}
            >
              {PRESET_COLORS.includes(color) ? '+' : ''}
            </div>
            <input
              ref={customColorRef} type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ position: 'fixed', top: -100, left: -100, width: 1, height: 1, opacity: 0 }}
            />
          </div>
        </div>

        {error && <div className="ts-error">{error}</div>}

        <div className="ts-actions">
          <button className="ts-save-btn" onClick={handleSave} disabled={saving || logoUploading}>
            {saving ? 'Creando...' : 'Crear tienda'}
          </button>
        </div>
      </div>
    </div>
  )
}
