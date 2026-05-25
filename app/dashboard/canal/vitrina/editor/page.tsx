'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import './editor.css'

const BG_COLORS = [
  { value: '#FFFFFF', label: 'Blanco',    light: true  },
  { value: '#0F172A', label: 'Negro',     light: false },
  { value: '#64748B', label: 'Pizarra',   light: false },
  { value: '#F5F0E8', label: 'Crema',     light: true  },
  { value: '#D6C9B6', label: 'Arena',     light: true  },
  { value: '#7A9E7E', label: 'Salvia',    light: false },
  { value: '#C4714A', label: 'Terracota', light: false },
  { value: '#1E3A5F', label: 'Marino',    light: false },
]

const ACCENT_COLORS = [
  '#7C3AED', '#2563EB', '#DC2626', '#D97706',
  '#059669', '#DB2777', '#0F172A', '#475569',
]

const FONT_MAP: Record<string, string> = {
  geist:        'var(--font-geist-sans), system-ui, sans-serif',
  simple:       'system-ui, Arial, sans-serif',
  poppins:      'var(--font-poppins), Poppins, sans-serif',
  montserrat:   'var(--font-montserrat), Montserrat, sans-serif',
  raleway:      'var(--font-raleway), Raleway, sans-serif',
  lato:         'var(--font-lato), Lato, sans-serif',
  nunito:       'var(--font-nunito), Nunito, sans-serif',
  oswald:       'var(--font-oswald), Oswald, sans-serif',
  fraunces:     'var(--font-fraunces), Georgia, serif',
  playfair:     'var(--font-playfair), "Playfair Display", serif',
  merriweather: 'var(--font-merriweather), Merriweather, serif',
  cormorant:    'var(--font-cormorant), "Cormorant Garamond", serif',
}

const PAGE_FONTS = [
  { id: 'geist',        name: 'Moderna'    },
  { id: 'simple',       name: 'Simple'     },
  { id: 'poppins',      name: 'Poppins'    },
  { id: 'montserrat',   name: 'Montserrat' },
  { id: 'raleway',      name: 'Raleway'    },
  { id: 'lato',         name: 'Lato'       },
  { id: 'nunito',       name: 'Nunito'     },
  { id: 'oswald',       name: 'Oswald'     },
  { id: 'fraunces',     name: 'Elegante'   },
  { id: 'playfair',     name: 'Clasica'    },
  { id: 'merriweather', name: 'Editorial'  },
  { id: 'cormorant',    name: 'Lujo'       },
]

