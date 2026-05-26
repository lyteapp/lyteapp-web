'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

const PRESETS = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#059669', '#DB2777', '#0F172A', '#64748B']


const TEMPLATES = [
  {
    id: 'clasico',
    name: 'Clásico',
    desc: 'Limpio y profesional',
    preview: (
      <div style={{ background: '#F8F7F4', borderRadius: 8, padding: 8, height: '100%' }}>
        <div style={{ background: '#fff', borderRadius: 6, padding: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: '#7C3AED' }} />
          <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, flex: 1 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: 28, background: '#F1F5F9' }} />
              <div style={{ padding: '5px 6px' }}>
                <div style={{ height: 5, background: '#E2E8F0', borderRadius: 2, marginBottom: 3 }} />
                <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, width: '60%' }} />
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
    desc: 'Elegante y moderno',
    preview: (
      <div style={{ background: '#0F172A', borderRadius: 8, padding: 8, height: '100%' }}>
        <div style={{ background: '#1E293B', borderRadius: 6, padding: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: '#7C3AED' }} />
          <div style={{ height: 6, background: '#334155', borderRadius: 3, flex: 1 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: '#1E293B', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: 28, background: '#334155' }} />
              <div style={{ padding: '5px 6px' }}>
                <div style={{ height: 5, background: '#475569', borderRadius: 2, marginBottom: 3 }} />
                <div style={{ height: 4, background: '#334155', borderRadius: 2, width: '60%' }} />
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
    desc: 'Simple y rápido',
    preview: (
      <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 8, height: '100%' }}>
        <div style={{ background: '#fff', borderRadius: 6, padding: 8, marginBottom: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: '#7C3AED' }} />
          <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 6, padding: 7, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 24, height: 24, background: '#F1F5F9', borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 5, background: '#E2E8F0', borderRadius: 2, marginBottom: 3, width: '70%' }} />
                <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

type Category = { id: string; name: string }

const PHOTO_SHAPES = [
  { id: 'square', name: 'Redondeada' },
  { id: 'sharp',  name: 'Recta'      },
  { id: 'circle', name: 'Circular'   },
]

const TR_ACCENT_PRESETS = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#059669', '#DB2777', '#0F172A', '#64748B']
const TR_BG_PRESETS = [
  { color: '#F1EFE9', label: 'Cálido'   },
  { color: '#FFFFFF', label: 'Blanco'   },
  { color: '#F8FAFC', label: 'Gris'     },
  { color: '#FFF7ED', label: 'Naranja'  },
  { color: '#F0FDF4', label: 'Menta'    },
]
const TR_FONTS = [
  { id: 'system',   name: 'Sistema' },
  { id: 'Inter',    name: 'Inter'   },
  { id: 'Poppins',  name: 'Poppins' },
  { id: 'DM Sans',  name: 'DM Sans' },
  { id: 'Nunito',   name: 'Nunito'  },
]
const TR_SIZES = [
  { id: 'sm', name: 'Pequeña' },
  { id: 'md', name: 'Normal'  },
  { id: 'lg', name: 'Grande'  },
]

interface TrackingConfig {
  accentColor: string
  bgColor: string
  fontFamily: string
  fontSize: string
}

const DEFAULT_TR_CONFIG: TrackingConfig = {
  accentColor: '#7C3AED',
  bgColor: '#F1EFE9',
  fontFamily: 'system',
  fontSize: 'md',
}

