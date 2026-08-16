'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

interface HomePagePill {
  id: string
  label: string
  url: string
  color: string
}

interface CustomerFields {
  name: boolean
  phone: boolean
  address: boolean
}

interface InactivityTimeout {
  enabled: boolean
  minutes: number
}

interface OrderReturnTimeout {
  enabled: boolean
  seconds: number
}

interface ElementSizes {
  logo: number
  title: number
  subtitle: number
  fields: number
}

type SelectableId = 'logo' | 'title' | 'subtitle' | 'fields'

interface HomePageConfig {
  enabled: boolean
  title: string
  subtitle: string
  buttonLabel: string
  buttonColor: string
  imageUrl: string | null
  bgColor: string
  pills: HomePagePill[]
  transition: string
  collectCustomerData: boolean
  customerFields: CustomerFields
  inputTextColor: string
  inputBgColor: string
  inputShape: 'pill' | 'square' | 'outline'
  inactivityTimeout: InactivityTimeout
  orderReturnTimeout: OrderReturnTimeout
  enableReorder: boolean
  revealSeconds: number
  revealShowSkip: boolean
  elementSizes: ElementSizes
}

const DEFAULTS: HomePageConfig = {
  enabled: false,
  title: '',
  subtitle: '',
  buttonLabel: 'Empezar',
  buttonColor: '#7C3AED',
  imageUrl: null,
  bgColor: '#0F172A',
  pills: [],
  transition: 'slide',
  collectCustomerData: true,
  customerFields: { name: true, phone: true, address: true },
  inputTextColor: '#FFFFFF',
  inputBgColor: '#FFFFFF',
  inputShape: 'pill',
  inactivityTimeout: { enabled: false, minutes: 3 },
  orderReturnTimeout: { enabled: false, seconds: 15 },
  enableReorder: false,
  revealSeconds: 3.2,
  revealShowSkip: true,
  elementSizes: { logo: 72, title: 30, subtitle: 15, fields: 14 },
}

const TRANSITIONS = [
  { id: 'slide',    name: 'Deslizar',    desc: 'Empuja hacia la tienda, como una app nativa' },
  { id: 'fade',     name: 'Desvanecer',  desc: 'Se desvanece suavemente hacia la tienda' },
  { id: 'zoom',     name: 'Acercar',     desc: 'Un zoom suave hacia adelante' },
  { id: 'slide-up', name: 'Subir',       desc: 'Todo se desliza hacia arriba' },
  { id: 'iris',     name: 'Apertura',    desc: 'Un circulo se abre revelando la tienda' },
  { id: 'flip',     name: 'Voltear',     desc: 'Un giro elegante en 3D' },
  { id: 'blur',     name: 'Enfocar',     desc: 'De borroso a nitido, como una camara' },
  { id: 'bounce',   name: 'Rebote',      desc: 'Un deslizar con un rebote juguetón al final' },
  { id: 'logo-morph', name: 'Logo', desc: 'Tu logo se desliza y se ubica en el encabezado de tu tienda' },
  { id: 'reveal', name: 'Bienvenida animada', desc: 'Pantalla negra elegante con el nombre del cliente letra por letra' },
] as const

const BG_PRESETS = ['#0F172A', '#7C3AED', '#111827', '#064E3B', '#7C2D12', '#1E1B4B']
const PILL_COLOR_PRESETS = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#059669', '#DB2777', '#0F172A', '#64748B']
const TEXT_COLOR_PRESETS = ['#FFFFFF', '#0F172A', '#F1F5F9', '#7C3AED', '#FDE68A']
const INPUT_SHAPES = [
  { id: 'pill' as const,    name: 'Pill' },
  { id: 'square' as const,  name: 'Cuadrado' },
  { id: 'outline' as const, name: 'Con borde' },
]

function newPill(): HomePagePill {
  return { id: crypto.randomUUID(), label: '', url: '', color: '#7C3AED' }
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cn-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cn-toggle-track" />
    </label>
  )
}

