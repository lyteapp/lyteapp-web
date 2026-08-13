'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

interface HomePageConfig {
  enabled: boolean
  title: string
  subtitle: string
  buttonLabel: string
  imageUrl: string | null
  bgColor: string
}

const DEFAULTS: HomePageConfig = {
  enabled: false,
  title: '',
  subtitle: '',
  buttonLabel: 'Empezar',
  imageUrl: null,
  bgColor: '#0F172A',
}

const BG_PRESETS = ['#0F172A', '#7C3AED', '#111827', '#064E3B', '#7C2D12', '#1E1B4B']

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

function SplashPreview({ config, storeName, logoUrl }: { config: HomePageConfig; storeName: string; logoUrl: string | null }) {
  return (
    <div style={{
      width: 300, flexShrink: 0,
      border: '10px solid #1E1E2E', borderRadius: 36,
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      overflow: 'hidden', maxHeight: 640, aspectRatio: '300/620',
      display: 'flex', flexDirection: 'column',
      background: config.imageUrl
        ? `linear-gradient(rgba(15,23,42,0.25), rgba(15,23,42,0.55)), url(${config.imageUrl}) center/cover no-repeat`
        : config.bgColor,
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 10, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>9:41</span>
        <span style={{ fontSize: 10, color: 'white' }}>●●●</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        {logoUrl && (
          <img src={logoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', marginBottom: 18, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }} />
        )}
        <div style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 8 }}>
          {config.title || storeName || 'Tu tienda'}
        </div>
        {config.subtitle && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, marginBottom: 22 }}>
            {config.subtitle}
          </div>
        )}
        <div style={{
          background: '#7C3AED', color: 'white', fontSize: 12, fontWeight: 700,
          padding: '11px 28px', borderRadius: 100, boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
        }}>
          {config.buttonLabel || 'Empezar'}
        </div>
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
        if (cfg.homePage) setConfig({ ...DEFAULTS, ...(cfg.homePage as Partial<HomePageConfig>) })
      })
  }, [user])

  function set<K extends keyof HomePageConfig>(key: K, value: HomePageConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }))
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

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>

        <div style={{ flex: 1, minWidth: 0 }}>
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
                <div className="cn-field" style={{ marginBottom: 0 }}>
                  <div className="cn-label">Texto del boton</div>
                  <input className="cn-input" value={config.buttonLabel} onChange={e => set('buttonLabel', e.target.value)}
                    placeholder="Empezar" maxLength={24} />
                </div>
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

            {error && <div className="cn-error">{error}</div>}
            {success && <div className="cn-success">Pagina de inicio guardada.</div>}
            <div className="cn-actions">
              <button type="submit" className="cn-save-btn" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vista previa</div>
          <SplashPreview config={config} storeName={storeName} logoUrl={logoUrl} />
        </div>

      </div>
    </div>
  )
}