export default function Apariencia() {
  const { user } = useAuth()
  const [template, setTemplate]             = useState('clasico')
  const [color, setColor]                   = useState('#7C3AED')
  const [baseConfig, setBaseConfig]         = useState<Record<string, unknown>>({})
  const [categories, setCategories]         = useState<Category[]>([])
  const [categoryShapes, setCategoryShapes] = useState<Record<string, string>>({})
  const [trConfig, setTrConfig]             = useState<TrackingConfig>(DEFAULT_TR_CONFIG)
  const [saving, setSaving]                 = useState(false)
  const [success, setSuccess]               = useState(false)
  const [error, setError]                   = useState('')
  const colorInputRef  = useRef<HTMLInputElement>(null)
  const trAccentRef    = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('stores')
      .select('id,template,brand_color,template_config')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        if (data.template) setTemplate(data.template)
        if (data.brand_color) setColor(data.brand_color)
        const cfg = (data.template_config ?? {}) as Record<string, unknown>
        setBaseConfig(cfg)
        if (cfg.categoryPhotoShapes) setCategoryShapes(cfg.categoryPhotoShapes as Record<string, string>)
        if (cfg.trackingConfig) setTrConfig({ ...DEFAULT_TR_CONFIG, ...(cfg.trackingConfig as Partial<TrackingConfig>) })
        const { data: cats } = await supabase
          .from('categories').select('id,name')
          .eq('store_id', data.id).order('position', { ascending: true })
        if (cats) setCategories(cats)
      })
  }, [user])

  async function save(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    setError(''); setSuccess(false); setSaving(true)

    const template_config = {
      ...baseConfig,
      categoryPhotoShapes: Object.keys(categoryShapes).length > 0 ? categoryShapes : undefined,
      trackingConfig: trConfig,
    }

    const { data: existing } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    const { error: err } = existing
      ? await supabase.from('stores').update({ template, brand_color: color, template_config }).eq('id', existing.id)
      : await supabase.from('stores').insert({ owner_id: user.id, template, brand_color: color, template_config })
    if (err) setError(err.message)
    else setSuccess(true)
    setSaving(false)
  }

  return (
    <div className="cn-page">
      <div className="cn-header">
        <div className="cn-title">Apariencia</div>
        <div className="cn-desc">Elige el diseño y los colores de tu tienda. Los cambios se ven en tiempo real.</div>
      </div>

      <form onSubmit={save}>
        {/* Template */}
        <div className="cn-section">
          <div className="cn-section-head">
            <div className="cn-section-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div>
              <div className="cn-section-title">Plantilla</div>
              <div className="cn-section-sub">Estilo visual de tu tienda</div>
            </div>
          </div>
          <div className="cn-section-body">
            <div className="cn-template-grid">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`cn-template-card${template === t.id ? ' selected' : ''}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <div className="cn-template-preview">{t.preview}</div>
                  <div className="cn-template-foot">
                    <div className="cn-template-name">{t.name}</div>
                    <div className="cn-template-desc">{t.desc}</div>
                  </div>
                  {template === t.id && <div className="cn-template-check">✓</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color principal */}
        <div className="cn-section">
          <div className="cn-section-head">
            <div className="cn-section-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="cn-section-title">Color principal</div>
              <div className="cn-section-sub">Botones y acentos de la tienda</div>
            </div>
          </div>
          <div className="cn-section-body">
            <div className="cn-colors">
              {PRESETS.map(c => (
                <div
                  key={c}
                  className={`cn-color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <div className="cn-color-custom" style={{ background: PRESETS.includes(color) ? undefined : color }} onClick={() => colorInputRef.current?.click()}>
                {PRESETS.includes(color) ? '+' : null}
                <input ref={colorInputRef} type="color" value={color} onChange={e => setColor(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: color }} />
              <span style={{ fontSize: 13, fontFamily: 'var(--font-geist-mono), monospace', color: '#475569', fontWeight: 600 }}>{color.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Forma por categoria */}
        {categories.length > 0 && (
          <div className="cn-section">
            <div className="cn-section-head">
              <div className="cn-section-icon">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="cn-section-title">Forma de imagen por categoría</div>
                <div className="cn-section-sub">Personaliza la forma de las fotos de cada sección</div>
              </div>
            </div>
            <div className="cn-section-body">
              {categories.map(cat => (
                <div key={cat.id} className="cn-field">
                  <div className="cn-label">{cat.name}</div>
                  <div className="cn-pill-row">
                    <button
                      type="button"
                      className={`cn-pill-btn${!categoryShapes[cat.id] ? ' selected' : ''}`}
                      onClick={() => setCategoryShapes(p => { const n = { ...p }; delete n[cat.id]; return n })}
                    >
                      Global
                    </button>
                    {PHOTO_SHAPES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className={`cn-pill-btn${categoryShapes[cat.id] === s.id ? ' selected' : ''}`}
                        onClick={() => setCategoryShapes(p => ({ ...p, [cat.id]: s.id }))}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rastreo de pedido */}
        <div className="cn-section">
          <div className="cn-section-head">
            <div className="cn-section-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="cn-section-title">Rastreo de pedido</div>
              <div className="cn-section-sub">Personaliza la pagina de seguimiento del cliente</div>
            </div>
          </div>
          <div className="cn-section-body">

            {/* Phone preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{ background: '#1C1C1E', borderRadius: 36, padding: '14px 8px', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', width: 220, position: 'relative' }}>
                {/* notch */}
                <div style={{ width: 60, height: 6, background: '#3A3A3C', borderRadius: 3, margin: '0 auto 10px' }} />
                {/* screen */}
                <div style={{ background: trConfig.bgColor, borderRadius: 24, overflow: 'hidden', padding: '14px 10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {/* brand bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.04em' }}>
                      Lyte<span style={{ color: trConfig.accentColor }}>app</span>
                    </span>
                    <span style={{ fontSize: 7, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Rastreo</span>
                  </div>
                  {/* hero */}
                  <div style={{ background: 'white', borderRadius: 14, padding: '12px 10px', textAlign: 'center' as const, boxShadow: '0 2px 10px rgba(15,23,42,0.08)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: trConfig.accentColor + '20', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 13, height: 13, borderRadius: '50%', background: trConfig.accentColor }} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>En preparacion en cocina</div>
                    <div style={{ fontSize: 8, color: '#64748B', lineHeight: 1.4 }}>Preparando tu pedido con mucho cuidado.</div>
                  </div>
                  {/* info */}
                  <div style={{ background: 'white', borderRadius: 10, padding: '8px 10px', boxShadow: '0 2px 6px rgba(15,23,42,0.05)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Maria Garcia</div>
                    <div style={{ fontSize: 7, color: '#64748B' }}>Av. Libertador 1234, Caracas</div>
                  </div>
                  {/* steps */}
                  <div style={{ background: 'white', borderRadius: 10, padding: '10px 10px 8px', boxShadow: '0 2px 6px rgba(15,23,42,0.05)' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 }}>Progreso</div>
                    {[
                      { label: 'Pedido recibido', state: 'done'    },
                      { label: 'En preparacion',  state: 'current' },
                      { label: 'Siendo empacado', state: 'future'  },
                      { label: 'Tu pedido sale',  state: 'future'  },
                    ].map(({ label, state }, i, arr) => (
                      <div key={label} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                            background: state === 'done' ? '#10B981' : state === 'current' ? trConfig.accentColor : '#F8FAFC',
                            border: `2px solid ${state === 'done' ? '#10B981' : state === 'current' ? trConfig.accentColor : '#E2E8F0'}`,
                          }} />
                          {i < arr.length - 1 && <div style={{ width: 2, height: 10, background: state === 'done' ? '#10B981' : '#E2E8F0', margin: '2px 0' }} />}
                        </div>
                        <div style={{ paddingBottom: i < arr.length - 1 ? 10 : 0 }}>
                          <div style={{ fontSize: 8, fontWeight: state === 'current' ? 700 : 400, color: state === 'done' ? '#0F172A' : state === 'current' ? trConfig.accentColor : '#CBD5E1', lineHeight: '14px' }}>
                            {label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* home bar */}
                <div style={{ width: 52, height: 4, background: '#3A3A3C', borderRadius: 2, margin: '10px auto 0' }} />
              </div>
            </div>

            {/* Accent color */}
            <div className="cn-field">
              <div className="cn-label">Color de acento</div>
              <div className="cn-colors">
                {TR_ACCENT_PRESETS.map(c => (
                  <div
                    key={c}
                    className={`cn-color-swatch${trConfig.accentColor === c ? ' selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setTrConfig(p => ({ ...p, accentColor: c }))}
                  />
                ))}
                <div
                  className="cn-color-custom"
                  style={{ background: TR_ACCENT_PRESETS.includes(trConfig.accentColor) ? undefined : trConfig.accentColor }}
                  onClick={() => trAccentRef.current?.click()}
                >
                  {TR_ACCENT_PRESETS.includes(trConfig.accentColor) ? '+' : null}
                  <input
                    ref={trAccentRef}
                    type="color"
                    value={trConfig.accentColor}
                    onChange={e => setTrConfig(p => ({ ...p, accentColor: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Background color */}
            <div className="cn-field">
              <div className="cn-label">Color de fondo</div>
              <div className="cn-pill-row" style={{ flexWrap: 'wrap' }}>
                {TR_BG_PRESETS.map(({ color, label }) => (
                  <button
                    key={color}
                    type="button"
                    className={`cn-pill-btn${trConfig.bgColor === color ? ' selected' : ''}`}
                    onClick={() => setTrConfig(p => ({ ...p, bgColor: color }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font family */}
            <div className="cn-field">
              <div className="cn-label">Fuente</div>
              <div className="cn-pill-row" style={{ flexWrap: 'wrap' }}>
                {TR_FONTS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`cn-pill-btn${trConfig.fontFamily === f.id ? ' selected' : ''}`}
                    onClick={() => setTrConfig(p => ({ ...p, fontFamily: f.id }))}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div className="cn-field">
              <div className="cn-label">Tamaño de texto</div>
              <div className="cn-pill-row">
                {TR_SIZES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`cn-pill-btn${trConfig.fontSize === s.id ? ' selected' : ''}`}
                    onClick={() => setTrConfig(p => ({ ...p, fontSize: s.id }))}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {error && <div className="cn-error">{error}</div>}
        {success && <div className="cn-success">Apariencia guardada correctamente.</div>}

        <div className="cn-actions">
          <button type="submit" className="cn-save-btn" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar apariencia'}
          </button>
        </div>
      </form>
    </div>
  )
}