async function uploadFile(file: File, userId: string, folder: string) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${userId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('store-assets').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return supabase.storage.from('store-assets').getPublicUrl(path).data.publicUrl
}

const SIZE_LIMITS: Record<SelectableId, [number, number]> = {
  logo: [32, 140],
  title: [16, 56],
  subtitle: [10, 28],
  fields: [10, 22],
}

function ResizeHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    function onMove(ev: PointerEvent) {
      onDrag(((ev.clientX - startX) + (ev.clientY - startY)) / 2)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  return (
    <div
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute', right: -9, bottom: -9, width: 16, height: 16,
        borderRadius: '50%', background: '#7C3AED', border: '2px solid white',
        cursor: 'nwse-resize', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', zIndex: 6,
      }}
    />
  )
}

function SplashPreview({
  config, storeName, logoUrl, selected, onSelect, onResize,
}: {
  config: HomePageConfig; storeName: string; logoUrl: string | null
  selected: SelectableId | null
  onSelect: (id: SelectableId | null) => void
  onResize: (id: SelectableId, size: number) => void
}) {
  function startResize(id: SelectableId) {
    const [min, max] = SIZE_LIMITS[id]
    const startSize = config.elementSizes[id]
    return (delta: number) => onResize(id, Math.min(max, Math.max(min, Math.round(startSize + delta))))
  }

  function selectableStyle(id: SelectableId, extraOffset = 4): React.CSSProperties {
    return {
      position: 'relative', display: 'inline-block', cursor: 'pointer',
      outline: selected === id ? '2px dashed #7C3AED' : 'none',
      outlineOffset: extraOffset,
    }
  }

  const sizes = config.elementSizes

  return (
    <div
      onClick={() => onSelect(null)}
      style={{
        width: 380, flexShrink: 0,
        border: '10px solid #1E1E2E', borderRadius: 44,
        boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
        overflow: 'hidden', aspectRatio: '380/780',
        display: 'flex', flexDirection: 'column',
        background: config.imageUrl
          ? `linear-gradient(rgba(15,23,42,0.25), rgba(15,23,42,0.55)), url(${config.imageUrl}) center/cover no-repeat`
          : config.bgColor,
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 14, left: 26, right: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>9:41</span>
        <span style={{ fontSize: 12, color: 'white' }}>●●●</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 30px', textAlign: 'center' }}>

        {logoUrl && (
          <div
            onClick={e => { e.stopPropagation(); onSelect('logo') }}
            style={{ ...selectableStyle('logo'), marginBottom: 22, borderRadius: 14 }}
          >
            <img src={logoUrl} alt="" style={{ width: sizes.logo, height: sizes.logo, borderRadius: 14, objectFit: 'cover', display: 'block', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }} />
            {selected === 'logo' && <ResizeHandle onDrag={startResize('logo')} />}
          </div>
        )}

        <div
          onClick={e => { e.stopPropagation(); onSelect('title') }}
          style={{ ...selectableStyle('title'), marginBottom: 10 }}
        >
          <div style={{ fontSize: sizes.title, fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            {config.title || storeName || 'Tu tienda'}
          </div>
          {selected === 'title' && <ResizeHandle onDrag={startResize('title')} />}
        </div>

        {config.subtitle && (
          <div
            onClick={e => { e.stopPropagation(); onSelect('subtitle') }}
            style={{ ...selectableStyle('subtitle'), marginBottom: 26 }}
          >
            <div style={{ fontSize: sizes.subtitle, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
              {config.subtitle}
            </div>
            {selected === 'subtitle' && <ResizeHandle onDrag={startResize('subtitle')} />}
          </div>
        )}

        {config.collectCustomerData && (
          <div
            onClick={e => { e.stopPropagation(); onSelect('fields') }}
            style={{
              ...selectableStyle('fields', 8), width: '100%', display: 'flex', flexDirection: 'column', gap: 8,
              marginBottom: 14, borderRadius: 8,
            }}
          >
            {['Tu cedula de identidad', config.customerFields.name && 'Tu nombre completo', config.customerFields.phone && 'Tu telefono', config.customerFields.address && 'Tu direccion']
              .filter((v): v is string => !!v)
              .map(placeholder => (
                <div key={placeholder} style={{
                  width: '100%', boxSizing: 'border-box',
                  background: config.inputShape === 'outline' ? 'transparent' : `color-mix(in srgb, ${config.inputBgColor || '#FFFFFF'} 12%, transparent)`,
                  border: config.inputShape === 'outline'
                    ? `1.5px solid color-mix(in srgb, ${config.inputBgColor || '#FFFFFF'} 65%, transparent)`
                    : `1px solid color-mix(in srgb, ${config.inputBgColor || '#FFFFFF'} 20%, transparent)`,
                  borderRadius: config.inputShape === 'square' ? 4 : config.inputShape === 'outline' ? 10 : 100,
                  padding: `${sizes.fields}px ${sizes.fields * 1.4}px`, fontSize: sizes.fields,
                  color: `color-mix(in srgb, ${config.inputTextColor || '#FFFFFF'} 55%, transparent)`,
                }}>
                  {placeholder}
                </div>
              ))}
            {selected === 'fields' && <ResizeHandle onDrag={startResize('fields')} />}
          </div>
        )}

        <div style={{
          background: config.buttonColor || '#7C3AED', color: 'white', fontSize: 14, fontWeight: 700,
          padding: '13px 32px', borderRadius: 100, boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
        }}>
          {config.buttonLabel || 'Empezar'}
        </div>
        {config.pills.filter(p => p.label.trim()).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, width: '100%' }}>
            {config.pills.filter(p => p.label.trim()).map(p => (
              <div key={p.id} style={{
                background: 'rgba(255,255,255,0.12)', border: `1.5px solid ${p.color}`, color: 'white',
                fontSize: 12, fontWeight: 600, padding: '9px 22px', borderRadius: 100,
              }}>
                {p.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function InicioPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<HomePageConfig>(DEFAULTS)
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({})
  const [storeName, setStoreName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bgColorRef = useRef<HTMLInputElement>(null)
  const buttonColorRef = useRef<HTMLInputElement>(null)
  const inputTextColorRef = useRef<HTMLInputElement>(null)
  const inputBgColorRef = useRef<HTMLInputElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedEl, setSelectedEl] = useState<SelectableId | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('stores')
      .select('name,logo_url,template_config')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setStoreName(data.name ?? '')
        setLogoUrl(data.logo_url ?? null)
        const cfg = (data.template_config ?? {}) as Record<string, unknown>
        setBaseConfig(cfg)
        if (cfg.homePage) {
          const hp = cfg.homePage as Partial<HomePageConfig>
          setConfig({
            ...DEFAULTS, ...hp,
            customerFields: { ...DEFAULTS.customerFields, ...(hp.customerFields ?? {}) },
            inactivityTimeout: { ...DEFAULTS.inactivityTimeout, ...(hp.inactivityTimeout ?? {}) },
            orderReturnTimeout: { ...DEFAULTS.orderReturnTimeout, ...(hp.orderReturnTimeout ?? {}) },
            elementSizes: { ...DEFAULTS.elementSizes, ...(hp.elementSizes ?? {}) },
          })
        }
      })
  }, [user])

  function set<K extends keyof HomePageConfig>(key: K, value: HomePageConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }))
  }

  function addPill() {
    setConfig(c => ({ ...c, pills: [...c.pills, newPill()] }))
  }
  function updatePill(id: string, patch: Partial<HomePagePill>) {
    setConfig(c => ({ ...c, pills: c.pills.map(p => p.id === id ? { ...p, ...patch } : p) }))
  }
  function removePill(id: string) {
    setConfig(c => ({ ...c, pills: c.pills.filter(p => p.id !== id) }))
  }

  function setField<K extends keyof CustomerFields>(key: K, value: boolean) {
    setConfig(c => ({ ...c, customerFields: { ...c.customerFields, [key]: value } }))
  }

  function setInactivity<K extends keyof InactivityTimeout>(key: K, value: InactivityTimeout[K]) {
    setConfig(c => ({ ...c, inactivityTimeout: { ...c.inactivityTimeout, [key]: value } }))
  }
  function setOrderReturn<K extends keyof OrderReturnTimeout>(key: K, value: OrderReturnTimeout[K]) {
    setConfig(c => ({ ...c, orderReturnTimeout: { ...c.orderReturnTimeout, [key]: value } }))
  }

  function setElementSize(id: SelectableId, size: number) {
    setConfig(c => ({ ...c, elementSizes: { ...c.elementSizes, [id]: size } }))
  }

  async function handleUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try { set('imageUrl', await uploadFile(file, user.id, 'homepage')) }
    catch { setError('No se pudo subir la imagen.') }
    setUploading(false)
  }

  async function save(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    setError(''); setSuccess(false); setSaving(true)
    const template_config = { ...baseConfig, homePage: config }
    const { data: existing } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    const { error: err } = existing
      ? await supabase.from('stores').update({ template_config }).eq('id', existing.id)
      : await supabase.from('stores').insert({ owner_id: user.id, template_config })
    if (err) setError(err.message)
    else setSuccess(true)
    setSaving(false)
  }

  return (
    <div className="cn-page" style={{ maxWidth: 'none' }}>
      <div className="cn-header">
        <div className="cn-title">Pagina de inicio</div>
        <div className="cn-desc">Una pantalla de bienvenida que se muestra antes de tu tienda, con un boton para entrar.</div>
      </div>

      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', position: 'relative' }} onClick={() => setSelectedEl(null)}>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'sticky', top: 24, padding: '4px 24px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Vista previa · toca un elemento y arrastra su esquina para redimensionar
          </div>
          <SplashPreview
            config={config} storeName={storeName} logoUrl={logoUrl}
            selected={selectedEl} onSelect={setSelectedEl}
            onResize={setElementSize}
          />
        </div>

        <button
          type="button"
          className="cn-sidebar-toggle"
          onClick={e => { e.stopPropagation(); setSidebarOpen(o => !o) }}
          aria-label={sidebarOpen ? 'Cerrar panel' : 'Abrir panel'}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ transform: sidebarOpen ? 'none' : 'rotate(180deg)' }}>
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>

        <div className={`cn-sidebar${sidebarOpen ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
          <form onSubmit={save}>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Activar pagina de inicio</div>
                  <div className="cn-section-sub">Se muestra una sola pantalla antes del catalogo, con un boton para empezar</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Mostrar pagina de inicio</div>
                    <div className="cn-toggle-hint">Si esta apagado, los clientes entran directo al catalogo</div>
                  </div>
                  <Toggle checked={config.enabled} onChange={v => set('enabled', v)} />
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Datos del cliente</div>
                  <div className="cn-section-sub">Pide la identidad del cliente antes de dejarlo entrar y autocompleta el checkout</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Pedir datos en la pagina de inicio</div>
                    <div className="cn-toggle-hint">El cliente debe ingresar su cedula (y los datos de abajo) para poder entrar. Si ya compro antes, se autocompletan solos.</div>
                  </div>
                  <Toggle checked={config.collectCustomerData} onChange={v => set('collectCustomerData', v)} />
                </div>
                {config.collectCustomerData && (
                  <>
                    <div className="cn-label" style={{ marginTop: 18, marginBottom: 8 }}>Color del texto de los campos</div>
                    <div className="cn-colors" style={{ marginBottom: 4 }}>
                      {TEXT_COLOR_PRESETS.map(c => (
                        <div key={c} className={`cn-color-swatch${config.inputTextColor === c ? ' selected' : ''}`}
                          style={{ background: c, border: '1px solid rgba(15,23,42,0.12)' }} onClick={() => set('inputTextColor', c)} />
                      ))}
                      <div
                        className="cn-color-custom"
                        style={{ background: TEXT_COLOR_PRESETS.includes(config.inputTextColor) ? undefined : config.inputTextColor }}
                        onClick={() => inputTextColorRef.current?.click()}
                      >
                        {TEXT_COLOR_PRESETS.includes(config.inputTextColor) ? '+' : null}
                        <input ref={inputTextColorRef} type="color" value={config.inputTextColor} onChange={e => set('inputTextColor', e.target.value)} />
                      </div>
                    </div>

                    <div className="cn-label" style={{ marginTop: 18, marginBottom: 8 }}>Color del fondo de los campos</div>
                    <div className="cn-colors" style={{ marginBottom: 4 }}>
                      {TEXT_COLOR_PRESETS.map(c => (
                        <div key={c} className={`cn-color-swatch${config.inputBgColor === c ? ' selected' : ''}`}
                          style={{ background: c, border: '1px solid rgba(15,23,42,0.12)' }} onClick={() => set('inputBgColor', c)} />
                      ))}
                      <div
                        className="cn-color-custom"
                        style={{ background: TEXT_COLOR_PRESETS.includes(config.inputBgColor) ? undefined : config.inputBgColor }}
                        onClick={() => inputBgColorRef.current?.click()}
                      >
                        {TEXT_COLOR_PRESETS.includes(config.inputBgColor) ? '+' : null}
                        <input ref={inputBgColorRef} type="color" value={config.inputBgColor} onChange={e => set('inputBgColor', e.target.value)} />
                      </div>
                    </div>

                    <div className="cn-label" style={{ marginTop: 18, marginBottom: 8 }}>Forma de los campos</div>
                    <div className="cn-pill-row" style={{ marginBottom: 4 }}>
                      {INPUT_SHAPES.map(s => (
                        <button
                          key={s.id} type="button"
                          className={`cn-pill-btn${config.inputShape === s.id ? ' selected' : ''}`}
                          onClick={() => set('inputShape', s.id)}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>

                    <div className="cn-label" style={{ marginTop: 18, marginBottom: 4 }}>Datos obligatorios para entrar</div>
                    <div className="cn-toggle-row">
                      <div className="cn-toggle-info">
                        <div className="cn-toggle-label">Nombre completo</div>
                      </div>
                      <Toggle checked={config.customerFields.name} onChange={v => setField('name', v)} />
                    </div>
                    <div className="cn-toggle-row">
                      <div className="cn-toggle-info">
                        <div className="cn-toggle-label">Telefono</div>
                      </div>
                      <Toggle checked={config.customerFields.phone} onChange={v => setField('phone', v)} />
                    </div>
                    <div className="cn-toggle-row">
                      <div className="cn-toggle-info">
                        <div className="cn-toggle-label">Direccion</div>
                      </div>
                      <Toggle checked={config.customerFields.address} onChange={v => setField('address', v)} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Pedir de nuevo</div>
                  <div className="cn-section-sub">Le ofrece al cliente repetir su ultimo pedido con un boton</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row" style={{ paddingBottom: 0, borderBottom: 'none' }}>
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Permitir repetir el ultimo pedido</div>
                    <div className="cn-toggle-hint">Si reconocemos al cliente (por cedula o por telefono en este dispositivo) y tiene un pedido anterior, le mostramos un boton para repetirlo</div>
                  </div>
                  <Toggle checked={config.enableReorder} onChange={v => set('enableReorder', v)} />
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Contenido</div>
                  <div className="cn-section-sub">El titulo, subtitulo y texto del boton</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-field">
                  <div className="cn-label">Titulo</div>
                  <input className="cn-input" value={config.title} onChange={e => set('title', e.target.value)}
                    placeholder={storeName ? `Ej: Bienvenido a ${storeName}` : 'Ej: Bienvenido a tu tienda'} />
                </div>
                <div className="cn-field">
                  <div className="cn-label">Subtitulo</div>
                  <textarea className="cn-textarea" rows={2} value={config.subtitle} onChange={e => set('subtitle', e.target.value)}
                    placeholder="Ej: Los mejores productos, directo a tu puerta" />
                </div>
                <div className="cn-field">
                  <div className="cn-label">Texto del boton</div>
                  <input className="cn-input" value={config.buttonLabel} onChange={e => set('buttonLabel', e.target.value)}
                    placeholder="Empezar" maxLength={24} />
                </div>
                <div className="cn-field" style={{ marginBottom: 0 }}>
                  <div className="cn-label">Color del boton</div>
                  <div className="cn-colors">
                    {PILL_COLOR_PRESETS.map(c => (
                      <div key={c} className={`cn-color-swatch${config.buttonColor === c ? ' selected' : ''}`}
                        style={{ background: c }} onClick={() => set('buttonColor', c)} />
                    ))}
                    <div
                      className="cn-color-custom"
                      style={{ background: PILL_COLOR_PRESETS.includes(config.buttonColor) ? undefined : config.buttonColor }}
                      onClick={() => buttonColorRef.current?.click()}
                    >
                      {PILL_COLOR_PRESETS.includes(config.buttonColor) ? '+' : null}
                      <input ref={buttonColorRef} type="color" value={config.buttonColor} onChange={e => set('buttonColor', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Enlaces adicionales</div>
                  <div className="cn-section-sub">Pills con un nombre y un link, debajo del boton principal</div>
                </div>
              </div>
              <div className="cn-section-body">
                {config.pills.length === 0 && (
                  <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>Aun no has agregado ningun enlace.</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {config.pills.map(pill => (
                    <div key={pill.id} style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: 14, background: '#FAFAF9' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            className="cn-input" placeholder="Nombre del pill (ej: WhatsApp)"
                            value={pill.label} onChange={e => updatePill(pill.id, { label: e.target.value })}
                            maxLength={24}
                          />
                          <input
                            className="cn-input" placeholder="https://..."
                            value={pill.url} onChange={e => updatePill(pill.id, { url: e.target.value })}
                          />
                        </div>
                        <label style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(15,23,42,0.1)', cursor: 'pointer', flexShrink: 0, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: 0, background: pill.color, pointerEvents: 'none' }} />
                          <input type="color" value={pill.color} onChange={e => updatePill(pill.id, { color: e.target.value })}
                            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                        </label>
                        <button type="button" onClick={() => removePill(pill.id)} style={{
                          width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)',
                          color: '#EF4444', cursor: 'pointer', flexShrink: 0, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="cn-upload-btn" style={{ marginTop: 14 }} onClick={addPill}>
                  + Agregar enlace
                </button>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Fondo</div>
                  <div className="cn-section-sub">Una foto de fondo o un color solido</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-upload-row">
                  <div className="cn-upload-preview cn-upload-wide" onClick={() => fileRef.current?.click()}>
                    {config.imageUrl
                      ? <img src={config.imageUrl} alt="" className="cn-upload-img" />
                      : <div className="cn-upload-empty">🖼️<span>Subir foto</span></div>
                    }
                    <div className="cn-upload-overlay">{uploading ? '...' : '✎'}</div>
                  </div>
                  <div className="cn-upload-info">
                    <div className="cn-upload-title">Imagen de fondo</div>
                    <div className="cn-upload-hint">Opcional. Recomendado 800 × 1600 px. Si no subes una, se usa el color solido.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cn-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? 'Subiendo...' : config.imageUrl ? 'Cambiar' : 'Subir imagen'}
                      </button>
                      {config.imageUrl && (
                        <button type="button" className="cn-upload-btn" onClick={() => set('imageUrl', null)}>Quitar</button>
                      )}
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
                </div>

                <div style={{ marginTop: 18 }}>
                  <div className="cn-label" style={{ marginBottom: 8 }}>Color solido</div>
                  <div className="cn-colors">
                    {BG_PRESETS.map(c => (
                      <div key={c} className={`cn-color-swatch${config.bgColor === c ? ' selected' : ''}`}
                        style={{ background: c }} onClick={() => set('bgColor', c)} />
                    ))}
                    <div
                      className="cn-color-custom"
                      style={{ background: BG_PRESETS.includes(config.bgColor) ? undefined : config.bgColor }}
                      onClick={() => bgColorRef.current?.click()}
                    >
                      {BG_PRESETS.includes(config.bgColor) ? '+' : null}
                      <input ref={bgColorRef} type="color" value={config.bgColor} onChange={e => set('bgColor', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L14.586 4H10a1 1 0 110-2h7a1 1 0 011 1v7a1 1 0 11-2 0V5.414L5.707 15.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Transicion</div>
                  <div className="cn-section-sub">Como pasa el cliente de la pagina de inicio a tu tienda</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-trans-grid">
                  {TRANSITIONS.map(tr => (
                    <div
                      key={tr.id}
                      className={`cn-trans-card${config.transition === tr.id ? ' selected' : ''}`}
                      onClick={() => set('transition', tr.id)}
                    >
                      <div className={`cn-trans-demo ${tr.id}`}>
                        {tr.id === 'logo-morph'
                          ? <div className="cn-trans-demo-logo" />
                          : tr.id === 'reveal'
                          ? (
                            <div className="cn-trans-demo-letters">
                              {[0, 1, 2, 3].map(i => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
                            </div>
                          )
                          : <div className="cn-trans-demo-box" />
                        }
                      </div>
                      <div className="cn-trans-name">{tr.name}</div>
                      <div className="cn-trans-desc">{tr.desc}</div>
                    </div>
                  ))}
                </div>

                {config.transition === 'reveal' && (
                  <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="cn-field" style={{ marginBottom: 0 }}>
                      <div className="cn-label">Segundos antes de continuar: {config.revealSeconds.toFixed(1)}s</div>
                      <input
                        type="range" min={1.5} max={6} step={0.1}
                        value={config.revealSeconds}
                        onChange={e => set('revealSeconds', Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="cn-toggle-row" style={{ paddingBottom: 0, borderBottom: 'none' }}>
                      <div className="cn-toggle-info">
                        <div className="cn-toggle-label">Mostrar boton de saltar</div>
                        <div className="cn-toggle-hint">Le permite al cliente pasar a la tienda sin esperar</div>
                      </div>
                      <Toggle checked={config.revealShowSkip} onChange={v => set('revealShowSkip', v)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <div className="cn-section-title">Reinicio automatico</div>
                  <div className="cn-section-sub">Util para tablets o kioscos: regresa solo a la pagina de inicio para el siguiente cliente</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Volver a inicio por inactividad</div>
                    <div className="cn-toggle-hint">Si el cliente no toca la pantalla por un tiempo, regresa a la pagina de inicio</div>
                  </div>
                  <Toggle checked={config.inactivityTimeout.enabled} onChange={v => setInactivity('enabled', v)} />
                </div>
                {config.inactivityTimeout.enabled && (
                  <div className="cn-field" style={{ maxWidth: 200, marginTop: 4 }}>
                    <div className="cn-label">Minutos de inactividad</div>
                    <input
                      className="cn-input" type="number" min={1} max={60}
                      value={config.inactivityTimeout.minutes}
                      onChange={e => setInactivity('minutes', Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                )}

                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Volver a inicio despues de confirmar el pedido</div>
                    <div className="cn-toggle-hint">Una vez el pedido se envia a cocina, regresa a la pagina de inicio automaticamente</div>
                  </div>
                  <Toggle checked={config.orderReturnTimeout.enabled} onChange={v => setOrderReturn('enabled', v)} />
                </div>
                {config.orderReturnTimeout.enabled && (
                  <div className="cn-field" style={{ maxWidth: 200, marginTop: 4, marginBottom: 0 }}>
                    <div className="cn-label">Segundos de espera</div>
                    <input
                      className="cn-input" type="number" min={3} max={300}
                      value={config.orderReturnTimeout.seconds}
                      onChange={e => setOrderReturn('seconds', Math.max(3, Number(e.target.value) || 3))}
                    />
                  </div>
                )}
              </div>
            </div>

            {error && <div className="cn-error">{error}</div>}
            {success && <div className="cn-success">Pagina de inicio guardada.</div>}
            <div className="cn-actions">
              <button type="submit" className="cn-save-btn" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
