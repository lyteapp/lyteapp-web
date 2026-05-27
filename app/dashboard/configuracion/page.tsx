'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import PhoneInput from '../../components/PhoneInput'
import './configuracion.css'

// ── PAYMENT METHODS ────────────────────────────────────────────
interface PaymentMethod {
  id: string; name: string; icon: string; enabled: boolean
  fields: { key: string; label: string; placeholder: string }[]
  values: Record<string, string>
}
const METHODS: Omit<PaymentMethod, 'enabled' | 'values'>[] = [
  { id: 'pago_movil', name: 'Pago Móvil', icon: 'PM', fields: [
    { key: 'banco', label: 'Banco', placeholder: 'Ej: Banesco' },
    { key: 'cedula', label: 'Cédula / RIF', placeholder: 'Ej: V-12345678' },
    { key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 0414-1234567' },
  ]},
  { id: 'zelle', name: 'Zelle', icon: 'ZL', fields: [
    { key: 'email', label: 'Email o teléfono', placeholder: 'nombre@email.com' },
    { key: 'titular', label: 'Nombre del titular', placeholder: 'Juan Pérez' },
  ]},
  { id: 'usdt', name: 'USDT / Cripto', icon: 'CR', fields: [
    { key: 'red', label: 'Red', placeholder: 'Ej: TRC20 (Tron)' },
    { key: 'wallet', label: 'Wallet / Dirección', placeholder: 'TXxx...' },
  ]},
  { id: 'efectivo', name: 'Efectivo', icon: 'EF', fields: [
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Pago al momento de entrega' },
  ]},
  { id: 'transferencia', name: 'Transferencia bancaria', icon: 'TB', fields: [
    { key: 'banco', label: 'Banco', placeholder: 'Ej: Mercantil' },
    { key: 'cuenta', label: 'Nº de cuenta', placeholder: '0105-0000-00-0000000000' },
    { key: 'titular', label: 'Titular', placeholder: 'Juan Pérez' },
    { key: 'rif', label: 'Cédula / RIF', placeholder: 'V-12345678' },
  ]},
  { id: 'binance', name: 'Binance Pay', icon: 'BN', fields: [
    { key: 'id', label: 'Binance ID / Pay ID', placeholder: 'Ej: 123456789' },
  ]},
  { id: 'punto_venta', name: 'Punto de venta', icon: 'PV', fields: [
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Ej: Disponible en local' },
  ]},
]

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
  const [operatingHours, setOperatingHours] = useState<Record<string, { open: boolean; start: string; end: string }>>(() => {
    const days = ['mon','tue','wed','thu','fri','sat','sun']
    return Object.fromEntries(days.map(d => [d, { open: false, start: '09:00', end: '18:00' }]))
  })
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    whatsapp_community: '', telegram: '', instagram: '', facebook: '', x: ''
  })
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savedGeneral, setSavedGeneral] = useState(false)

  // Pagos
  const [methods, setMethods] = useState<PaymentMethod[]>(() =>
    METHODS.map(m => ({ ...m, enabled: false, values: {} }))
  )
  const [openMethod, setOpenMethod] = useState<string | null>(null)
  const [savingPagos, setSavingPagos] = useState(false)
  const [savedPagos, setSavedPagos] = useState(false)

  // Delivery
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [deliveryZone, setDeliveryZone] = useState('')
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [savedDelivery, setSavedDelivery] = useState(false)

  const [error, setError] = useState('')

  useEffect(() => {
    const section = searchParams.get('section')
    if (section) setOpenSection(section)
  }, [searchParams])

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: store, error: storeErr } = await supabase
        .from('stores').select('id,name,slug,city,email,map_url,whatsapp,whatsapp2,country,store_language,operating_hours,social_links,payment_methods,checkout_settings')
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
        const oh = (store as any).operating_hours
        if (oh && typeof oh === 'object') setOperatingHours(oh)
        const sl = (store as any).social_links
        if (sl && typeof sl === 'object') setSocialLinks(prev => ({ ...prev, ...sl }))

        const pm = store.payment_methods ?? {}
        setMethods(prev => prev.map(m => {
          const s = pm[m.id]
          return s ? { ...m, enabled: s.enabled ?? false, values: s.values ?? {} } : m
        }))

        const cs = store.checkout_settings ?? {}
        setDeliveryEnabled(cs.deliveryEnabled ?? false)
        setDeliveryFee(cs.deliveryFee ? String(cs.deliveryFee) : '')
        setDeliveryTime(cs.deliveryTime ?? '')
        setDeliveryZone(cs.deliveryZone ?? '')
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
      operating_hours: operatingHours,
      social_links: socialLinks,
    }).eq('id', storeId)
    setSavingGeneral(false)
    if (err) { setError(err.message); return }
    flash(setSavedGeneral)
  }

  async function savePagos() {
    if (!storeId) return
    setSavingPagos(true); setError('')
    const pm: Record<string, { enabled: boolean; values: Record<string, string> }> = {}
    for (const m of methods) pm[m.id] = { enabled: m.enabled, values: m.values }
    const { error: err } = await supabase.from('stores').update({ payment_methods: pm }).eq('id', storeId)
    setSavingPagos(false)
    if (err) { setError(err.message); return }
    flash(setSavedPagos)
  }

  async function saveDelivery() {
    if (!storeId) return
    setSavingDelivery(true); setError('')
    const { data: store } = await supabase.from('stores').select('checkout_settings').eq('id', storeId).maybeSingle()
    const cs = { ...(store?.checkout_settings ?? {}), deliveryEnabled, deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null, deliveryTime: deliveryTime.trim() || null, deliveryZone: deliveryZone.trim() || null }
    const { error: err } = await supabase.from('stores').update({ checkout_settings: cs }).eq('id', storeId)
    setSavingDelivery(false)
    if (err) { setError(err.message); return }
    flash(setSavedDelivery)
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

      {/* ── PAGOS ── */}
      <div className="cf-card">
        <SectionHeader title="Pagos" desc="Métodos de pago que aceptas en tu tienda" open={openSection === 'pagos'} onToggle={() => toggleSection('pagos')} saved={savedPagos} />
        {openSection === 'pagos' && (
          <div className="cf-card-body" style={{ gap: 8 }}>
            <p className="cf-section-hint">Activa los métodos que aceptas y agrega tus datos para que los clientes puedan pagarte.</p>
            {methods.map(m => (
              <div key={m.id} className="cf-method-card">
                <div className="cf-card-header" style={{ padding: '14px 16px' }} onClick={() => setOpenMethod(prev => prev === m.id ? null : m.id)}>
                  <div className="cf-card-header-left">
                    <div>
                      <div className="cf-method-name" style={{ fontSize: 14 }}>{m.name}</div>
                      <div className="cf-method-sub">{m.enabled ? 'Activo' : 'Inactivo'}</div>
                    </div>
                  </div>
                  <button className={`cf-toggle${m.enabled ? ' on' : ''}`} onClick={e => { e.stopPropagation(); setMethods(prev => prev.map(x => x.id === m.id ? { ...x, enabled: !x.enabled } : x)) }}><div className="cf-toggle-knob" /></button>
                </div>
                {openMethod === m.id && (
                  <div className="cf-card-body" style={{ paddingTop: 14 }}>
                    {m.fields.length <= 2 ? m.fields.map(f => (
                      <div key={f.key} className="cf-field">
                        <label className="cf-label">{f.label}</label>
                        <input className="cf-input" placeholder={f.placeholder} value={m.values[f.key] ?? ''} onChange={e => setMethods(prev => prev.map(x => x.id === m.id ? { ...x, values: { ...x.values, [f.key]: e.target.value } } : x))} />
                      </div>
                    )) : (
                      <div className="cf-two-col">
                        {m.fields.map(f => (
                          <div key={f.key} className="cf-field">
                            <label className="cf-label">{f.label}</label>
                            <input className="cf-input" placeholder={f.placeholder} value={m.values[f.key] ?? ''} onChange={e => setMethods(prev => prev.map(x => x.id === m.id ? { ...x, values: { ...x.values, [f.key]: e.target.value } } : x))} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <SaveBtn saving={savingPagos} onClick={savePagos} />
          </div>
        )}
      </div>

      {/* ── DELIVERY ── */}
      <div className="cf-card">
        <SectionHeader title="Delivery" desc="Configura el envío y entrega a domicilio" open={openSection === 'delivery'} onToggle={() => toggleSection('delivery')} saved={savedDelivery} />
        {openSection === 'delivery' && (
          <div className="cf-card-body">
            <div className="cf-toggle-row">
              <span className="cf-toggle-label">Activar delivery</span>
              <button className={`cf-toggle${deliveryEnabled ? ' on' : ''}`} onClick={() => setDeliveryEnabled(!deliveryEnabled)}><div className="cf-toggle-knob" /></button>
            </div>
            {deliveryEnabled && (
              <>
                <div className="cf-two-col">
                  <div className="cf-field">
                    <label className="cf-label">Costo de delivery (USD)</label>
                    <input className="cf-input" type="number" min="0" step="0.01" placeholder="Ej: 2.00" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} />
                  </div>
                  <div className="cf-field">
                    <label className="cf-label">Tiempo estimado</label>
                    <input className="cf-input" placeholder="Ej: 30-45 min" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} />
                  </div>
                </div>
                <div className="cf-field">
                  <label className="cf-label">Zona de cobertura</label>
                  <textarea className="cf-input" rows={2} style={{ resize: 'vertical', lineHeight: 1.6 }} placeholder="Ej: Las Mercedes, Chacao, El Rosal..." value={deliveryZone} onChange={e => setDeliveryZone(e.target.value)} />
                </div>
              </>
            )}
            <SaveBtn saving={savingDelivery} onClick={saveDelivery} />
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
