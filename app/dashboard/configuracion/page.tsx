'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import PhoneInput from '../../components/PhoneInput'
import './configuracion.css'

// ── SECTION HEADER ─────────────────────────────────────────────
function SectionHeader({ title, desc, open, onToggle, saved }: {
  title: string; desc: string
  open: boolean; onToggle: () => void; saved?: boolean
}) {
  return (
    <div className="cf-section-header" onClick={onToggle}>
      <div className="cf-section-left">
        <div>
          <div className="cf-section-title">{title}</div>
          <div className="cf-section-desc">{desc}</div>
        </div>
      </div>
      <div className="cf-section-right">
        {saved && <span className="cf-saved-badge">Guardado</span>}
        <svg className={`cf-chevron${open ? ' open' : ''}`} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </div>
    </div>
  )
}

// ── SAVE BUTTON ────────────────────────────────────────────────
function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button className="cf-save-btn" onClick={onClick} disabled={saving}>
      {saving ? 'Guardando…' : 'Guardar cambios'}
    </button>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────
function ConfiguracionInner() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<string>(() => searchParams.get('section') ?? 'general')

  // General
  const [storeName, setStoreName] = useState('')
  const [slug, setSlug] = useState('')
  const [storeEmail, setStoreEmail] = useState('')
  const [storeLocation, setStoreLocation] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsapp2, setWhatsapp2] = useState('')
  const [country, setCountry] = useState('')
  const [storeLanguage, setStoreLanguage] = useState('default')
  const [storeCurrency, setStoreCurrency] = useState('USD')
  const [operatingHours, setOperatingHours] = useState<Record<string, { open: boolean; start: string; end: string }>>(() => {
    const days = ['mon','tue','wed','thu','fri','sat','sun']
    return Object.fromEntries(days.map(d => [d, { open: false, start: '09:00', end: '18:00' }]))
  })
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    whatsapp_community: '', telegram: '', instagram: '', facebook: '', x: ''
  })
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savedGeneral, setSavedGeneral] = useState(false)

  const [error, setError] = useState('')

  useEffect(() => {
    const section = searchParams.get('section')
    if (section) setOpenSection(section)
  }, [searchParams])

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: store, error: storeErr } = await supabase
        .from('stores').select('id,name,slug,city,email,map_url,whatsapp,whatsapp2,country,store_language,operating_hours,social_links')
        .eq('owner_id', user!.id).maybeSingle()

      if (storeErr) { setError(storeErr.message); setLoading(false); return }

      if (store) {
        setStoreId(store.id)
        setStoreName(store.name ?? '')
        setSlug(store.slug ?? '')
        setStoreEmail((store as any).email ?? '')
        setStoreLocation((store as any).city ?? '')
        setMapUrl((store as any).map_url ?? '')
        setWhatsapp(store.whatsapp ?? '')
        setWhatsapp2((store as any).whatsapp2 ?? '')
        setCountry((store as any).country ?? '')
        setStoreLanguage((store as any).store_language ?? 'default')
        setStoreCurrency((store as any).store_currency ?? 'USD')
        const oh = (store as any).operating_hours
        if (oh && typeof oh === 'object') setOperatingHours(oh)
        const sl = (store as any).social_links
        if (sl && typeof sl === 'object') setSocialLinks(prev => ({ ...prev, ...sl }))

      }
      setLoading(false)
    }
    load()
  }, [user])

  function flash(set: (v: boolean) => void) {
    set(true); setTimeout(() => set(false), 3000)
  }

  async function saveGeneral() {
    if (!storeId) return
    setSavingGeneral(true); setError('')
    const { error: err } = await supabase.from('stores').update({
      name: storeName.trim() || null,
      slug: slug.trim().toLowerCase().replace(/\s+/g, '-') || null,
      email: storeEmail.trim() || null,
      city: storeLocation.trim() || null,
      map_url: mapUrl.trim() || null,
      whatsapp: whatsapp || null,
      whatsapp2: whatsapp2 || null,
      country: country.trim() || null,
      store_language: storeLanguage,
      store_currency: storeCurrency,
      operating_hours: operatingHours,
      social_links: socialLinks,
    }).eq('id', storeId)
    setSavingGeneral(false)
    if (err) { setError(err.message); return }
    flash(setSavedGeneral)
  }

  function toggleSection(s: string) { setOpenSection(prev => prev === s ? '' : s) }

  if (loading) return <div className="cf-spinner-wrap"><div className="cf-spinner" /></div>
  if (!storeId) return (
    <div className="cf-spinner-wrap" style={{ flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32, color: '#94A3B8' }}>—</div>
      <div style={{ fontWeight: 700, color: '#0F172A' }}>Configura tu tienda primero</div>
      <div style={{ fontSize: 13, color: '#94A3B8' }}>Ve a Mi tienda para empezar</div>
    </div>
  )

  return (
    <div className="cf-wrap">
      {error && <div className="cf-error">{error}</div>}

      {/* ── GENERAL ── */}
      <div className="cf-card">
        <SectionHeader title="General" desc="Información básica de tu negocio" open={openSection === 'general'} onToggle={() => toggleSection('general')} saved={savedGeneral} />
        {openSection === 'general' && (
          <div className="cf-card-body">

            {/* Business info */}
            <div className="cf-group-label">Información del negocio</div>

            <div className="cf-field">
              <label className="cf-label">Nombre del negocio</label>
              <input className="cf-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Ej: Dulcería Mafer" />
            </div>

            <div className="cf-field">
              <label className="cf-label">Link del negocio</label>
              <div className="cf-slug-wrap">
                <span className="cf-slug-prefix">lyte-app.com/</span>
                <input
                  className="cf-input cf-slug-input"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="mi-tienda"
                />
              </div>
            </div>

            <div className="cf-field">
              <label className="cf-label">Correo del negocio</label>
              <input className="cf-input" type="email" value={storeEmail} onChange={e => setStoreEmail(e.target.value)} placeholder="contacto@minegocio.com" />
            </div>

            <div className="cf-field">
              <label className="cf-label">Ubicación del negocio</label>
              <input className="cf-input" value={storeLocation} onChange={e => setStoreLocation(e.target.value)} placeholder="Ej: Las Mercedes, Caracas" />
            </div>

            <div className="cf-field">
              <label className="cf-label">URL del mapa</label>
              <input className="cf-input" value={mapUrl} onChange={e => setMapUrl(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>

            {/* WhatsApp */}
            <div className="cf-group-label" style={{ marginTop: 6 }}>WhatsApp</div>

            <div className="cf-field">
              <label className="cf-label">Número principal (recibe pedidos)</label>
              <PhoneInput value={whatsapp} onChange={setWhatsapp} />
            </div>

            <div className="cf-field">
              <label className="cf-label">Número adicional (opcional)</label>
              <PhoneInput value={whatsapp2} onChange={setWhatsapp2} />
            </div>

            {/* Region & language */}
            <div className="cf-group-label" style={{ marginTop: 6 }}>Región e idioma</div>

            <div className="cf-two-col">
              <div className="cf-field">
                <label className="cf-label">País / Región</label>
                <input className="cf-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="Ej: Venezuela" />
              </div>
              <div className="cf-field">
                <label className="cf-label">Idioma de la tienda</label>
                <select className="cf-input cf-select" value={storeLanguage} onChange={e => setStoreLanguage(e.target.value)}>
                  <option value="default">Default del sistema</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            {/* Currency */}
            <div className="cf-group-label" style={{ marginTop: 6 }}>Moneda de venta</div>
            <div className="cf-two-col">
              <div className="cf-field">
                <label className="cf-label">Moneda</label>
                <select className="cf-input cf-select" value={storeCurrency} onChange={e => setStoreCurrency(e.target.value)}>
                  <option value="USD">Dólar americano (USD $)</option>
                  <option value="EUR">Euro (EUR €)</option>
                </select>
                <span style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  Los precios de la tienda se muestran en esta moneda. En el checkout se muestra la equivalencia en Bs según la tasa BCV del dia.
                </span>
              </div>
            </div>

            {/* Operating hours */}
            <div className="cf-group-label" style={{ marginTop: 6 }}>Horas operativas</div>

            <div className="cf-hours-grid">
              {[
                { key: 'mon', label: 'Lunes' },
                { key: 'tue', label: 'Martes' },
                { key: 'wed', label: 'Miércoles' },
                { key: 'thu', label: 'Jueves' },
                { key: 'fri', label: 'Viernes' },
                { key: 'sat', label: 'Sábado' },
                { key: 'sun', label: 'Domingo' },
              ].map(({ key, label }) => {
                const day = operatingHours[key] ?? { open: false, start: '09:00', end: '18:00' }
                return (
                  <div key={key} className={`cf-hours-row${day.open ? ' cf-hours-open' : ''}`}>
                    <button
                      className={`cf-toggle${day.open ? ' on' : ''}`}
                      onClick={() => setOperatingHours(prev => ({ ...prev, [key]: { ...day, open: !day.open } }))}
                    >
                      <div className="cf-toggle-knob" />
                    </button>
                    <span className="cf-hours-day">{label}</span>
                    {day.open ? (
                      <div className="cf-hours-times">
                        <input
                          type="time"
                          className="cf-input cf-time-input"
                          value={day.start}
                          onChange={e => setOperatingHours(prev => ({ ...prev, [key]: { ...day, start: e.target.value } }))}
                        />
                        <span className="cf-hours-sep">—</span>
                        <input
                          type="time"
                          className="cf-input cf-time-input"
                          value={day.end}
                          onChange={e => setOperatingHours(prev => ({ ...prev, [key]: { ...day, end: e.target.value } }))}
                        />
                      </div>
                    ) : (
                      <span className="cf-hours-closed">Cerrado</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Communities / Social */}
            <div className="cf-group-label" style={{ marginTop: 6 }}>Comunidades y redes sociales</div>

            {[
              { key: 'whatsapp_community', label: 'WhatsApp Community', placeholder: 'https://chat.whatsapp.com/...' },
              { key: 'telegram', label: 'Telegram', placeholder: '@micanal o https://t.me/...' },
              { key: 'instagram', label: 'Instagram', placeholder: '@mitienda' },
              { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
              { key: 'x', label: 'X (Twitter)', placeholder: '@mitienda' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="cf-field">
                <label className="cf-label">{label}</label>
                <input
                  className="cf-input"
                  value={socialLinks[key] ?? ''}
                  onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                />
              </div>
            ))}

            <SaveBtn saving={savingGeneral} onClick={saveGeneral} />
          </div>
        )}
      </div>

    </div>
  )
}

export default function ConfiguracionPage() {
  return (
    <Suspense>
      <ConfiguracionInner />
    </Suspense>
  )
}
