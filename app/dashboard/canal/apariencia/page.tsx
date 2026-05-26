'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

type Category = { id: string; name: string }

const TR_ACCENT_PRESETS = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#059669', '#DB2777', '#0F172A', '#64748B']
const TR_BG_PRESETS = [
  { color: '#F1EFE9', label: 'Cálido'  },
  { color: '#FFFFFF', label: 'Blanco'  },
  { color: '#F8FAFC', label: 'Gris'    },
  { color: '#FFF7ED', label: 'Naranja' },
  { color: '#F0FDF4', label: 'Menta'   },
]
const TR_FONTS = [
  { id: 'system',  name: 'Sistema' },
  { id: 'Inter',   name: 'Inter'   },
  { id: 'Poppins', name: 'Poppins' },
  { id: 'DM Sans', name: 'DM Sans' },
  { id: 'Nunito',  name: 'Nunito'  },
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

const STEPS_PREVIEW = [
  { label: 'Pedido recibido', state: 'done'    },
  { label: 'En preparacion',  state: 'current' },
  { label: 'Siendo empacado', state: 'future'  },
  { label: 'Tu pedido sale',  state: 'future'  },
  { label: 'Entregado',       state: 'future'  },
]

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
  const trAccentRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('stores')
      .select('id,template,brand_color,template_config')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        if (data.template)    setTemplate(data.template)
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

  /* suppress unused-var warnings for state kept for save() */
  void template; void color; void categories; void categoryShapes; void setTemplate; void setColor; void setCategoryShapes

  return (
    <div style={{ margin: '-28px -32px', display: 'flex', height: 'calc(100dvh - 56px)', overflow: 'hidden' }}>

      {/* ── Preview canvas ── */}
      <div style={{
        flex: 1,
        background: '#0F172A',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* label */}
        <div style={{ position: 'absolute', top: 20, left: 24, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Vista previa
        </div>

        {/* Phone frame */}
        <div style={{
          background: '#1C1C1E',
          borderRadius: 50,
          padding: '16px 10px',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 48px 120px rgba(0,0,0,0.7)',
          width: 310,
          flexShrink: 0,
        }}>
          {/* dynamic island */}
          <div style={{ width: 90, height: 8, background: '#000', borderRadius: 20, margin: '0 auto 14px' }} />

          {/* screen */}
          <div style={{
            background: trConfig.bgColor,
            borderRadius: 38,
            overflow: 'hidden',
            height: 580,
            overflowY: 'auto',
            padding: '18px 14px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            scrollbarWidth: 'none',
          }}>

            {/* brand bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.04em' }}>
                Lyte<span style={{ color: trConfig.accentColor }}>app</span>
              </span>
              <span style={{ fontSize: 8, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Rastreo de pedido
              </span>
            </div>

            {/* hero card */}
            <div style={{ background: 'white', borderRadius: 18, padding: '18px 14px', textAlign: 'center', boxShadow: '0 4px 20px rgba(15,23,42,0.08)' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: trConfig.accentColor + '1A', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: trConfig.accentColor }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 6, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                En preparacion en cocina
              </div>
              <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
                Estamos preparando tu pedido con mucho cuidado. Te avisamos cuando salga.
              </div>
            </div>

            {/* info card */}
            <div style={{ background: 'white', borderRadius: 14, padding: '10px 14px', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Maria Garcia</div>
              <div style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style={{ flexShrink: 0, marginTop: 1, color: '#94A3B8' }}>
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Av. Libertador 1234, Caracas
              </div>
            </div>

            {/* steps card */}
            <div style={{ background: 'white', borderRadius: 14, padding: '14px 14px 10px', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Progreso de tu pedido
              </div>
              {STEPS_PREVIEW.map(({ label, state }, i, arr) => (
                <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: state === 'done' ? '#10B981' : state === 'current' ? trConfig.accentColor : '#F8FAFC',
                      border: `2px solid ${state === 'done' ? '#10B981' : state === 'current' ? trConfig.accentColor : '#E2E8F0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {state === 'done' && (
                        <svg viewBox="0 0 10 10" fill="white" width="8" height="8">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {state === 'current' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ width: 2, height: 18, background: state === 'done' ? '#10B981' : '#E2E8F0', margin: '2px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 18 : 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: state === 'current' ? 700 : 400, lineHeight: '18px',
                      color: state === 'done' ? '#0F172A' : state === 'current' ? trConfig.accentColor : '#CBD5E1',
                    }}>
                      {label}
                    </div>
                    {state === 'current' && (
                      <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                        Tu pedido esta en cocina, lo estan preparando.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* footer */}
            <div style={{ textAlign: 'center', fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
              Powered by <strong style={{ color: '#64748B' }}>LyteApp</strong>
            </div>
          </div>

          {/* home bar */}
          <div style={{ width: 80, height: 4, background: '#3A3A3C', borderRadius: 2, margin: '14px auto 0' }} />
        </div>
      </div>

      {/* ── Tools sidebar ── */}
      <form
        onSubmit={save}
        style={{
          width: 320,
          flexShrink: 0,
          background: 'white',
          borderLeft: '1px solid rgba(15,23,42,0.07)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>Rastreo de pedido</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>Personaliza la pagina de seguimiento del cliente</div>
        </div>

        {/* scrollable tools */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>

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

          {/* Background */}
          <div className="cn-field">
            <div className="cn-label">Color de fondo</div>
            <div className="cn-pill-row" style={{ flexWrap: 'wrap' }}>
              {TR_BG_PRESETS.map(({ color: c, label }) => (
                <button
                  key={c}
                  type="button"
                  className={`cn-pill-btn${trConfig.bgColor === c ? ' selected' : ''}`}
                  onClick={() => setTrConfig(p => ({ ...p, bgColor: c }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: c, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
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

        {/* footer / save */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(15,23,42,0.07)', flexShrink: 0 }}>
          {error   && <div className="cn-error"   style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div className="cn-success" style={{ marginBottom: 12 }}>Guardado correctamente.</div>}
          <button type="submit" className="cn-save-btn" disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

    </div>
  )
}
