'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

type Category = { id: string; name: string }

const TR_ACCENT_PRESETS = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#059669', '#DB2777', '#0F172A', '#64748B']

const MAP_STYLE_PRESETS = [
  { id: 'mapbox://styles/mapbox/standard',              label: 'Estandar', bg: '#E4EAF1', road1: '#ffffff', road2: '#FFEBC2', building: '#F1ECE0', terrain: '#D9E8C8', dark: false },
  { id: 'mapbox://styles/mapbox/dark-v11',              label: 'Oscuro',   bg: '#1A1A2E', road1: '#3D3D5C', road2: '#2A2A42', building: '#252540', terrain: '#1E2E1E', dark: true  },
  { id: 'mapbox://styles/mapbox/light-v11',             label: 'Minimal',  bg: '#F8F8F5', road1: '#FEFEFE', road2: '#F0F0E8', building: '#E8E8E2', terrain: '#E4EFD8', dark: false },
  { id: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satelite', bg: '#2C4A30', road1: '#C8D8B8', road2: '#8A9880', building: '#3A5A3C', terrain: '#223A24', dark: true  },
  { id: 'mapbox://styles/mapbox/navigation-night-v1',   label: 'Nocturno', bg: '#0F1923', road1: '#1F3347', road2: '#172840', building: '#162136', terrain: '#0A1A0C', dark: true  },
]
const TR_BG_PRESETS = [
  { color: '#F1EFE9', label: 'Cálido'  },
  { color: '#FFFFFF', label: 'Blanco'  },
  { color: '#F8FAFC', label: 'Gris'    },
  { color: '#FFF7ED', label: 'Naranja' },
  { color: '#F0FDF4', label: 'Menta'   },
]
const TR_FONTS = [
  { id: 'system',           name: 'Sistema'  },
  { id: 'Inter',            name: 'Inter'    },
  { id: 'Roboto',           name: 'Roboto'   },
  { id: 'Poppins',          name: 'Poppins'  },
  { id: 'Montserrat',       name: 'Monts.'   },
  { id: 'Lato',             name: 'Lato'     },
  { id: 'DM Sans',          name: 'DM Sans'  },
  { id: 'Nunito',           name: 'Nunito'   },
  { id: 'Raleway',          name: 'Raleway'  },
  { id: 'Oswald',           name: 'Oswald'   },
  { id: 'Playfair Display', name: 'Playfair' },
  { id: 'Ubuntu',           name: 'Ubuntu'   },
]
const TR_SIZES = [
  { id: 'sm', name: 'Pequeña' },
  { id: 'md', name: 'Normal'  },
  { id: 'lg', name: 'Grande'  },
]

interface TrackingConfig {
  mode: 'status' | 'location'
  accentColor: string
  bgColor: string
  fontFamily: string
  fontSize: string
  mapStyle: string
  statusConnectorSize:   'sm' | 'md' | 'lg'
  locationConnectorSize: 'sm' | 'md' | 'lg'
}

const DEFAULT_TR_CONFIG: TrackingConfig = {
  mode: 'status',
  accentColor: '#7C3AED',
  bgColor: '#F1EFE9',
  fontFamily: 'system',
  fontSize: 'md',
  mapStyle: 'mapbox://styles/mapbox/standard',
  statusConnectorSize:   'sm',
  locationConnectorSize: 'sm',
}

const CONN_OPTS = [
  { id: 'sm' as const, label: 'Fina',   px: 2 },
  { id: 'md' as const, label: 'Normal', px: 4 },
  { id: 'lg' as const, label: 'Gruesa', px: 7 },
]

const STEPS_PREVIEW = [
  { label: 'Pedido recibido', state: 'done'    },
  { label: 'En preparacion',  state: 'current' },
  { label: 'Siendo empacado', state: 'future'  },
  { label: 'Tu pedido sale',  state: 'future'  },
  { label: 'Entregado',       state: 'future'  },
]

const FONT_STACKS: Record<string, string> = {
  system:           'system-ui, -apple-system, sans-serif',
  Inter:            "'Inter', system-ui, sans-serif",
  Roboto:           "'Roboto', system-ui, sans-serif",
  Poppins:          "'Poppins', system-ui, sans-serif",
  Montserrat:       "'Montserrat', system-ui, sans-serif",
  Lato:             "'Lato', system-ui, sans-serif",
  'DM Sans':        "'DM Sans', system-ui, sans-serif",
  Nunito:           "'Nunito', system-ui, sans-serif",
  Raleway:          "'Raleway', system-ui, sans-serif",
  Oswald:           "'Oswald', system-ui, sans-serif",
  'Playfair Display':"'Playfair Display', Georgia, serif",
  Ubuntu:           "'Ubuntu', system-ui, sans-serif",
}
const GOOGLE_FONT_URLS: Record<string, string> = {
  Inter:            'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
  Roboto:           'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap',
  Poppins:          'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap',
  Montserrat:       'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap',
  Lato:             'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  'DM Sans':        'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300..900&display=swap',
  Nunito:           'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  Raleway:          'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&display=swap',
  Oswald:           'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap',
  'Playfair Display':'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&display=swap',
  Ubuntu:           'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;700&display=swap',
}
const FONT_SCALE_NUM: Record<string, number> = { sm: 0.875, md: 1, lg: 1.125 }

export default function Apariencia() {
  const { user } = useAuth()
  const [template, setTemplate]             = useState('clasico')
  const [color, setColor]                   = useState('#7C3AED')
  const [baseConfig, setBaseConfig]         = useState<Record<string, unknown>>({})
  const [categories, setCategories]         = useState<Category[]>([])
  const [categoryShapes, setCategoryShapes] = useState<Record<string, string>>({})
  const [trConfig, setTrConfig]             = useState<TrackingConfig>(DEFAULT_TR_CONFIG)
  const [storeLogo, setStoreLogo]           = useState<string | null>(null)
  const [saving, setSaving]                 = useState(false)
  const [success, setSuccess]               = useState(false)
  const [error, setError]                   = useState('')
  const [isMobile, setIsMobile]             = useState(false)
  const [mobileTab, setMobileTab]           = useState<'preview' | 'config'>('preview')
  const trAccentRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('stores')
      .select('id,template,brand_color,template_config,logo_url')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        if (data.template)    setTemplate(data.template)
        if (data.brand_color) setColor(data.brand_color)
        if (data.logo_url)    setStoreLogo(data.logo_url as string)
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

  useEffect(() => {
    const fontName = trConfig.fontFamily
    if (!fontName || fontName === 'system' || !GOOGLE_FONT_URLS[fontName]) return
    const url = GOOGLE_FONT_URLS[fontName]
    if (document.querySelector(`link[href="${url}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }, [trConfig.fontFamily])

  const previewFont  = FONT_STACKS[trConfig.fontFamily] ?? FONT_STACKS.system
  const previewScale = FONT_SCALE_NUM[trConfig.fontSize] ?? 1
  const fs = (n: number) => Math.round(n * previewScale)
  const mapPreset   = MAP_STYLE_PRESETS.find(s => s.id === (trConfig.mapStyle ?? MAP_STYLE_PRESETS[0].id)) ?? MAP_STYLE_PRESETS[0]
  const statusConnW     = CONN_OPTS.find(o => o.id === trConfig.statusConnectorSize)?.px   ?? 2
  const locationConnH   = CONN_OPTS.find(o => o.id === trConfig.locationConnectorSize)?.px ?? 2

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

  void template; void color; void categories; void categoryShapes; void setTemplate; void setColor; void setCategoryShapes

  // ── Shared: phone screen contents ────────────────────────────────────
  const screenContents = (
    <div style={{
      borderRadius: 38,
      overflow: 'hidden',
      height: 580,
      position: 'relative',
      fontFamily: previewFont,
      background: trConfig.mode === 'location' ? mapPreset.bg : trConfig.bgColor,
    }}>

      {/* ── Location mode preview ── */}
      {trConfig.mode === 'location' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <svg viewBox="0 0 480 540" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '56%' }}>
            <rect width="480" height="540" fill={mapPreset.bg}/>
            <polygon points="0,200 120,180 200,260 80,300" fill={mapPreset.terrain} opacity="0.5"/>
            <polygon points="320,80 480,60 480,200 360,180" fill={mapPreset.terrain} opacity="0.5"/>
            <path d="M -20 120 L 100 110 L 200 130 L 320 100 L 460 140" stroke={mapPreset.road1} strokeWidth="32" fill="none" strokeLinecap="round"/>
            <path d="M -20 290 L 90 280 L 220 310 L 360 290 L 480 320" stroke={mapPreset.road2} strokeWidth="28" fill="none" strokeLinecap="round"/>
            <path d="M 80 -20 L 95 130 L 110 290 L 125 440" stroke={mapPreset.road1} strokeWidth="22" fill="none" strokeLinecap="round"/>
            <path d="M 220 -20 L 230 130 L 240 310 L 250 460" stroke={mapPreset.road2} strokeWidth="26" fill="none" strokeLinecap="round"/>
            <path d="M 350 -20 L 360 100 L 370 290 L 380 440" stroke={mapPreset.road1} strokeWidth="22" fill="none" strokeLinecap="round"/>
            <rect x="40" y="160" width="50" height="40" rx="3" fill={mapPreset.building} opacity="0.7"/>
            <rect x="140" y="170" width="60" height="50" rx="3" fill={mapPreset.building} opacity="0.6"/>
            <rect x="270" y="160" width="50" height="40" rx="3" fill={mapPreset.building} opacity="0.7"/>
            <rect x="50" y="330" width="40" height="60" rx="3" fill={mapPreset.building} opacity="0.7"/>
            <rect x="150" y="340" width="55" height="55" rx="3" fill={mapPreset.building} opacity="0.6"/>
            <path d="M 110 295 Q 180 310 235 330 Q 280 350 320 360 L 360 380" stroke={trConfig.accentColor} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="10 6" opacity="0.85"/>
          </svg>

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 14px 32px', background: `linear-gradient(180deg, ${trConfig.accentColor}F2 0%, ${trConfig.accentColor}B3 60%, transparent 100%)`, zIndex: 5 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 400, marginBottom: 2 }}>Tu pedido</div>
            <div style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>#0142 · La Cocina de Sofia</div>
          </div>

          <div style={{ position: 'absolute', top: '38%', left: '38%', transform: 'translate(-50%, -50%)', zIndex: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'white', border: `2.5px solid #4C1D95`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(76,29,149,0.4)' }}>
              <svg viewBox="0 0 20 20" fill="#4C1D95" width="18" height="18">
                <path d="M11 3H8v2H6v2h2v2H6v2h2v2h3v-2h2v-2h-2V7h2V5h-2V3z"/>
                <path fillRule="evenodd" d="M4 18a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4zM2 8h16v8H2V8z" clipRule="evenodd"/>
              </svg>
            </div>
          </div>

          <div style={{ position: 'absolute', top: '50%', left: '65%', transform: 'translate(-50%, -100%)', zIndex: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50% 50% 50% 0', background: '#0F172A', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 3px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 20 20" fill="white" width="10" height="10" style={{ transform: 'rotate(45deg)' }}>
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
            </div>
          </div>

          <div style={{ position: 'absolute', top: 80, right: 10, zIndex: 6, background: 'white', padding: '4px 8px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 5, fontSize: 8, fontWeight: 500, color: '#475569', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
            Actualizado hace 6s
          </div>

          <div style={{ position: 'absolute', top: 'calc(56% - 40px)', left: 0, right: 0, height: 50, background: 'linear-gradient(transparent, #F5F3EF)', zIndex: 4 }} />

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '47%', background: '#F5F3EF', borderRadius: '20px 20px 0 0', zIndex: 10, overflowY: 'auto', scrollbarWidth: 'none' as const }}>
            <div style={{ width: 28, height: 3, background: 'rgba(15,23,42,0.15)', borderRadius: 100, margin: '8px auto 0' }} />
            <div style={{ padding: '10px 14px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                <span style={{ fontSize: 8, color: '#1D9E75', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>en camino</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-1px', lineHeight: 1, color: '#0F172A' }}>8</span>
                <span style={{ fontSize: 13, color: '#475569' }}>min</span>
                <span style={{ fontSize: 9, color: '#475569', marginLeft: 3 }}>· llega 2:55 PM</span>
              </div>
              <div style={{ fontSize: 9, color: '#475569' }}>Luis esta a 1.4 km de tu casa</div>
            </div>
            <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'flex-start' }}>
              {[
                { label: 'Recibido', done: true, active: false },
                { label: 'Preparando', done: true, active: false },
                { label: 'Listo', done: true, active: false },
                { label: 'En camino', done: false, active: true },
                { label: 'Entregado', done: false, active: false },
              ].map(({ label, done, active }, i, arr) => (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                    {i > 0 && <div style={{ flex: 1, height: locationConnH, background: done ? trConfig.accentColor : 'rgba(148,163,184,0.3)', borderRadius: locationConnH }} />}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: (done || active) ? trConfig.accentColor : '#CBD5E1', boxShadow: active ? `0 0 0 3px ${trConfig.accentColor}33` : 'none', zIndex: 1 }} />
                    {i < arr.length - 1 && <div style={{ flex: 1, height: locationConnH, background: (done && !active) ? trConfig.accentColor : 'rgba(148,163,184,0.3)', borderRadius: locationConnH }} />}
                  </div>
                  <span style={{ fontSize: 7, marginTop: 3, textAlign: 'center' as const, lineHeight: 1.2, color: done ? '#475569' : active ? trConfig.accentColor : '#94A3B8', fontWeight: active ? 600 : 400 }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ margin: '0 10px 7px', background: 'white', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, border: '0.5px solid rgba(15,23,42,0.08)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: trConfig.accentColor + '22', color: trConfig.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, flexShrink: 0 }}>LR</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', marginBottom: 1 }}>Luis Ramirez</div>
                <div style={{ fontSize: 9, color: '#475569' }}>Moto AB12C · 4.9</div>
              </div>
            </div>
            <div style={{ margin: '0 10px 7px', borderRadius: 12, padding: '12px 14px', background: `linear-gradient(135deg, #4C1D95, ${trConfig.accentColor})`, color: 'white', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 20 20" fill="white" width="15" height="15"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 8, opacity: 0.8, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 3 }}>PIN de entrega</div>
                  <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: 4, lineHeight: 1 }}>4 7 2 9</div>
                  <div style={{ fontSize: 8, opacity: 0.85, marginTop: 3 }}>Dile este numero a Luis al llegar</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 0 14px', fontSize: 9, color: '#94A3B8' }}>
              Powered by <strong style={{ color: '#64748B' }}>LyteApp</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── Status mode preview — mirrors tracking.css exactly at ~0.78x scale ── */}
      {trConfig.mode === 'status' && (
        <div style={{
          height: '100%', overflowY: 'auto', scrollbarWidth: 'none' as const,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0 14px 32px',
        }}>
          {/* Brand bar — .tr-brand-bar: padding 20px 4px, flex space-between */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <span style={{ fontSize: fs(13), fontWeight: 800, color: '#0F172A', letterSpacing: '-0.04em' }}>
              Lyte<span style={{ color: trConfig.accentColor }}>app</span>
            </span>
            <span style={{ fontSize: fs(8), fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
              Rastreo de pedido
            </span>
          </div>

          {/* Hero card — .tr-hero: bg white, radius 24px, padding 32px 28px, center col, mb 12 */}
          <div style={{
            width: '100%', background: 'white', borderRadius: 18, padding: '22px 16px 18px',
            boxShadow: '0 4px 32px rgba(15,23,42,0.08)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', marginBottom: 9,
          }}>
            {/* .tr-hero-icon.preparing: 72px → 54px, bg #FFF7ED, mb 18 */}
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#FFF7ED', marginBottom: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" width="26" height="26">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            {/* .tr-hero-status: calc(20px*scale), weight 800, #0F172A, mb 8 */}
            <div style={{ fontSize: fs(15), fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 6, lineHeight: 1.2 }}>
              En preparacion en cocina
            </div>
            {/* .tr-hero-sub: calc(14px*scale), #64748B, lh 1.5 */}
            <div style={{ fontSize: fs(11), color: '#64748B', lineHeight: 1.5 }}>
              Estamos preparando tu pedido con mucho cuidado. Te avisamos cuando salga.
            </div>
          </div>

          {/* Info card — .tr-info-card: radius 16px, padding 18px 22px, shadow, mb 12 */}
          <div style={{
            width: '100%', background: 'white', borderRadius: 12, padding: '13px 16px',
            boxShadow: '0 2px 12px rgba(15,23,42,0.06)', marginBottom: 9,
          }}>
            {/* .tr-info-name: calc(16px*scale), weight 700, #0F172A */}
            <div style={{ fontSize: fs(12), fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>Maria Garcia</div>
            {/* .tr-info-row: calc(13px*scale), #64748B, flex, gap 6 */}
            <div style={{ fontSize: fs(10), color: '#64748B', display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 3, lineHeight: 1.5 }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style={{ flexShrink: 0, marginTop: 2, color: '#94A3B8' }}>
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              Av. Libertador 1234, Caracas
            </div>
          </div>

          {/* Map card — simulates tr-map-card showing store location while preparing */}
          <div style={{
            width: '100%', borderRadius: 15, overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(15,23,42,0.06)', marginBottom: 9,
            height: 138, position: 'relative', flexShrink: 0,
          }}>
            {/* SVG fake map */}
            <svg viewBox="0 0 280 138" preserveAspectRatio="xMidYMid slice"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <rect width="280" height="138" fill={mapPreset.bg}/>
              <polygon points="0,75 55,65 95,95 38,115" fill={mapPreset.terrain} opacity="0.45"/>
              <polygon points="155,15 265,5 280,58 195,55" fill={mapPreset.terrain} opacity="0.4"/>
              <path d="M -10 52 L 75 47 L 155 57 L 280 47" stroke={mapPreset.road1} strokeWidth="13" fill="none" strokeLinecap="round"/>
              <path d="M -10 90 L 85 85 L 195 96 L 280 88" stroke={mapPreset.road2} strokeWidth="10" fill="none" strokeLinecap="round"/>
              <path d="M 72 -5 L 76 52 L 80 138" stroke={mapPreset.road1} strokeWidth="10" fill="none" strokeLinecap="round"/>
              <path d="M 170 -5 L 173 48 L 175 138" stroke={mapPreset.road2} strokeWidth="9" fill="none" strokeLinecap="round"/>
              <rect x="8" y="8" width="28" height="20" rx="2" fill={mapPreset.building} opacity="0.7"/>
              <rect x="90" y="8" width="38" height="22" rx="2" fill={mapPreset.building} opacity="0.65"/>
              <rect x="188" y="6" width="32" height="19" rx="2" fill={mapPreset.building} opacity="0.7"/>
              <rect x="8" y="104" width="32" height="24" rx="2" fill={mapPreset.building} opacity="0.65"/>
              <rect x="93" y="106" width="38" height="20" rx="2" fill={mapPreset.building} opacity="0.6"/>
              <rect x="188" y="100" width="30" height="24" rx="2" fill={mapPreset.building} opacity="0.65"/>
            </svg>

            {/* Store marker: logo circle + 3D building */}
            <div style={{
              position: 'absolute', top: 14, left: '34%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.22))', zIndex: 2,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '2px solid white', overflow: 'hidden',
                background: '#F1F5F9', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {storeLogo
                  ? <img src={storeLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <svg viewBox="0 0 20 20" fill={trConfig.accentColor} width="15" height="15">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 4H2v7a2 2 0 002 2h12a2 2 0 002-2V8zm-8 3a1 1 0 011 1v2a1 1 0 01-2 0v-2a1 1 0 011-1z" clipRule="evenodd"/>
                    </svg>
                }
              </div>
              <svg viewBox="0 0 44 36" width="28" height="23" style={{ display: 'block', marginTop: -5 }}>
                <polygon points="2,14 30,14 42,6 14,6" fill={trConfig.accentColor} />
                <polygon points="2,14 30,14 42,6 14,6" fill="rgba(255,255,255,0.22)" />
                <polygon points="30,14 42,6 42,30 30,36" fill={trConfig.accentColor} />
                <polygon points="30,14 42,6 42,30 30,36" fill="rgba(0,0,0,0.28)" />
                <rect x="2" y="14" width="28" height="22" fill={trConfig.accentColor} />
                <rect x="5" y="18" width="9" height="7" rx="1.5" fill="rgba(255,255,255,0.65)" />
                <rect x="16" y="18" width="9" height="7" rx="1.5" fill="rgba(255,255,255,0.65)" />
                <rect x="10" y="28" width="9" height="8" rx="1" fill="rgba(0,0,0,0.25)" />
              </svg>
            </div>

            {/* Customer destination marker */}
            <div style={{
              position: 'absolute', top: 58, left: '82%', transform: 'translateX(-50%)',
              width: 20, height: 20, borderRadius: '50%',
              background: '#10B981', border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(16,185,129,0.4)', zIndex: 2,
            }}>
              <svg viewBox="0 0 20 20" fill="white" width="10" height="10">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>

            {/* Zoom controls (decorative) */}
            <div style={{ position: 'absolute', top: 7, right: 7, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 3 }}>
              {['+', '−'].map(sign => (
                <div key={sign} style={{ width: 16, height: 16, background: 'white', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748B', fontWeight: 700 }}>
                  {sign}
                </div>
              ))}
            </div>
          </div>

          {/* Steps card — .tr-steps-card: radius 20px, padding 24px 22px, shadow, mb 12 */}
          <div style={{
            width: '100%', background: 'white', borderRadius: 15, padding: '17px 15px 13px',
            boxShadow: '0 2px 12px rgba(15,23,42,0.06)', marginBottom: 9,
          }}>
            {/* .tr-steps-title: 10px, weight 700, #94A3B8, uppercase, mb 20 */}
            <div style={{ fontSize: fs(8), fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 14 }}>
              Progreso de tu pedido
            </div>

            {STEPS_PREVIEW.map(({ label, state }, i, arr) => (
              <div key={label} style={{ display: 'flex', gap: 10 }}>
                {/* .tr-step-left: flex col, center, width 28px → 20px */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 20 }}>
                  {/* .tr-dot: 28px circle → 20px */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    background: state === 'done' ? '#10B981' : state === 'current' ? trConfig.accentColor : '#F8FAFC',
                    border: `2px solid ${state === 'done' ? '#10B981' : state === 'current' ? trConfig.accentColor : '#E2E8F0'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {state === 'done' && (
                      <svg viewBox="0 0 16 16" fill="white" width="9" height="9">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
                      </svg>
                    )}
                    {state === 'current' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }} />}
                    {state === 'future' && <span style={{ fontSize: 8, fontWeight: 700, color: '#CBD5E1' }}>{i + 1}</span>}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: statusConnW, flex: 1, minHeight: 20, background: state === 'done' ? '#10B981' : '#E2E8F0', margin: '2px 0', borderRadius: statusConnW }} />
                  )}
                </div>
                {/* .tr-step-body: padding 2px 0 28px → 2px 0 20px; last child 4px */}
                <div style={{ flex: 1, padding: `2px 0 ${i < arr.length - 1 ? 20 : 4}px` }}>
                  {/* .tr-step-label: calc(14px*scale), weight 700, line-height=dot height */}
                  <div style={{
                    fontSize: fs(11), fontWeight: 700, lineHeight: '20px',
                    color: state === 'done' ? '#0F172A' : state === 'current' ? trConfig.accentColor : '#CBD5E1',
                  }}>
                    {label}
                  </div>
                  {/* .tr-step-desc: calc(12px*scale), #64748B */}
                  {state === 'current' && (
                    <div style={{ fontSize: fs(9), color: '#64748B', marginTop: 2, lineHeight: 1.5 }}>
                      Tu pedido esta en cocina, lo estan preparando con mucho cuidado.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer — .tr-footer: mt 24, 12px, #94A3B8 */}
          <div style={{ textAlign: 'center', fontSize: fs(9), color: '#94A3B8', marginTop: 4 }}>
            Powered by <strong style={{ color: '#64748B' }}>LyteApp</strong> · Crea tu tienda gratis
          </div>
        </div>
      )}
    </div>
  )

  // ── Shared: phone frame ───────────────────────────────────────────────
  const phoneFrame = (
    <div style={{
      background: '#1C1C1E',
      borderRadius: 50,
      padding: '16px 10px',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 48px 120px rgba(0,0,0,0.7)',
      width: 310,
      flexShrink: 0,
    }}>
      <div style={{ width: 90, height: 8, background: '#000', borderRadius: 20, margin: '0 auto 14px' }} />
      {screenContents}
      <div style={{ width: 80, height: 4, background: '#3A3A3C', borderRadius: 2, margin: '14px auto 0' }} />
    </div>
  )

  // ── Shared: all tool controls ─────────────────────────────────────────
  const toolsBody = (
    <>
      {/* mode switch */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(15,23,42,0.07)', flexShrink: 0 }}>
        <div className="cn-label" style={{ marginBottom: 8 }}>Estilo de rastreo</div>
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            { id: 'status',   label: 'Estatus', icon: (
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h6a1 1 0 010 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )},
            { id: 'location', label: 'Ubicacion', icon: (
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            )},
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTrConfig(p => ({ ...p, mode: opt.id }))}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: trConfig.mode === opt.id ? 'white' : 'transparent',
                boxShadow: trConfig.mode === opt.id ? '0 1px 4px rgba(15,23,42,0.1)' : 'none',
                fontSize: 12, fontWeight: 600,
                color: trConfig.mode === opt.id ? '#0F172A' : '#94A3B8',
                fontFamily: 'var(--font-geist-sans), sans-serif',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* scrollable controls */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>

        {/* Map style */}
        <div className="cn-field">
          <div className="cn-label">Estilo del mapa</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 6 }}>
            {MAP_STYLE_PRESETS.map(s => {
              const selected = (trConfig.mapStyle ?? MAP_STYLE_PRESETS[0].id) === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTrConfig(p => ({ ...p, mapStyle: s.id }))}
                  style={{
                    border: `2px solid ${selected ? trConfig.accentColor : 'rgba(15,23,42,0.1)'}`,
                    borderRadius: 10,
                    padding: '5px 4px 4px',
                    background: selected ? trConfig.accentColor + '10' : '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <svg viewBox="0 0 42 26" width="100%" style={{ borderRadius: 4, display: 'block' }}>
                    <rect width="42" height="26" fill={s.bg} rx="3"/>
                    <polygon points="0,14 14,12 22,17 42,14" fill={s.terrain} opacity="0.55"/>
                    <path d="M -2 11 L 14 9 L 22 12 L 42 10" stroke={s.road1} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
                    <path d="M -2 18 L 10 17 L 25 20 L 42 18" stroke={s.road2} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    <rect x="3" y="3" width="7" height="5" rx="1" fill={s.building} opacity="0.85"/>
                    <rect x="13" y="2" width="9" height="6" rx="1" fill={s.building} opacity="0.75"/>
                    <rect x="27" y="3" width="8" height="5" rx="1" fill={s.building} opacity="0.8"/>
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: selected ? 700 : 500, color: selected ? trConfig.accentColor : '#475569', lineHeight: 1, whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </button>
              )
            })}
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

        {/* Connector thickness */}
        <div className="cn-field">
          <div className="cn-label">Grosor de la barra de progreso</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {CONN_OPTS.map(({ id, label, px }) => {
              const isStatus   = trConfig.mode === 'status'
              const currentVal = isStatus ? trConfig.statusConnectorSize : trConfig.locationConnectorSize
              const selected   = currentVal === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTrConfig(p => isStatus
                    ? { ...p, statusConnectorSize: id }
                    : { ...p, locationConnectorSize: id }
                  )}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: selected ? trConfig.accentColor + '12' : '#F8FAFC',
                    outline: `2px solid ${selected ? trConfig.accentColor : 'rgba(15,23,42,0.1)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    transition: 'outline-color 0.15s, background 0.15s',
                  }}
                >
                  {trConfig.mode === 'status'
                    ? <div style={{ width: px, height: 28, background: selected ? trConfig.accentColor : '#CBD5E1', borderRadius: px / 2, transition: 'background 0.15s' }} />
                    : <div style={{ height: px, width: 28, background: selected ? trConfig.accentColor : '#CBD5E1', borderRadius: px / 2, transition: 'background 0.15s' }} />
                  }
                  <span style={{ fontSize: 10, fontWeight: selected ? 700 : 500, color: selected ? trConfig.accentColor : '#64748B', fontFamily: 'var(--font-geist-sans), sans-serif' }}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Background — status mode only */}
        {trConfig.mode === 'status' && (
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
        )}

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
    </>
  )

  // ── Shared: save footer ───────────────────────────────────────────────
  const saveFooter = (
    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(15,23,42,0.07)', flexShrink: 0, background: 'white' }}>
      {error   && <div className="cn-error"   style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="cn-success" style={{ marginBottom: 12 }}>Guardado correctamente.</div>}
      <button type="submit" className="cn-save-btn" disabled={saving} style={{ width: '100%' }}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )

  // ── Mobile layout ─────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ margin: '-16px -16px', display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)', background: 'white' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(15,23,42,0.08)', flexShrink: 0, background: 'white' }}>
          {([
            { id: 'preview', label: 'Vista previa' },
            { id: 'config',  label: 'Configurar'   },
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              style={{
                flex: 1, padding: '14px 0', border: 'none',
                background: 'transparent', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
                color: mobileTab === tab.id ? '#7C3AED' : '#94A3B8',
                borderBottom: `2px solid ${mobileTab === tab.id ? '#7C3AED' : 'transparent'}`,
                fontFamily: 'var(--font-geist-sans), sans-serif',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Preview tab */}
        {mobileTab === 'preview' && (
          <div style={{
            flex: 1,
            background: '#0F172A',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '24px 12px 32px',
          }}>
            <div style={{ transform: 'scale(0.82)', transformOrigin: 'top center', flexShrink: 0, marginBottom: '-110px' }}>
              {phoneFrame}
            </div>
          </div>
        )}

        {/* Config tab */}
        {mobileTab === 'config' && (
          <form onSubmit={save} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
            {toolsBody}
            {saveFooter}
          </form>
        )}
      </div>
    )
  }

  // ── Desktop layout ────────────────────────────────────────────────────
  return (
    <div style={{ margin: '-28px -32px', display: 'flex', height: 'calc(100dvh - 56px)', overflow: 'hidden' }}>

      {/* Preview canvas */}
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
        <div style={{ position: 'absolute', top: 20, left: 24, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Vista previa
        </div>
        {phoneFrame}
      </div>

      {/* Tools sidebar */}
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
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>Rastreo de pedido</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>Personaliza la pagina de seguimiento del cliente</div>
        </div>
        {toolsBody}
        {saveFooter}
      </form>

    </div>
  )
}