const TEMPLATES = [
  {
    id: 'clasico',
    name: 'Clasico',
    desc: 'Limpio y profesional',
    preview: (
      <div style={{ background: '#F8F7F4', borderRadius: 6, padding: 6, height: '100%' }}>
        <div style={{ background: '#fff', borderRadius: 4, padding: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#7C3AED' }} />
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, flex: 1 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: 20, background: '#F1F5F9' }} />
              <div style={{ padding: '3px 4px' }}>
                <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, marginBottom: 2 }} />
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, width: '60%' }} />
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
      <div style={{ background: '#0F172A', borderRadius: 6, padding: 6, height: '100%' }}>
        <div style={{ background: '#1E293B', borderRadius: 4, padding: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#7C3AED' }} />
          <div style={{ height: 4, background: '#334155', borderRadius: 2, flex: 1 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: '#1E293B', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: 20, background: '#334155' }} />
              <div style={{ padding: '3px 4px' }}>
                <div style={{ height: 3, background: '#475569', borderRadius: 2, marginBottom: 2 }} />
                <div style={{ height: 3, background: '#334155', borderRadius: 2, width: '60%' }} />
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
    desc: 'Simple y rapido',
    preview: (
      <div style={{ background: '#F8FAFC', borderRadius: 6, padding: 6, height: '100%' }}>
        <div style={{ background: '#fff', borderRadius: 4, padding: 6, marginBottom: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#7C3AED' }} />
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 4, padding: 5, display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 16, height: 16, background: '#F1F5F9', borderRadius: 3, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, marginBottom: 2, width: '70%' }} />
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

const PHOTO_SHAPES_CAT = [
  { id: 'square', name: 'Redondeada' },
  { id: 'sharp',  name: 'Recta'      },
  { id: 'circle', name: 'Circular'   },
]

type Category = { id: string; name: string }

export default function EditorPage() {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [storeId, setStoreId]     = useState<string | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)

  const [pageBg, setPageBg]         = useState('#FFFFFF')
  const [pageFont, setPageFont]     = useState('geist')
  const [fontSizePx, setFontSizePx] = useState(15)
  const [textAlign, setTextAlign]   = useState<'left' | 'center'>('left')
  const [photoShape, setPhotoShape] = useState<'sharp' | 'square' | 'circle'>('square')
  const [photoSize, setPhotoSize]   = useState<'small' | 'medium' | 'large'>('medium')
  const [accentColor, setAccentColor] = useState('#7C3AED')
  const [priceSize, setPriceSize]   = useState<'small' | 'medium' | 'large'>('medium')

  const [template, setTemplate]             = useState('clasico')
  const [categories, setCategories]         = useState<Category[]>([])
  const [categoryShapes, setCategoryShapes] = useState<Record<string, string>>({})
  const [baseConfig, setBaseConfig]         = useState<Record<string, unknown>>({})

  const [activeTool, setActiveTool] = useState<'colors' | 'text' | 'shape' | 'template' | null>(null)
  const [iframeKey, setIframeKey]   = useState(0)
  const [saving, setSaving]         = useState(false)
  const [toolSaved, setToolSaved]   = useState(false)

  const bgPickerRef = useRef<HTMLInputElement>(null)
  const acPickerRef = useRef<HTMLInputElement>(null)

  // ── Load saved config ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: store } = await supabase
        .from('stores')
        .select('id, slug, template, brand_color, template_config')
        .eq('owner_id', data.user.id)
        .maybeSingle()
      if (!store) return
      setStoreId(store.id)
      setStoreSlug(store.slug)
      if ((store as { template?: string }).template) setTemplate((store as { template: string }).template)
      const cfg = (store as { template_config?: Record<string, unknown> }).template_config ?? {}
      setBaseConfig(cfg)
      if (cfg.pageBg)     setPageBg(cfg.pageBg as string)
      if (cfg.pageFont)   setPageFont(cfg.pageFont as string)
      if (cfg.fontSizePx) setFontSizePx(Number(cfg.fontSizePx))
      else if (cfg.fontSize) setFontSizePx(cfg.fontSize === 'small' ? 13 : cfg.fontSize === 'large' ? 18 : 15)
      if (cfg.textAlign)  setTextAlign(cfg.textAlign as 'left' | 'center')
      if (cfg.photoShape) setPhotoShape(cfg.photoShape as 'sharp' | 'square' | 'circle')
      if (cfg.photoSize)  setPhotoSize(cfg.photoSize as 'small' | 'medium' | 'large')
      if (cfg.priceColor) setAccentColor(cfg.priceColor as string)
      else if ((store as { brand_color?: string }).brand_color) setAccentColor((store as { brand_color: string }).brand_color)
      if (cfg.priceSize)  setPriceSize(cfg.priceSize as 'small' | 'medium' | 'large')
      if (cfg.categoryPhotoShapes) setCategoryShapes(cfg.categoryPhotoShapes as Record<string, string>)
      const { data: cats } = await supabase
        .from('categories').select('id,name')
        .eq('store_id', store.id).order('position', { ascending: true })
      if (cats) setCategories(cats)
    })
  }, [])

  // ── Build live preview CSS ─────────────────────────────
  function buildPreviewCSS(): string {
    const font = FONT_MAP[pageFont] ?? ''
    const prSizeMap = { small: '12px', medium: '15px', large: '20px' }

    let shapeCSS = ''
    if (photoShape === 'sharp') {
      shapeCSS = `
        .sf-card { border-radius: 4px !important; }
        .sf-card-img-wrap { border-radius: 0 !important; }
        .sf-card-img { border-radius: 0 !important; }
        .sf-esc-img { border-radius: 2px !important; }
        .sf-cat-img { border-radius: 2px !important; }
        .sf-vit-hero-img-wrap { border-radius: 4px !important; }
      `
    } else if (photoShape === 'circle') {
      shapeCSS = `
        .sf-card { background: transparent !important; border-color: transparent !important; box-shadow: none !important; padding: 0 4px 12px !important; }
        .sf-card:hover { box-shadow: none !important; border-color: transparent !important; }
        .sf-card-img-wrap { border-radius: 50% !important; overflow: visible !important; }
        .sf-card-img { border-radius: 50% !important; }
        .sf-card-img-empty { border-radius: 50% !important; overflow: hidden !important; }
        .sf-card-badge { top: 12% !important; right: 12% !important; }
        .sf-card-body { padding: 10px 4px 0 !important; text-align: center !important; }
        .sf-card-footer { justify-content: center !important; }
        .sf-esc-row { background: transparent !important; border-color: transparent !important; box-shadow: none !important; }
        .sf-esc-img { border-radius: 50% !important; }
        .sf-esc-img-wrap .sf-card-badge { top: -4px !important; right: -4px !important; }
        .sf-cat-card { background: transparent !important; border-color: transparent !important; box-shadow: none !important; }
        .sf-cat-img { border-radius: 50% !important; }
        .sf-cat-img-wrap .sf-card-badge { top: -4px !important; right: -4px !important; }
      `
    } else {
      shapeCSS = `
        .sf-card { border-radius: 18px !important; }
        .sf-card-img-wrap { border-radius: 0 !important; }
        .sf-card-img { border-radius: 0 !important; }
        .sf-esc-img { border-radius: 10px !important; }
        .sf-cat-img { border-radius: 10px !important; }
      `
    }

    const imgSizeCSS = photoSize === 'small' ? `
      .sf-card-img-wrap     { aspect-ratio: 4/3 !important; }
      .sf-esc-img           { width: 48px !important; height: 48px !important; }
      .sf-cat-img           { width: 52px !important; height: 52px !important; }
      .sf-vit-hero-img-wrap { aspect-ratio: 4/3 !important; }
    ` : photoSize === 'large' ? `
      .sf-card-img-wrap     { aspect-ratio: 2/3 !important; }
      .sf-esc-img           { width: 80px !important; height: 80px !important; }
      .sf-cat-img           { width: 86px !important; height: 86px !important; }
      .sf-vit-hero-img-wrap { aspect-ratio: 2/3 !important; }
    ` : ''

    const alignCSS = textAlign === 'center' ? `
      .sf-section-title    { text-align: center !important; }
      .sf-card-body        { text-align: center !important; }
      .sf-card-footer      { justify-content: center !important; }
      .sf-vit-hero-body    { text-align: center !important; align-items: center !important; }
      .sf-vit-hero-footer  { justify-content: center !important; }
      .sf-store-desc       { text-align: center !important; }
      .sf-header-inner     { flex-direction: column !important; align-items: center !important; }
      .sf-esc-info         { text-align: center !important; }
      .sf-cat-info         { text-align: center !important; }
    ` : ''

    return `
      .sf-page {
        ${pageBg ? `background: ${pageBg} !important;` : ''}
        ${font  ? `font-family: ${font} !important;` : ''}
        font-size: ${fontSizePx}px !important;
        --sf-price-color: ${accentColor} !important;
        --sf-price-font: ${font};
      }
      .sf-nav-name       { font-size: ${(fontSizePx * 1.07).toFixed(1)}px !important; }
      .sf-store-name     { font-size: ${(fontSizePx * 1.6).toFixed(1)}px !important; }
      .sf-store-desc     { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-section-title  { font-size: ${(fontSizePx * 1.2).toFixed(1)}px !important; }
      .sf-card-name      { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-card-desc      { font-size: ${(fontSizePx * 0.8).toFixed(1)}px !important; }
      .sf-card-price     { font-size: ${(fontSizePx * 1.07).toFixed(1)}px !important; }
      .sf-vit-hero-name  { font-size: ${(fontSizePx * 1.47).toFixed(1)}px !important; }
      .sf-vit-hero-desc  { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-vit-hero-price { font-size: ${(fontSizePx * 1.73).toFixed(1)}px !important; }
      .sf-esc-name       { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-esc-price      { font-size: ${(fontSizePx * 0.87).toFixed(1)}px !important; }
      .sf-cat-name       { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-cat-desc       { font-size: ${(fontSizePx * 0.8).toFixed(1)}px !important; }
      .sf-cat-price      { font-size: ${fontSizePx}px !important; }
      .sf-modal-name     { font-size: ${(fontSizePx * 1.13).toFixed(1)}px !important; }
      .sf-modal-desc     { font-size: ${(fontSizePx * 0.87).toFixed(1)}px !important; }
      .sf-cart-label     { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${font ? `font-family: ${font} !important;` : ''} }
      .sf-cart-total     { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${font ? `font-family: ${font} !important;` : ''} }
      .sf-cart-badge     { font-size: ${(fontSizePx * 0.8).toFixed(1)}px !important; }
      .sf-co-price       { ${font ? `font-family: ${font} !important;` : ''} }
      .sf-co-total-amt   { ${font ? `font-family: ${font} !important;` : ''} }
      .sf-card-price, .sf-esc-price, .sf-cat-price, .sf-vit-hero-price {
        color: ${accentColor} !important;
        font-size: ${prSizeMap[priceSize]} !important;
        ${font ? `font-family: ${font} !important;` : ''}
      }
      .sf-card-badge   { background: ${accentColor} !important; }
      .sf-cart-bar     { background: ${accentColor} !important; }
      .sf-add-btn      { background: ${accentColor} !important; }
      .sf-submit-btn   { background: ${accentColor} !important; }
      .sf-confirm-btn  { background: ${accentColor} !important; }
      .sf-modal-confirm { background: ${accentColor} !important; }
      .sf-modal-chip.selected { background: ${accentColor} !important; border-color: ${accentColor} !important; }
      .sf-modal-extra-check.on { background: ${accentColor} !important; border-color: ${accentColor} !important; }
      .sf-modal-extra.selected { border-color: ${accentColor} !important; }
      .sf-modal-base-price  { color: ${accentColor} !important; }
      .sf-modal-extra-price { color: ${accentColor} !important; }
      .sf-payment-radio.on  { background: ${accentColor} !important; border-color: ${accentColor} !important; }
      .sf-payment-opt.selected { border-color: ${accentColor} !important; }
      .sf-qty button { color: ${accentColor} !important; }
      .sf-qty span   { color: ${accentColor} !important; }
      .sf-co-price   { color: ${accentColor} !important; }
      .sf-co-opt-tag { color: ${accentColor} !important; }
      .sf-co-edit-btn { color: ${accentColor} !important; }
      ${shapeCSS}
      ${imgSizeCSS}
      ${alignCSS}
    `
  }

  // ── Inject CSS into iframe ─────────────────────────────
  function applyPreview() {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.head) return
    let el = doc.getElementById('ed-preview') as HTMLStyleElement | null
    if (!el) {
      el = doc.createElement('style')
      el.id = 'ed-preview'
      doc.head.appendChild(el)
    }
    el.textContent = buildPreviewCSS()
  }

  useEffect(() => {
    applyPreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageBg, pageFont, fontSizePx, textAlign, photoShape, photoSize, accentColor, priceSize])

  // ── Save to DB ─────────────────────────────────────────
  async function saveSettings() {
    if (!storeId || saving) return
    setSaving(true)
    const template_config = {
      ...baseConfig,
      pageBg, pageFont, fontSizePx, textAlign,
      photoShape, photoSize,
      priceColor: accentColor, priceFont: pageFont, priceSize,
      ...(Object.keys(categoryShapes).length > 0
        ? { categoryPhotoShapes: categoryShapes }
        : { categoryPhotoShapes: undefined }),
    }
    await supabase.from('stores').update({
      template,
      brand_color: accentColor,
      template_config,
    }).eq('id', storeId)
    setBaseConfig(template_config)
    setSaving(false)
    setToolSaved(true)
    setIframeKey(k => k + 1)
    setTimeout(() => setToolSaved(false), 2000)
  }

  const isCustomBg = !BG_COLORS.some(c => c.value === pageBg)
  const isCustomAc = !ACCENT_COLORS.includes(accentColor)

  function PanelSave() {
    return (
      <div className="ed-tp-actions">
        <button className="ed-tp-save" onClick={saveSettings} disabled={saving}>
          {toolSaved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button className="ed-tp-close" onClick={() => setActiveTool(null)} title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="ed-app">

      {/* ── CANVAS ──────────────────────────────────── */}
      <main className="ed-canvas">
        <div className="ed-canvas-scroll">
          <div className="ed-device">
            <div className="ed-device-chrome">
              <div className="ed-device-chrome-dots">
                <span className="ed-dot" /><span className="ed-dot" /><span className="ed-dot" />
              </div>
              <span className="ed-url">
                {storeSlug ? `lyte-app.com/${storeSlug}` : 'lyte-app.com/tu-tienda'}
              </span>
            </div>

            <div className="ed-device-content">
              {storeSlug ? (
                <iframe
                  ref={iframeRef}
                  key={iframeKey}
                  src={`/${storeSlug}`}
                  className="ed-preview-iframe"
                  title="Vista previa"
                  onLoad={() => applyPreview()}
                />
              ) : (
                <div className="ed-preview-empty">
                  <div className="ed-insp-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <p>Configura tu tienda primero</p>
                </div>
              )}
            </div>

            <div className="ed-device-bottom">
              <div className="ed-home-bar" />
            </div>
          </div>
        </div>
      </main>

      {/* ── SIDE BAR ────────────────────────────────── */}
      <aside className="ed-side-bar">

        {/* Color de fondo */}
        <button
          className={`ed-tool-btn${activeTool === 'colors' ? ' ed-tool-active' : ''}`}
          title="Color de fondo"
          onClick={() => setActiveTool(p => p === 'colors' ? null : 'colors')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".6" fill="currentColor" stroke="none" />
            <circle cx="17.5" cy="10.5" r=".6" fill="currentColor" stroke="none" />
            <circle cx="8.5"  cy="7.5"  r=".6" fill="currentColor" stroke="none" />
            <circle cx="6.5"  cy="12.5" r=".6" fill="currentColor" stroke="none" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13C12.99 18.84 12.8 18.49 12.8 18c0-.92.75-1.65 1.65-1.65H16c2.7 0 5-2.3 5-5C21 6.23 16.97 2 12 2z" />
          </svg>
        </button>

        {/* Letras */}
        <button
          className={`ed-tool-btn${activeTool === 'text' ? ' ed-tool-active' : ''}`}
          title="Letras"
          onClick={() => setActiveTool(p => p === 'text' ? null : 'text')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20L10 4L16 20M6.5 14h7" />
          </svg>
        </button>

        {/* Fotos */}
        <button
          className={`ed-tool-btn${activeTool === 'shape' ? ' ed-tool-active' : ''}`}
          title="Fotos"
          onClick={() => setActiveTool(p => p === 'shape' ? null : 'shape')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="9" height="9" rx="2" />
            <circle cx="18" cy="11.5" r="4.5" />
          </svg>
        </button>

        {/* Plantilla */}
        <button
          className={`ed-tool-btn${activeTool === 'template' ? ' ed-tool-active' : ''}`}
          title="Plantilla"
          onClick={() => setActiveTool(p => p === 'template' ? null : 'template')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="5" rx="1" />
            <rect x="3" y="11" width="8" height="10" rx="1" />
            <rect x="13" y="11" width="8" height="10" rx="1" />
          </svg>
        </button>

        {/* Salir */}
        <button
          className="ed-tool-btn ed-tool-exit"
          title="Salir"
          onClick={() => router.push('/dashboard/canal/vitrina')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Backdrop */}
        {activeTool && <div className="ed-tool-backdrop" onClick={() => setActiveTool(null)} />}

        {/* Panel — Color de fondo */}
        {activeTool === 'colors' && (
          <div className="ed-tool-panel">
            <div className="ed-tp-title">Color de fondo</div>
            <div className="ed-tp-swatches">
              {BG_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`ed-tp-swatch${pageBg === c.value ? ' ed-tp-active' : ''}${c.light ? ' ed-tp-light' : ''}`}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => setPageBg(c.value)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomBg ? ' ed-tp-active' : ''}`}
                style={isCustomBg ? { background: pageBg } : undefined}
                title="Personalizado"
                onClick={() => bgPickerRef.current?.click()}
              >
                {!isCustomBg && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={bgPickerRef}
                type="color"
                value={isCustomBg ? pageBg : '#FFFFFF'}
                onChange={e => setPageBg(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>
            <PanelSave />
          </div>
        )}

        {/* Panel — Letras */}
        {activeTool === 'text' && (
          <div className="ed-tool-panel ed-tool-panel-lg ed-tool-panel-type">
            <div className="ed-tp-title">Letras</div>

            <div className="ed-tp-subtitle">Fuente</div>
            <div className="ed-font-grid">
              {PAGE_FONTS.map(f => (
                <button
                  key={f.id}
                  className={`ed-font-card${pageFont === f.id ? ' ed-font-card-active' : ''}`}
                  onClick={() => setPageFont(f.id)}
                >
                  <span className="ed-font-card-preview" style={{ fontFamily: FONT_MAP[f.id] }}>Aa</span>
                  <span className="ed-font-card-name">{f.name}</span>
                </button>
              ))}
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>
              Tamano
              <span className="ed-size-slider-val">{fontSizePx}px</span>
            </div>
            <div className="ed-size-slider-wrap">
              <span className="ed-size-slider-hint">A</span>
              <input
                type="range"
                min={12}
                max={22}
                step={1}
                value={fontSizePx}
                onChange={e => setFontSizePx(Number(e.target.value))}
                className="ed-size-slider"
              />
              <span className="ed-size-slider-hint ed-size-slider-hint-lg">A</span>
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Alineacion</div>
            <div className="ed-align-opts">
              <button
                className={`ed-align-opt${textAlign === 'left' ? ' ed-align-opt-active' : ''}`}
                onClick={() => setTextAlign('left')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6"  x2="21" y2="6"  />
                  <line x1="3" y1="12" x2="15" y2="12" />
                  <line x1="3" y1="18" x2="18" y2="18" />
                </svg>
                Izquierda
              </button>
              <button
                className={`ed-align-opt${textAlign === 'center' ? ' ed-align-opt-active' : ''}`}
                onClick={() => setTextAlign('center')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6"  x2="21" y2="6"  />
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
                Centro
              </button>
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Color de acento</div>
            <div className="ed-tp-swatches" style={{ position: 'relative' }}>
              {ACCENT_COLORS.map(c => (
                <button
                  key={c}
                  className={`ed-tp-swatch${accentColor === c ? ' ed-tp-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setAccentColor(c)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomAc ? ' ed-tp-active' : ''}`}
                style={isCustomAc ? { background: accentColor } : undefined}
                title="Personalizado"
                onClick={() => acPickerRef.current?.click()}
              >
                {!isCustomAc && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={acPickerRef}
                type="color"
                value={isCustomAc ? accentColor : '#7C3AED'}
                onChange={e => setAccentColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <PanelSave />
          </div>
        )}

        {/* Panel — Fotos */}
        {activeTool === 'shape' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Fotos</div>
            <div className="ed-tp-subtitle">Forma global</div>
            <div className="ed-shape-opts">
              {([
                { id: 'sharp',  label: 'Angular',    icon: <rect x="3" y="3" width="18" height="18" rx="1" /> },
                { id: 'square', label: 'Redondeada', icon: <rect x="3" y="3" width="18" height="18" rx="6" /> },
                { id: 'circle', label: 'Circular',   icon: <circle cx="12" cy="12" r="9" /> },
              ] as const).map(s => (
                <button
                  key={s.id}
                  className={`ed-shape-opt${photoShape === s.id ? ' ed-shape-opt-active' : ''}`}
                  onClick={() => setPhotoShape(s.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{s.icon}</svg>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Tamano</div>
            <div className="ed-size-opts">
              {([
                { id: 'small',  label: 'Compacto' },
                { id: 'medium', label: 'Normal'   },
                { id: 'large',  label: 'Grande'   },
              ] as const).map(s => (
                <button
                  key={s.id}
                  className={`ed-size-opt${photoSize === s.id ? ' ed-size-opt-active' : ''}`}
                  onClick={() => setPhotoSize(s.id)}
                >
                  <svg
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    className="ed-size-preview" style={{ width: 24, height: 24 }}
                  >
                    {s.id === 'small'  && <rect x="4"  y="7"  width="16" height="10" rx="2" />}
                    {s.id === 'medium' && <rect x="4"  y="4"  width="16" height="16" rx="2" />}
                    {s.id === 'large'  && <rect x="6"  y="2"  width="12" height="20" rx="2" />}
                  </svg>
                  <span className="ed-size-label">{s.label}</span>
                </button>
              ))}
            </div>

            {categories.length > 0 && (
              <>
                <div className="ed-tp-divider" />
                <div className="ed-tp-subtitle">Forma por categoria</div>
                <div className="ed-cat-shapes">
                  {categories.map(cat => (
                    <div key={cat.id} className="ed-cat-shape-row">
                      <div className="ed-cat-shape-label">{cat.name}</div>
                      <div className="ed-cat-shape-pills">
                        <button
                          type="button"
                          className={`ed-cat-pill${!categoryShapes[cat.id] ? ' ed-cat-pill-active' : ''}`}
                          onClick={() => setCategoryShapes(p => { const n = { ...p }; delete n[cat.id]; return n })}
                        >
                          Global
                        </button>
                        {PHOTO_SHAPES_CAT.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className={`ed-cat-pill${categoryShapes[cat.id] === s.id ? ' ed-cat-pill-active' : ''}`}
                            onClick={() => setCategoryShapes(p => ({ ...p, [cat.id]: s.id }))}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <PanelSave />
          </div>
        )}

        {/* Panel — Plantilla */}
        {activeTool === 'template' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Plantilla</div>
            <div className="ed-tp-subtitle">Estilo de tu tienda</div>
            <div className="ed-template-grid">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`ed-template-card${template === t.id ? ' ed-template-card-active' : ''}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <div className="ed-template-preview">{t.preview}</div>
                  <div className="ed-template-foot">
                    <div className="ed-template-name">{t.name}</div>
                    <div className="ed-template-desc">{t.desc}</div>
                  </div>
                  {template === t.id && <div className="ed-template-check">&#10003;</div>}
                </button>
              ))}
            </div>
            <PanelSave />
          </div>
        )}

      </aside>
    </div>
  )
}
