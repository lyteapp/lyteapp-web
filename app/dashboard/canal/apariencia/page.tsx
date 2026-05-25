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

export default function Apariencia() {
  const { user } = useAuth()
  const [template, setTemplate] = useState('clasico')
  const [color, setColor] = useState('#7C3AED')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const colorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('template,brand_color').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      if (data.template) setTemplate(data.template)
      if (data.brand_color) setColor(data.brand_color)
    })
  }, [user])

  async function save(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    setError(''); setSuccess(false); setSaving(true)
    const { data: existing } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    const { error: err } = existing
      ? await supabase.from('stores').update({ template, brand_color: color }).eq('id', existing.id)
      : await supabase.from('stores').insert({ owner_id: user.id, template, brand_color: color })
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

        {/* Color */}
        <div className="cn-section">
          <div className="cn-section-head">
            <div className="cn-section-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="cn-section-title">Color principal</div>
              <div className="cn-section-sub">Botones, precios y acentos</div>
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
