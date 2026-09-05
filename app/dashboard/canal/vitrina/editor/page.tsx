'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import './editor.css'

// Shrinks an uploaded content-block image client-side before it goes to
// storage — mirrors the same helper in canal/inicio/page.tsx.
function compressBlockImage(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (!blob || blob.size >= file.size) { resolve(file); return }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
async function uploadBlockImage(file: File, storeId: string) {
  const compressed = await compressBlockImage(file)
  const ext = compressed.name.split('.').pop()
  const path = `blocks/${storeId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('store-assets').upload(path, compressed, { upsert: true, contentType: compressed.type })
  if (error) throw error
  return supabase.storage.from('store-assets').getPublicUrl(path).data.publicUrl
}

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
  inter:        'var(--font-inter), Inter, sans-serif',
  roboto:       'var(--font-roboto), Roboto, sans-serif',
  dmsans:       'var(--font-dm-sans), "DM Sans", sans-serif',
  worksans:     'var(--font-work-sans), "Work Sans", sans-serif',
  manrope:      'var(--font-manrope), Manrope, sans-serif',
  outfit:       'var(--font-outfit), Outfit, sans-serif',
  spacegrotesk: 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
  quicksand:    'var(--font-quicksand), Quicksand, sans-serif',
  josefin:      'var(--font-josefin-sans), "Josefin Sans", sans-serif',
  bebas:        'var(--font-bebas-neue), "Bebas Neue", sans-serif',
  librebask:    'var(--font-libre-baskerville), "Libre Baskerville", serif',
  caveat:       'var(--font-caveat), Caveat, cursive',
  abril:        'var(--font-abril-fatface), "Abril Fatface", serif',
  fredoka:      'var(--font-fredoka), Fredoka, sans-serif',
}

const PAGE_FONTS = [
  { id: 'geist',        name: 'Moderna'    },
  { id: 'simple',       name: 'Simple'     },
  { id: 'inter',        name: 'Inter'      },
  { id: 'roboto',       name: 'Roboto'     },
  { id: 'poppins',      name: 'Poppins'    },
  { id: 'montserrat',   name: 'Montserrat' },
  { id: 'dmsans',       name: 'DM Sans'    },
  { id: 'worksans',     name: 'Work Sans'  },
  { id: 'manrope',      name: 'Manrope'    },
  { id: 'outfit',       name: 'Outfit'     },
  { id: 'spacegrotesk', name: 'Space Grotesk' },
  { id: 'quicksand',    name: 'Quicksand'  },
  { id: 'josefin',      name: 'Josefin Sans' },
  { id: 'raleway',      name: 'Raleway'    },
  { id: 'lato',         name: 'Lato'       },
  { id: 'nunito',       name: 'Nunito'     },
  { id: 'oswald',       name: 'Oswald'     },
  { id: 'bebas',        name: 'Bebas Neue' },
  { id: 'fredoka',      name: 'Fredoka'    },
  { id: 'fraunces',     name: 'Elegante'   },
  { id: 'playfair',     name: 'Clasica'    },
  { id: 'merriweather', name: 'Editorial'  },
  { id: 'cormorant',    name: 'Lujo'       },
  { id: 'librebask',    name: 'Libre Baskerville' },
  { id: 'abril',        name: 'Abril Fatface' },
  { id: 'caveat',       name: 'Manuscrita' },
]

const PHOTO_SHAPES_CAT = [
  { id: 'square', name: 'Redondeada' },
  { id: 'sharp',  name: 'Recta'      },
  { id: 'circle', name: 'Circular'   },
]

const CATEGORY_LAYOUTS = [
  { id: 'grid',       name: 'Cuadricula' },
  { id: 'horizontal', name: 'Horizontal' },
]

type Category = { id: string; name: string }
type ProductLite = { id: string; name: string }
type ContentBlock = {
  id: string; afterId: string; type: 'text' | 'image' | 'video' | 'buttons'; content: string
  fontSize?: number; fontWeight?: number; color?: string; align?: 'left' | 'center' | 'right'
  spacing?: number; font?: string; groupId?: string
  buttonStyle?: 'solid' | 'outline' | 'slide'
  buttonSize?: number | 'sm' | 'md' | 'lg'
  imageSize?: number
  linkUrl?: string
  linkTarget?: 'url' | 'category'
  linkCategoryId?: string
}
type BlockButtonItem = { id: string; label: string; target: 'product' | 'category'; targetId: string }
// Mirrors StoreShell.tsx's buttonSizeMetrics — keeps the dashboard's draft
// preview pixel-for-pixel the same as what actually renders on the store.
function buttonSizeMetrics(buttonSize: number | 'sm' | 'md' | 'lg' | undefined) {
  const fontSize = typeof buttonSize === 'number' ? buttonSize
    : buttonSize === 'sm' ? 12 : buttonSize === 'lg' ? 18 : 14
  const clamped = Math.min(28, Math.max(8, fontSize))
  const padV = Math.max(2, Math.round(clamped * 0.5))
  const padH = Math.round(clamped * 1.3)
  const height = Math.round(clamped * 3.4)
  const thumb = Math.max(16, height - 10)
  const pad = Math.round((height - thumb) / 2)
  return { fontSize: clamped, padV, padH, height, thumb, pad }
}
type BlockGroup = {
  id: string; afterId: string; background?: string; borderRadius?: number; padding?: number
  direction?: 'column' | 'row'; gap?: number
}
type Ad = {
  id: string
  enabled?: boolean
  placement: 'float' | 'popup' | 'bar-top' | 'bar-bottom'
  title?: string
  imageUrl?: string
  buttonLabel?: string
  buttonStyle?: 'solid' | 'outline' | 'slide'
  buttonSize?: number
  buttonColor?: string
  linkTarget?: 'none' | 'url' | 'category' | 'product'
  linkUrl?: string
  linkCategoryId?: string
  linkProductId?: string
  fontSize?: number
  fontWeight?: number
  color?: string
  font?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  inset?: number
  scale?: number
  delaySeconds?: number
  onceOnly?: boolean
  floatSeconds?: number
  categoryId?: string
  barStyle?: 'static' | 'marquee' | 'rotate'
  messages?: string[]
  rotateSeconds?: number
  marqueeSeconds?: number
  topAnchor?: 'screen' | 'header' | 'catnav'
}
function newAd(): Ad {
  return { id: crypto.randomUUID(), enabled: true, placement: 'float' }
}
// Mirrors StoreShell.tsx's estimateAdBarHeight so the preview's header
// push-down matches the real storefront's, pixel for pixel.
function estimateAdBarHeight(ad: Ad): number {
  const bm = buttonSizeMetrics(ad.buttonSize)
  const fontSize = ad.fontSize ?? 13
  const hasText = !!ad.title?.trim() || (ad.messages ?? []).some(m => m.trim())
  const textHeight = hasText ? fontSize * 1.2 : 0
  const buttonHeight = ad.buttonLabel?.trim() ? (ad.buttonStyle === 'slide' ? bm.height : bm.fontSize * 1.2 + bm.padV * 2) : 0
  const contentHeight = Math.max(textHeight, buttonHeight, 16)
  return Math.round(contentHeight + 20)
}

function FontSelect({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (id: string) => void
  options: { id: string; name: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (listRef.current?.contains(t)) return
      setOpen(false)
    }
    function onScroll(e: Event) {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const current = options.find(o => o.id === value)

  return (
    <div className="ed-font-select">
      <button ref={triggerRef} type="button" className="ed-font-select-trigger" onClick={toggleOpen}>
        <span style={{ fontFamily: current?.id ? FONT_MAP[current.id] : undefined }}>
          {current ? current.name : placeholder}
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s', flexShrink: 0 }}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={listRef} className="ed-font-select-list" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}>
          {options.map(o => (
            <button
              key={o.id || '__auto'}
              type="button"
              className={`ed-font-select-item${value === o.id ? ' ed-font-select-item-active' : ''}`}
              style={{ fontFamily: o.id ? FONT_MAP[o.id] : undefined }}
              onClick={() => { onChange(o.id); setOpen(false) }}
            >
              {o.name}
              {value === o.id && (
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export default function EditorPage() {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [storeId, setStoreId]     = useState<string | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)

  const [pageBg, setPageBg]         = useState('#FFFFFF')
  const [cardBg, setCardBg]         = useState('')
  const [pageFont, setPageFont]     = useState('geist')
  const [fontSizePx, setFontSizePx] = useState(15)
  const [textAlign, setTextAlign]   = useState<'left' | 'center'>('left')
  const [photoShape, setPhotoShape] = useState<'sharp' | 'square' | 'circle'>('square')
  const [photoSize, setPhotoSize]   = useState<'small' | 'medium' | 'large'>('medium')
  const [accentColor, setAccentColor] = useState('#7C3AED')
  const [priceColor,  setPriceColor]  = useState('#7C3AED')
  const [catTitleColor, setCatTitleColor] = useState('')
  const [priceSize, setPriceSize]   = useState<'small' | 'medium' | 'large'>('medium')
  const [priceFont, setPriceFont]   = useState('')
  const [catTitleFont, setCatTitleFont]     = useState('')
  const [productNameFont, setProductNameFont] = useState('')

  const [template, setTemplate]             = useState('clasico')
  const [categories, setCategories]         = useState<Category[]>([])
  const [productsLite, setProductsLite]     = useState<ProductLite[]>([])
  const [categoryShapes, setCategoryShapes] = useState<Record<string, string>>({})
  const [categoryLayouts, setCategoryLayouts] = useState<Record<string, string>>({})
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([])
  const [baseConfig, setBaseConfig]         = useState<Record<string, unknown>>({})

  const [categoryNavStyle, setCategoryNavStyle] = useState('pills')
  const [showCatNav, setShowCatNav] = useState(true)
  const [stickyCatNav, setStickyCatNav] = useState(true)
  const [catNavOverBanner, setCatNavOverBanner] = useState(false)
  const [categorySpacing, setCategorySpacing] = useState(0)
  const [logoShape,   setLogoShape]   = useState('rounded')
  const [logoSizePx,  setLogoSizePx]  = useState(34)
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right' | 'none'>('left')
  const [namePosition, setNamePosition] = useState<'left' | 'center' | 'right' | 'none'>('left')
  const [showMenuButton, setShowMenuButton] = useState(false)
  const [showHeaderSearch, setShowHeaderSearch] = useState(false)
  const [showHeaderCart, setShowHeaderCart] = useState(false)
  const [headerIconColor, setHeaderIconColor] = useState('')
  const [headerOverBanner, setHeaderOverBanner] = useState(false)
  const [headerSticky, setHeaderSticky] = useState(false)
  const [modalWizard, setModalWizard] = useState(false)
  const [enableReorder, setEnableReorder] = useState(false)
  const [reorderFloatSeconds, setReorderFloatSeconds] = useState(0)
  const [reorderPosition, setReorderPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('right')
  const [reorderTitle, setReorderTitle] = useState('')
  const [reorderImageUrl, setReorderImageUrl] = useState('')
  const [reorderFontSize, setReorderFontSize] = useState(14)
  const [reorderFontWeight, setReorderFontWeight] = useState(700)
  const [reorderColor, setReorderColor] = useState('')
  const [reorderFont, setReorderFont] = useState('')
  const [reorderButtonStyle, setReorderButtonStyle] = useState<'solid' | 'outline' | 'slide'>('solid')
  const [reorderButtonSize, setReorderButtonSize] = useState(14)
  const [reorderButtonColor, setReorderButtonColor] = useState('')
  const [reorderScale, setReorderScale] = useState(100)
  const [reorderInset, setReorderInset] = useState(16)
  const [ads, setAds] = useState<Ad[]>([])
  const adImgRef = useRef<HTMLInputElement>(null)
  const adImgTargetRef = useRef<string | null>(null)
  const [adImgUploadingId, setAdImgUploadingId] = useState<string | null>(null)
  function updateAd(id: string, patch: Partial<Ad>) {
    setAds(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }
  function removeAd(id: string) {
    setAds(prev => prev.filter(a => a.id !== id))
  }
  const [reorderImgUploading, setReorderImgUploading] = useState(false)
  const reorderImgRef = useRef<HTMLInputElement>(null)
  const [headerHeightPx, setHeaderHeightPx] = useState(56)
  const [contentBlocks, setContentBlocks]   = useState<ContentBlock[]>([])
  const [blockGroups, setBlockGroups]       = useState<BlockGroup[]>([])
  const [groupMode, setGroupMode]           = useState(false)
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set())
  const [newBlockPos,  setNewBlockPos]      = useState('top')
  const [newBlockType, setNewBlockType]     = useState<'text' | 'image' | 'video' | 'buttons'>('text')
  const [newBlockContent, setNewBlockContent] = useState('')
  const [newBlockButtons, setNewBlockButtons] = useState<BlockButtonItem[]>([])
  const [newBlockFontSize, setNewBlockFontSize] = useState(15)
  const [newBlockFontWeight, setNewBlockFontWeight] = useState(400)
  const [newBlockColor, setNewBlockColor] = useState('#0F172A')
  const [newBlockAlign, setNewBlockAlign] = useState<'left' | 'center' | 'right'>('left')
  const [newBlockSpacing, setNewBlockSpacing] = useState(0)
  const [newBlockFont, setNewBlockFont] = useState('')
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [newBlockButtonStyle, setNewBlockButtonStyle] = useState<'solid' | 'outline' | 'slide'>('solid')
  const [newBlockButtonSize, setNewBlockButtonSize] = useState(14)
  const [blockImgUploading, setBlockImgUploading] = useState(false)
  const [newBlockImageSize, setNewBlockImageSize] = useState(100)
  const [newBlockLinkUrl, setNewBlockLinkUrl] = useState('')
  const [newBlockLinkTarget, setNewBlockLinkTarget] = useState<'url' | 'category'>('url')
  const [newBlockLinkCategoryId, setNewBlockLinkCategoryId] = useState('')
  const blockImgRef = useRef<HTMLInputElement>(null)
  const [activeTool, setActiveTool] = useState<'colors' | 'text' | 'shape' | 'price' | 'categories' | 'brand' | 'blocks' | 'product' | 'reorder' | 'ads' | null>(null)
  const [iframeKey, setIframeKey]   = useState(0)
  const [saving, setSaving]         = useState(false)
  const [toolSaved, setToolSaved]   = useState(false)

  const bgPickerRef       = useRef<HTMLInputElement>(null)
  const cardPickerRef     = useRef<HTMLInputElement>(null)
  const acPickerRef       = useRef<HTMLInputElement>(null)
  const acPickerColorsRef    = useRef<HTMLInputElement>(null)
  const pricePickerRef       = useRef<HTMLInputElement>(null)
  const pricePickerColorsRef = useRef<HTMLInputElement>(null)
  const catTitlePickerRef    = useRef<HTMLInputElement>(null)
  const headerIconPickerRef  = useRef<HTMLInputElement>(null)

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
      if (cfg.pageBg)  setPageBg(cfg.pageBg as string)
      if ((cfg as Record<string,unknown>).cardBg !== undefined) setCardBg((cfg as Record<string,unknown>).cardBg as string)
      if ((cfg as Record<string,unknown>).catTitleColor !== undefined) setCatTitleColor((cfg as Record<string,unknown>).catTitleColor as string)
      if (cfg.pageFont)   setPageFont(cfg.pageFont as string)
      if (cfg.fontSizePx) setFontSizePx(Number(cfg.fontSizePx))
      else if (cfg.fontSize) setFontSizePx(cfg.fontSize === 'small' ? 13 : cfg.fontSize === 'large' ? 18 : 15)
      if (cfg.textAlign)  setTextAlign(cfg.textAlign as 'left' | 'center')
      if (cfg.photoShape) setPhotoShape(cfg.photoShape as 'sharp' | 'square' | 'circle')
      if (cfg.photoSize)  setPhotoSize(cfg.photoSize as 'small' | 'medium' | 'large')
      if (cfg.priceColor) setPriceColor(cfg.priceColor as string)
      else if ((store as { brand_color?: string }).brand_color) setPriceColor((store as { brand_color: string }).brand_color)
      if ((cfg as Record<string,unknown>).accentColor) setAccentColor((cfg as Record<string,unknown>).accentColor as string)
      else if (cfg.priceColor) setAccentColor(cfg.priceColor as string)
      else if ((store as { brand_color?: string }).brand_color) setAccentColor((store as { brand_color: string }).brand_color)
      if (cfg.priceSize)  setPriceSize(cfg.priceSize as 'small' | 'medium' | 'large')
      if (cfg.priceFont !== undefined) setPriceFont((cfg.priceFont as string) ?? '')
      if ((cfg as Record<string,unknown>).catTitleFont !== undefined) setCatTitleFont((cfg as Record<string,unknown>).catTitleFont as string)
      if ((cfg as Record<string,unknown>).productNameFont !== undefined) setProductNameFont((cfg as Record<string,unknown>).productNameFont as string)
      if (cfg.categoryPhotoShapes) setCategoryShapes(cfg.categoryPhotoShapes as Record<string, string>)
      if ((cfg as Record<string,unknown>).categoryLayouts) setCategoryLayouts((cfg as Record<string,unknown>).categoryLayouts as Record<string, string>)
      if ((cfg as Record<string,unknown>).hiddenCategoryIds) setHiddenCategoryIds((cfg as Record<string,unknown>).hiddenCategoryIds as string[])
      if (cfg.categoryNavStyle) setCategoryNavStyle(cfg.categoryNavStyle as string)
      if (cfg.showCatNav !== undefined) setShowCatNav(cfg.showCatNav as boolean)
      if (cfg.stickyCatNav !== undefined) setStickyCatNav(cfg.stickyCatNav as boolean)
      if (cfg.catNavOverBanner !== undefined) setCatNavOverBanner(cfg.catNavOverBanner as boolean)
      if ((cfg as Record<string,unknown>).categorySpacing !== undefined) setCategorySpacing(Number((cfg as Record<string,unknown>).categorySpacing))
      if (cfg.logoShape) setLogoShape(cfg.logoShape as string)
      if ((cfg as Record<string, unknown>).logoSizePx) {
        setLogoSizePx(Number((cfg as Record<string, unknown>).logoSizePx))
      } else if (cfg.logoSize) {
        setLogoSizePx(cfg.logoSize === 'small' ? 26 : cfg.logoSize === 'large' ? 46 : 34)
      }
      if (cfg.logoPosition) {
        setLogoPosition(cfg.logoPosition as 'left' | 'center' | 'right' | 'none')
      } else if (cfg.headerLayout) {
        setLogoPosition(cfg.headerLayout === 'solo-nombre' ? 'none' : cfg.headerLayout === 'centrado' ? 'center' : 'left')
      }
      if (cfg.namePosition) {
        setNamePosition(cfg.namePosition as 'left' | 'center' | 'right' | 'none')
      } else if (cfg.headerLayout) {
        setNamePosition(cfg.headerLayout === 'solo-logo' ? 'none' : cfg.headerLayout === 'centrado' ? 'center' : 'left')
      }
      if (cfg.showMenuButton !== undefined) setShowMenuButton(cfg.showMenuButton as boolean)
      if (cfg.showHeaderSearch !== undefined) setShowHeaderSearch(cfg.showHeaderSearch as boolean)
      if (cfg.showHeaderCart !== undefined) setShowHeaderCart(cfg.showHeaderCart as boolean)
      if (cfg.headerIconColor) setHeaderIconColor(cfg.headerIconColor as string)
      if (cfg.headerOverBanner !== undefined) setHeaderOverBanner(cfg.headerOverBanner as boolean)
      if (cfg.headerSticky !== undefined) setHeaderSticky(cfg.headerSticky as boolean)
      if (cfg.modalWizard !== undefined) setModalWizard(cfg.modalWizard as boolean)
      if (cfg.enableReorder !== undefined) setEnableReorder(cfg.enableReorder as boolean)
      if (cfg.reorderFloatSeconds !== undefined) setReorderFloatSeconds(cfg.reorderFloatSeconds as number)
      if (cfg.reorderPosition !== undefined) setReorderPosition(cfg.reorderPosition as 'top' | 'bottom' | 'left' | 'right')
      if (cfg.reorderTitle !== undefined) setReorderTitle(cfg.reorderTitle as string)
      if (cfg.reorderImageUrl !== undefined) setReorderImageUrl(cfg.reorderImageUrl as string)
      if (cfg.reorderFontSize !== undefined) setReorderFontSize(cfg.reorderFontSize as number)
      if (cfg.reorderFontWeight !== undefined) setReorderFontWeight(cfg.reorderFontWeight as number)
      if (cfg.reorderColor !== undefined) setReorderColor(cfg.reorderColor as string)
      if (cfg.reorderFont !== undefined) setReorderFont(cfg.reorderFont as string)
      if (cfg.reorderButtonStyle !== undefined) setReorderButtonStyle(cfg.reorderButtonStyle as 'solid' | 'outline' | 'slide')
      if (cfg.reorderButtonSize !== undefined) setReorderButtonSize(cfg.reorderButtonSize as number)
      if (cfg.reorderButtonColor !== undefined) setReorderButtonColor(cfg.reorderButtonColor as string)
      if (cfg.reorderScale !== undefined) setReorderScale(cfg.reorderScale as number)
      if (cfg.reorderInset !== undefined) setReorderInset(cfg.reorderInset as number)
      if (cfg.ads) setAds(cfg.ads as Ad[])
      if (cfg.headerHeightPx) setHeaderHeightPx(Number(cfg.headerHeightPx))
      if (cfg.contentBlocks) setContentBlocks(cfg.contentBlocks as ContentBlock[])
      if (cfg.blockGroups) setBlockGroups(cfg.blockGroups as BlockGroup[])
      const { data: cats } = await supabase
        .from('categories').select('id,name')
        .eq('store_id', store.id).order('position', { ascending: true })
      if (cats) setCategories(cats)
      const { data: prods } = await supabase
        .from('products').select('id,name')
        .eq('store_id', store.id).order('name', { ascending: true })
      if (prods) setProductsLite(prods)
    })
  }, [])

  // ── Build live preview CSS ─────────────────────────────
  function buildPreviewCSS(): string {
    const font = FONT_MAP[pageFont] ?? ''
    const prFont = priceFont && FONT_MAP[priceFont] ? FONT_MAP[priceFont] : font
    const catFont = catTitleFont && FONT_MAP[catTitleFont] ? FONT_MAP[catTitleFont] : ''
    const prodFont = productNameFont && FONT_MAP[productNameFont] ? FONT_MAP[productNameFont] : ''
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
      ${cardBg ? `.sf-card, .sf-esc-row, .sf-cat-card { background: ${cardBg} !important; }` : ''}
      .sf-page {
        ${pageBg ? `background: ${pageBg} !important;` : ''}
        ${font  ? `font-family: ${font} !important;` : ''}
        font-size: ${fontSizePx}px !important;
        --sf-price-color: ${priceColor} !important;
        --sf-accent-color: ${accentColor} !important;
        --sf-price-font: ${font};
      }
      .sf-nav-name       { font-size: ${(fontSizePx * 1.07).toFixed(1)}px !important; }
      .sf-store-name     { font-size: ${(fontSizePx * 1.6).toFixed(1)}px !important; }
      .sf-store-desc     { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-section-title  { font-size: ${(fontSizePx * 1.2).toFixed(1)}px !important; ${catTitleColor ? `color: ${catTitleColor} !important;` : ''} ${catFont ? `font-family: ${catFont} !important;` : ''} }
      .sf-cat-section    { margin-top: ${categorySpacing}px !important; }
      .sf-card-name      { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${prodFont ? `font-family: ${prodFont} !important;` : ''} }
      .sf-card-desc      { font-size: ${(fontSizePx * 0.8).toFixed(1)}px !important; }
      .sf-card-price     { font-size: ${(fontSizePx * 1.07).toFixed(1)}px !important; }
      .sf-vit-hero-name  { font-size: ${(fontSizePx * 1.47).toFixed(1)}px !important; ${prodFont ? `font-family: ${prodFont} !important;` : ''} }
      .sf-vit-hero-desc  { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; }
      .sf-vit-hero-price { font-size: ${(fontSizePx * 1.73).toFixed(1)}px !important; }
      .sf-esc-name       { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${prodFont ? `font-family: ${prodFont} !important;` : ''} }
      .sf-esc-price      { font-size: ${(fontSizePx * 0.87).toFixed(1)}px !important; }
      .sf-cat-name       { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${prodFont ? `font-family: ${prodFont} !important;` : ''} }
      .sf-cat-desc       { font-size: ${(fontSizePx * 0.8).toFixed(1)}px !important; }
      .sf-cat-price      { font-size: ${fontSizePx}px !important; }
      .sf-modal-name     { font-size: ${(fontSizePx * 1.13).toFixed(1)}px !important; }
      .sf-modal-desc     { font-size: ${(fontSizePx * 0.87).toFixed(1)}px !important; }
      .sf-cart-label     { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${font ? `font-family: ${font} !important;` : ''} }
      .sf-cart-total     { font-size: ${(fontSizePx * 0.93).toFixed(1)}px !important; ${font ? `font-family: ${font} !important;` : ''} }
      .sf-cart-badge     { font-size: ${(fontSizePx * 0.8).toFixed(1)}px !important; }
      .sf-co-price       { ${prFont ? `font-family: ${prFont} !important;` : ''} }
      .sf-co-total-amt   { ${font ? `font-family: ${font} !important;` : ''} }
      .sf-card-price, .sf-esc-price, .sf-cat-price, .sf-vit-hero-price {
        color: ${priceColor} !important;
        font-size: ${prSizeMap[priceSize]} !important;
        ${prFont ? `font-family: ${prFont} !important;` : ''}
      }
      .sf-modal-base-price  { color: ${priceColor} !important; }
      .sf-modal-extra-price { color: ${priceColor} !important; }
      .sf-co-price          { color: ${priceColor} !important; }
      .sf-card-badge   { background: ${accentColor} !important; }
      .sf-cart-bar     { background: ${accentColor} !important; }
      .sf-add-btn      { background: ${accentColor} !important; }
      .sf-submit-btn   { background: ${accentColor} !important; }
      .sf-confirm-btn  { background: ${accentColor} !important; }
      .sf-modal-confirm { background: ${accentColor} !important; }
      .sf-modal-chip.selected { background: ${accentColor} !important; border-color: ${accentColor} !important; }
      .sf-modal-extra-check.on { background: ${accentColor} !important; border-color: ${accentColor} !important; }
      .sf-modal-extra.selected { border-color: ${accentColor} !important; }
      .sf-payment-radio.on  { background: ${accentColor} !important; border-color: ${accentColor} !important; }
      .sf-payment-opt.selected { border-color: ${accentColor} !important; }
      .sf-qty button { color: ${accentColor} !important; }
      .sf-qty span   { color: ${accentColor} !important; }
      .sf-co-opt-tag { color: ${accentColor} !important; }
      .sf-co-edit-btn { color: ${accentColor} !important; }
      ${shapeCSS}
      ${imgSizeCSS}
      ${alignCSS}
      .sf-nav-logo-wrap {
        border-radius: ${logoShape === 'circle' ? '50%' : logoShape === 'square' ? '0' : '8px'} !important;
        height: ${logoSizePx}px !important;
      }
      .sf-topbar-inner { min-height: ${headerHeightPx}px !important; }
      ${headerIconColor ? `.sf-menu-btn, .sf-header-icon-btn { color: ${headerIconColor} !important; }` : ''}
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

    // Live draft preview for a block being composed in "Bloques de contenido"
    // — a floating card in the iframe so text styling, or the chosen button
    // style (including "Deslizar"), shows up before the block is actually
    // added and saved.
    let draft = doc.getElementById('ed-draft-block') as HTMLDivElement | null
    const draftButtonsLabel = newBlockButtons.find(b => b.label.trim())?.label.trim()
    const showDraft = activeTool === 'blocks' && (
      (newBlockType === 'text' && !!newBlockContent.trim()) ||
      (newBlockType === 'buttons' && !!draftButtonsLabel)
    )
    if (showDraft && doc.body) {
      if (!draft) {
        draft = doc.createElement('div')
        draft.id = 'ed-draft-block'
        Object.assign(draft.style, {
          position: 'fixed', top: '12px', left: '12px', right: '12px', zIndex: '999999',
          padding: '10px 14px', background: 'white', border: '2px dashed #7C3AED', borderRadius: '10px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        })
        doc.body.appendChild(draft)
      }
      if (newBlockType === 'text') {
        draft.innerHTML = ''
        draft.textContent = newBlockContent
        draft.style.padding = '10px 14px'
        draft.style.fontSize = `${newBlockFontSize}px`
        draft.style.fontWeight = String(Math.min(900, newBlockFontWeight))
        draft.style.webkitTextStroke = newBlockFontWeight > 900 ? `${Math.min(1.4, ((newBlockFontWeight - 900) / 300) * 1.4)}px currentColor` : ''
        draft.style.color = newBlockColor
        draft.style.textAlign = newBlockAlign
        draft.style.fontFamily = newBlockFont && FONT_MAP[newBlockFont] ? FONT_MAP[newBlockFont] : ''
      } else {
        draft.style.padding = '10px'
        draft.style.fontSize = ''
        draft.style.fontWeight = ''
        draft.style.webkitTextStroke = ''
        draft.style.color = ''
        draft.style.textAlign = ''
        draft.style.fontFamily = ''
        const label = (draftButtonsLabel ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const bm = buttonSizeMetrics(newBlockButtonSize)
        draft.innerHTML = newBlockButtonStyle === 'slide'
          ? `<div class="sf-block-slide-bar" style="pointer-events:none; height:${bm.height}px; --sf-slide-thumb:${bm.thumb}px; --sf-slide-pad:${bm.pad}px;">
               <div class="sf-block-slide-fill"></div>
               <span class="sf-block-slide-label" style="font-size:${Math.max(10, bm.fontSize - 2)}px;">${label}</span>
               <div class="sf-block-slide-thumb">&#8594;</div>
             </div>`
          : `<button type="button" class="sf-block-btn${newBlockButtonStyle === 'outline' ? ' sf-block-btn-outline' : ''}" style="pointer-events:none; width:100%; font-size:${bm.fontSize}px; padding:${bm.padV}px ${bm.padH}px;">${label}</button>`
      }
    } else if (draft) {
      draft.remove()
    }

    // Live draft preview for the "Repetir pedido" floating card while its
    // own tool is open, so position/text/photo/button choices show up
    // immediately without needing a real matched last-order lookup.
    let reorderDraft = doc.getElementById('ed-reorder-preview') as HTMLDivElement | null
    const showReorderDraft = activeTool === 'reorder' && enableReorder
    if (showReorderDraft && doc.body) {
      if (!reorderDraft) {
        reorderDraft = doc.createElement('div')
        reorderDraft.id = 'ed-reorder-preview'
        doc.body.appendChild(reorderDraft)
      }
      reorderDraft.className = `sf-reorder-banner sf-reorder-pos-${reorderPosition}${reorderImageUrl ? ' has-img' : ''}`
      reorderDraft.style.pointerEvents = 'none'
      reorderDraft.style.zIndex = '999999'
      reorderDraft.style.setProperty('--sf-reorder-scale', String(reorderScale / 100))
      reorderDraft.style.setProperty('--sf-reorder-inset', `${reorderInset}px`)
      if (reorderButtonColor) reorderDraft.style.setProperty('--sf-accent-color', reorderButtonColor)
      else reorderDraft.style.removeProperty('--sf-accent-color')
      const reorderBm = buttonSizeMetrics(reorderButtonSize)
      const weight = Math.min(900, reorderFontWeight)
      const stroke = reorderFontWeight > 900 ? Math.min(1.4, ((reorderFontWeight - 900) / 300) * 1.4) : 0
      const fontFamily = reorderFont && FONT_MAP[reorderFont] ? FONT_MAP[reorderFont] : ''
      const titleText = (reorderTitle || '¿Pedimos lo mismo que la ultima vez?').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const imgHtml = reorderImageUrl ? `<img src="${reorderImageUrl}" alt="" class="sf-reorder-img" />` : ''
      const actionHtml = reorderButtonStyle === 'slide'
        ? `<div class="sf-block-slide-bar" style="pointer-events:none; height:${reorderBm.height}px; flex:1; --sf-slide-thumb:${reorderBm.thumb}px; --sf-slide-pad:${reorderBm.pad}px;">
             <div class="sf-block-slide-fill"></div>
             <span class="sf-block-slide-label" style="font-size:${Math.max(10, reorderBm.fontSize - 2)}px;">Repetir pedido</span>
             <div class="sf-block-slide-thumb">&#8594;</div>
           </div>`
        : `<button type="button" class="sf-reorder-btn${reorderButtonStyle === 'outline' ? ' sf-reorder-btn-outline' : ''}" style="pointer-events:none; font-size:${reorderBm.fontSize}px; padding:${reorderBm.padV}px ${reorderBm.padH}px;">Repetir pedido</button>`
      reorderDraft.innerHTML = `
        ${imgHtml}
        <div class="sf-reorder-info">
          <div class="sf-reorder-title" style="font-size:${reorderFontSize}px; font-weight:${weight}; color:${reorderColor || ''}; font-family:${fontFamily}; -webkit-text-stroke:${stroke > 0 ? `${stroke}px currentColor` : ''};">${titleText}</div>
          <div class="sf-reorder-sub">2 productos</div>
        </div>
        <div class="sf-reorder-actions">
          ${actionHtml}
          <button type="button" class="sf-reorder-close" style="pointer-events:none;"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" d="M15 5L5 15M5 5l10 10"/></svg></button>
        </div>
      `
    } else if (reorderDraft) {
      reorderDraft.remove()
    }

    // Live draft preview for the "Anuncios" tool — shows every enabled ad
    // immediately (ignoring its delay/once-only trigger, which only matter
    // on the real storefront) so placement/text/photo/button choices are
    // visible while editing.
    let adsPreview = doc.getElementById('ed-ads-preview') as HTMLDivElement | null
    const visibleAds = activeTool === 'ads' ? ads.filter(a => a.enabled !== false) : []
    if (visibleAds.length > 0 && doc.body) {
      if (!adsPreview) {
        adsPreview = doc.createElement('div')
        adsPreview.id = 'ed-ads-preview'
        doc.body.appendChild(adsPreview)
      }
      const closeBtn = (cls: string) => `<button type="button" class="${cls}" style="pointer-events:none;"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" d="M15 5L5 15M5 5l10 10"/></svg></button>`
      adsPreview.innerHTML = visibleAds.map(ad => {
        const bm = buttonSizeMetrics(ad.buttonSize)
        const weight = Math.min(900, ad.fontWeight ?? 700)
        const stroke = (ad.fontWeight ?? 0) > 900 ? Math.min(1.4, (((ad.fontWeight ?? 0) - 900) / 300) * 1.4) : 0
        const fontFamily = ad.font && FONT_MAP[ad.font] ? FONT_MAP[ad.font] : ''
        const titleText = (ad.title ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const titleStyle = `font-size:${ad.fontSize ?? 14}px; font-weight:${weight}; color:${ad.color || ''}; font-family:${fontFamily}; -webkit-text-stroke:${stroke > 0 ? `${stroke}px currentColor` : ''};`
        const accentStyle = ad.buttonColor ? `--sf-accent-color:${ad.buttonColor};` : ''
        const btnHtml = !ad.buttonLabel?.trim() ? '' : ad.buttonStyle === 'slide'
          ? `<div class="sf-block-slide-bar" style="pointer-events:none; height:${bm.height}px; --sf-slide-thumb:${bm.thumb}px; --sf-slide-pad:${bm.pad}px;">
               <div class="sf-block-slide-fill"></div>
               <span class="sf-block-slide-label" style="font-size:${Math.max(10, bm.fontSize - 2)}px;">${ad.buttonLabel}</span>
               <div class="sf-block-slide-thumb">&#8594;</div>
             </div>`
          : `<button type="button" class="sf-ad-btn${ad.buttonStyle === 'outline' ? ' sf-ad-btn-outline' : ''}" style="pointer-events:none; font-size:${bm.fontSize}px; padding:${bm.padV}px ${bm.padH}px;">${ad.buttonLabel}</button>`

        if (ad.placement === 'float') {
          const pos = ad.position ?? 'right'
          const imgHtml = ad.imageUrl ? `<img src="${ad.imageUrl}" alt="" class="sf-ad-float-img" />` : ''
          return `<div class="sf-ad-float sf-ad-float-pos-${pos}${ad.imageUrl ? ' has-img' : ''}" style="pointer-events:none; --sf-ad-scale:${(ad.scale ?? 100) / 100}; --sf-ad-inset:${ad.inset ?? 16}px; ${accentStyle}">
            ${imgHtml}
            ${ad.title ? `<div class="sf-ad-title sf-ad-float-title" style="${titleStyle}">${titleText}</div>` : ''}
            <div class="sf-ad-float-actions">${btnHtml}${closeBtn('sf-ad-close')}</div>
          </div>`
        }
        if (ad.placement === 'popup') {
          const imgHtml = ad.imageUrl ? `<img src="${ad.imageUrl}" alt="" class="sf-ad-popup-img" />` : ''
          return `<div class="sf-ad-popup-overlay" style="pointer-events:none;">
            <div class="sf-ad-popup-card" style="${accentStyle}">
              ${closeBtn('sf-ad-popup-close')}
              ${imgHtml}
              <div class="sf-ad-popup-body">
                ${ad.title ? `<div class="sf-ad-title" style="${titleStyle}">${titleText}</div>` : ''}
                ${btnHtml}
              </div>
            </div>
          </div>`
        }
        const barSide = ad.placement === 'bar-top' ? 'top' : 'bottom'
        const barStyleKind = ad.barStyle ?? 'static'
        let topStyle = ''
        if (barSide === 'top' && ad.topAnchor && ad.topAnchor !== 'screen') {
          const header = doc.querySelector<HTMLElement>('.sf-topbar')
          const catNav = doc.querySelector<HTMLElement>('.sf-cat-nav')
          const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
          const catNavBottom = catNav ? Math.max(0, catNav.getBoundingClientRect().bottom) : headerBottom
          topStyle = `top:${ad.topAnchor === 'header' ? headerBottom : catNavBottom}px;`
        }
        if (barStyleKind === 'marquee') {
          return `<div class="sf-ad-bar sf-ad-bar-${barSide} sf-ad-bar-marquee" style="pointer-events:none; ${accentStyle} ${topStyle}">
            <div class="sf-ad-bar-marquee-viewport">
              <div class="sf-ad-bar-marquee-track" style="animation-duration:${ad.marqueeSeconds && ad.marqueeSeconds > 0 ? ad.marqueeSeconds : 12}s;">
                <span class="sf-ad-title sf-ad-bar-title" style="${titleStyle}">${titleText}</span>
                <span class="sf-ad-title sf-ad-bar-title" style="${titleStyle}">${titleText}</span>
              </div>
            </div>
            ${btnHtml}
            ${closeBtn('sf-ad-close')}
          </div>`
        }
        if (barStyleKind === 'rotate') {
          const msgs = (ad.messages ?? []).filter(m => m.trim())
          const firstMsg = (msgs[0] ?? ad.title ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          return `<div class="sf-ad-bar sf-ad-bar-${barSide}" style="pointer-events:none; ${accentStyle} ${topStyle}">
            ${firstMsg ? `<div class="sf-ad-title sf-ad-bar-title" style="${titleStyle}">${firstMsg}</div>` : ''}
            ${btnHtml}
            ${closeBtn('sf-ad-close')}
          </div>`
        }
        return `<div class="sf-ad-bar sf-ad-bar-${barSide}" style="pointer-events:none; ${accentStyle} ${topStyle}">
          ${ad.title ? `<div class="sf-ad-title sf-ad-bar-title" style="${titleStyle}">${titleText}</div>` : ''}
          ${btnHtml}
          ${closeBtn('sf-ad-close')}
        </div>`
      }).join('')
    } else if (adsPreview) {
      adsPreview.remove()
    }

    // A screen-anchored top bar ad pushes the header (and whatever it's
    // sticky/glass/fixed to) down by its own estimated height, mirroring the
    // real storefront's --sf-ad-bar-offset mechanism — injected as !important
    // overrides so they win over the page's own React-managed inline styles.
    let adOffsetEl = doc.getElementById('ed-ad-offset-preview') as HTMLStyleElement | null
    const screenTopBarHeight = visibleAds
      .filter(a => a.placement === 'bar-top' && (a.topAnchor ?? 'screen') === 'screen')
      .reduce((sum, a) => sum + estimateAdBarHeight(a), 0)
    if (screenTopBarHeight > 0) {
      if (!adOffsetEl) {
        adOffsetEl = doc.createElement('style')
        adOffsetEl.id = 'ed-ad-offset-preview'
        doc.head.appendChild(adOffsetEl)
      }
      adOffsetEl.textContent = `.sf-page { padding-top: ${screenTopBarHeight}px !important; } .sf-topbar-sticky, .sf-topbar-glass { top: ${screenTopBarHeight}px !important; }`
    } else if (adOffsetEl) {
      adOffsetEl.remove()
    }

    // Live spacing/style for already-placed blocks and groups — sliders here
    // (Separacion, Espacio, Radio, Relleno, color) update the iframe instantly
    // instead of only showing up after Guardar + reload.
    let blocksEl = doc.getElementById('ed-blocks-preview') as HTMLStyleElement | null
    if (!blocksEl) {
      blocksEl = doc.createElement('style')
      blocksEl.id = 'ed-blocks-preview'
      doc.head.appendChild(blocksEl)
    }
    blocksEl.textContent = [
      ...contentBlocks.filter(b => !b.groupId).map(b => `#sf-cb-${b.id} { padding: ${b.spacing ?? 0}px 0 !important; }`),
      ...blockGroups.map(g => `#sf-bg-${g.id} { gap: ${g.gap ?? 12}px !important; padding: ${g.padding ?? 16}px !important; border-radius: ${g.borderRadius ?? 12}px !important; background: ${g.background || '#F8FAFC'} !important; flex-direction: ${g.direction === 'row' ? 'row' : 'column'} !important; }`),
    ].join('\n')
  }

  useEffect(() => {
    applyPreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageBg, cardBg, catTitleColor, pageFont, fontSizePx, textAlign, photoShape, photoSize, accentColor, priceColor, priceSize, priceFont, catTitleFont, productNameFont, categoryNavStyle, categorySpacing, logoShape, logoSizePx, headerHeightPx, headerIconColor, activeTool, newBlockType, newBlockContent, newBlockFontSize, newBlockFontWeight, newBlockColor, newBlockAlign, newBlockFont, contentBlocks, blockGroups, newBlockButtons, newBlockButtonStyle, newBlockButtonSize, enableReorder, reorderPosition, reorderTitle, reorderImageUrl, reorderFontSize, reorderFontWeight, reorderColor, reorderFont, reorderButtonStyle, reorderButtonSize, reorderButtonColor, reorderScale, reorderInset, ads])

  // ── Auto-save category shape (reloads iframe immediately) ─
  async function handleCategoryShape(catId: string, shape: string | null) {
    const next = { ...categoryShapes }
    if (shape) next[catId] = shape
    else delete next[catId]
    setCategoryShapes(next)
    if (!storeId) return
    const newConfig = {
      ...baseConfig,
      categoryPhotoShapes: Object.keys(next).length > 0 ? next : undefined,
    }
    await supabase.from('stores').update({ template_config: newConfig }).eq('id', storeId)
    setBaseConfig(newConfig)
    setIframeKey(k => k + 1)
  }

  // ── Auto-save category layout (reloads iframe immediately) ─
  async function handleCategoryLayout(catId: string, layout: string | null) {
    const next = { ...categoryLayouts }
    if (layout) next[catId] = layout
    else delete next[catId]
    setCategoryLayouts(next)
    if (!storeId) return
    const newConfig = {
      ...baseConfig,
      categoryLayouts: Object.keys(next).length > 0 ? next : undefined,
    }
    await supabase.from('stores').update({ template_config: newConfig }).eq('id', storeId)
    setBaseConfig(newConfig)
    setIframeKey(k => k + 1)
  }

  // Hides a category from the normal nav/scroll — it's still reachable via a
  // direct link from the side menu or an image/button block's "Categoria" target.
  async function handleCategoryHidden(catId: string, hidden: boolean) {
    const next = hidden ? [...hiddenCategoryIds, catId] : hiddenCategoryIds.filter(id => id !== catId)
    setHiddenCategoryIds(next)
    if (!storeId) return
    const newConfig = {
      ...baseConfig,
      hiddenCategoryIds: next.length > 0 ? next : undefined,
    }
    await supabase.from('stores').update({ template_config: newConfig }).eq('id', storeId)
    setBaseConfig(newConfig)
    setIframeKey(k => k + 1)
  }

  // ── Auto-save logo/name position (reloads iframe) ────
  async function handleLogoPosition(pos: 'left' | 'center' | 'right' | 'none') {
    setLogoPosition(pos)
    if (!storeId) return
    const newConfig = { ...baseConfig, logoPosition: pos, logoSizePx, headerLayout: undefined }
    await supabase.from('stores').update({ template_config: newConfig }).eq('id', storeId)
    setBaseConfig(newConfig)
    setIframeKey(k => k + 1)
  }
  async function handleNamePosition(pos: 'left' | 'center' | 'right' | 'none') {
    setNamePosition(pos)
    if (!storeId) return
    const newConfig = { ...baseConfig, namePosition: pos, headerLayout: undefined }
    await supabase.from('stores').update({ template_config: newConfig }).eq('id', storeId)
    setBaseConfig(newConfig)
    setIframeKey(k => k + 1)
  }

  // ── Save all other settings to DB ─────────────────────
  async function saveSettings() {
    if (!storeId || saving) return
    setSaving(true)
    const template_config = {
      ...baseConfig,
      pageBg, cardBg: cardBg || undefined, catTitleColor: catTitleColor || undefined, pageFont, fontSizePx, textAlign,
      photoShape, photoSize,
      priceColor, accentColor, priceFont: priceFont || pageFont, priceSize,
      catTitleFont: catTitleFont || undefined, productNameFont: productNameFont || undefined,
      categoryNavStyle, showCatNav, stickyCatNav, catNavOverBanner, categorySpacing,
      logoShape, logoSizePx, logoPosition, namePosition, showMenuButton, showHeaderSearch, showHeaderCart, headerIconColor: headerIconColor || undefined, headerOverBanner, headerSticky, headerHeightPx, modalWizard, enableReorder, reorderFloatSeconds: reorderFloatSeconds > 0 ? reorderFloatSeconds : undefined,
      reorderPosition: reorderPosition !== 'right' ? reorderPosition : undefined,
      reorderTitle: reorderTitle.trim() || undefined,
      reorderImageUrl: reorderImageUrl || undefined,
      reorderFontSize: reorderFontSize !== 14 ? reorderFontSize : undefined,
      reorderFontWeight: reorderFontWeight !== 700 ? reorderFontWeight : undefined,
      reorderColor: reorderColor || undefined,
      reorderFont: reorderFont || undefined,
      reorderButtonStyle: reorderButtonStyle !== 'solid' ? reorderButtonStyle : undefined,
      reorderButtonSize: reorderButtonSize !== 14 ? reorderButtonSize : undefined,
      reorderButtonColor: reorderButtonColor || undefined,
      reorderScale: reorderScale !== 100 ? reorderScale : undefined,
      reorderInset: reorderInset !== 16 ? reorderInset : undefined,
      ads: ads.length > 0 ? ads : undefined,
      headerLayout: undefined,
      contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
      blockGroups: blockGroups.length > 0 ? blockGroups : undefined,
      ...(Object.keys(categoryShapes).length > 0
        ? { categoryPhotoShapes: categoryShapes }
        : { categoryPhotoShapes: undefined }),
      ...(Object.keys(categoryLayouts).length > 0
        ? { categoryLayouts }
        : { categoryLayouts: undefined }),
      hiddenCategoryIds: hiddenCategoryIds.length > 0 ? hiddenCategoryIds : undefined,
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

  const isCustomBg    = !BG_COLORS.some(c => c.value === pageBg)
  const isCustomCard  = cardBg !== '' && cardBg !== 'transparent' && !BG_COLORS.some(c => c.value === cardBg)
  const isCustomAc    = !ACCENT_COLORS.includes(accentColor)
  const isCustomPrice = !ACCENT_COLORS.includes(priceColor)
  const isCustomHeaderIcon = headerIconColor !== '' && !ACCENT_COLORS.includes(headerIconColor)
  const isCustomCatTitle = catTitleColor !== '' && !ACCENT_COLORS.includes(catTitleColor)

  // ── Content-block groups: enclose several blocks (same position) in one shared box ──
  function toggleBlockForGroup(id: string) {
    setSelectedForGroup(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function groupSelectedBlocks() {
    const selected = contentBlocks.filter(b => selectedForGroup.has(b.id) && !b.groupId)
    if (selected.length < 2) return
    const afterId = selected[0].afterId
    if (!selected.every(b => b.afterId === afterId)) return
    const groupId = crypto.randomUUID()
    setContentBlocks(prev => prev.map(b => selectedForGroup.has(b.id) ? { ...b, groupId } : b))
    setBlockGroups(prev => [...prev, { id: groupId, afterId, background: '#F8FAFC', borderRadius: 12, padding: 16 }])
    setSelectedForGroup(new Set())
    setGroupMode(false)
  }
  function ungroupBlocks(groupId: string) {
    setContentBlocks(prev => prev.map(b => b.groupId === groupId ? { ...b, groupId: undefined } : b))
    setBlockGroups(prev => prev.filter(g => g.id !== groupId))
  }
  function updateBlockGroup(groupId: string, patch: Partial<BlockGroup>) {
    setBlockGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...patch } : g))
  }
  type BlockDisplayUnit = { kind: 'single'; block: ContentBlock } | { kind: 'group'; group: BlockGroup; members: ContentBlock[] }
  function computeBlockDisplayUnits(): BlockDisplayUnit[] {
    const seen = new Set<string>()
    const units: BlockDisplayUnit[] = []
    for (const b of contentBlocks) {
      if (b.groupId) {
        if (seen.has(b.groupId)) continue
        seen.add(b.groupId)
        const group = blockGroups.find(g => g.id === b.groupId)
        if (!group) { units.push({ kind: 'single', block: b }); continue }
        units.push({ kind: 'group', group, members: contentBlocks.filter(m => m.groupId === b.groupId) })
      } else {
        units.push({ kind: 'single', block: b })
      }
    }
    return units
  }
  function renderOrderArrows(afterId: string, index: number, count: number) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, marginTop: 2 }}>
        <button
          onClick={() => moveDisplayUnit(afterId, index, -1)}
          disabled={index === 0}
          style={{ width: 20, height: 16, border: 'none', background: 'transparent', color: '#94A3B8', cursor: index === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0, opacity: index === 0 ? 0.3 : 1, lineHeight: 1 }}
        >
          ▲
        </button>
        <button
          onClick={() => moveDisplayUnit(afterId, index, 1)}
          disabled={index >= count - 1}
          style={{ width: 20, height: 16, border: 'none', background: 'transparent', color: '#94A3B8', cursor: index >= count - 1 ? 'default' : 'pointer', fontSize: 10, padding: 0, opacity: index >= count - 1 ? 0.3 : 1, lineHeight: 1 }}
        >
          ▼
        </button>
      </div>
    )
  }
  // Reorders a display unit (a single block, or a whole group moved as one)
  // relative to the other units sharing the same position — units at a
  // different afterId are never touched, since they render somewhere else
  // on the page entirely.
  function moveDisplayUnit(afterId: string, unitIndex: number, dir: -1 | 1) {
    const matching = contentBlocks.filter(b => b.afterId === afterId)
    const seen = new Set<string>()
    const units: string[][] = []
    for (const b of matching) {
      if (b.groupId) {
        if (seen.has(b.groupId)) continue
        seen.add(b.groupId)
        units.push(matching.filter(m => m.groupId === b.groupId).map(m => m.id))
      } else {
        units.push([b.id])
      }
    }
    const otherIndex = unitIndex + dir
    if (otherIndex < 0 || otherIndex >= units.length) return
    const newUnits = [...units]
    ;[newUnits[unitIndex], newUnits[otherIndex]] = [newUnits[otherIndex], newUnits[unitIndex]]
    const newOrderIds = newUnits.flat()
    const matchingIdSet = new Set(matching.map(b => b.id))
    const blockById = new Map(contentBlocks.map(b => [b.id, b]))
    let ptr = 0
    setContentBlocks(contentBlocks.map(b => {
      if (!matchingIdSet.has(b.id)) return b
      const replacementId = newOrderIds[ptr++]
      return blockById.get(replacementId)!
    }))
  }
  function startEditBlock(b: ContentBlock) {
    setEditingBlockId(b.id)
    setNewBlockPos(b.afterId)
    setNewBlockType(b.type)
    if (b.type === 'buttons') {
      try { setNewBlockButtons(JSON.parse(b.content)) } catch { setNewBlockButtons([]) }
      setNewBlockContent('')
    } else {
      setNewBlockContent(b.content)
      setNewBlockButtons([])
    }
    setNewBlockFontSize(b.fontSize ?? 15)
    setNewBlockFontWeight(b.fontWeight ?? 400)
    setNewBlockColor(b.color ?? '#0F172A')
    setNewBlockAlign(b.align ?? 'left')
    setNewBlockSpacing(b.spacing ?? 0)
    setNewBlockFont(b.font ?? '')
    setNewBlockButtonStyle(b.buttonStyle ?? 'solid')
    setNewBlockButtonSize(buttonSizeMetrics(b.buttonSize).fontSize)
    setNewBlockImageSize(b.imageSize ?? 100)
    setNewBlockLinkUrl(b.linkUrl ?? '')
    setNewBlockLinkTarget(b.linkTarget ?? 'url')
    setNewBlockLinkCategoryId(b.linkCategoryId ?? '')
  }
  function cancelEditBlock() {
    setEditingBlockId(null)
    setNewBlockContent('')
    setNewBlockButtons([])
    setNewBlockFontSize(15)
    setNewBlockFontWeight(400)
    setNewBlockColor('#0F172A')
    setNewBlockAlign('left')
    setNewBlockSpacing(0)
    setNewBlockFont('')
    setNewBlockButtonStyle('solid')
    setNewBlockButtonSize(14)
    setNewBlockImageSize(100)
    setNewBlockLinkUrl('')
    setNewBlockLinkTarget('url')
    setNewBlockLinkCategoryId('')
  }

  function renderBlockItemRow(b: ContentBlock) {
    return (
      <div className="ed-block-item" style={editingBlockId === b.id ? { outline: '2px solid #7C3AED', outlineOffset: 2 } : undefined}>
        <div className="ed-block-item-head">
          <span className="ed-block-item-type">{b.type === 'text' ? 'Texto' : b.type === 'image' ? 'Imagen' : b.type === 'video' ? 'Video' : 'Botones'}</span>
          <span className="ed-block-item-pos">
            {b.afterId === 'top' ? 'Al inicio' : b.afterId === 'bottom' ? 'Al final' : (categories.find(c => c.id === b.afterId)?.name ?? b.afterId)}
          </span>
          <button
            onClick={() => startEditBlock(b)}
            style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
            title="Editar bloque"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className="ed-block-delete"
            onClick={() => {
              setContentBlocks(prev => prev.filter(x => x.id !== b.id))
              if (b.groupId) {
                const remaining = contentBlocks.filter(x => x.groupId === b.groupId && x.id !== b.id)
                if (remaining.length < 2) ungroupBlocks(b.groupId)
              }
              if (editingBlockId === b.id) cancelEditBlock()
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>
        <div className="ed-block-item-preview">
          {b.type === 'buttons'
            ? (() => { try { return (JSON.parse(b.content) as BlockButtonItem[]).map(x => x.label).join(' · ') || '(sin botones)' } catch { return '(sin botones)' } })()
            : (b.content ? b.content.slice(0, 55) + (b.content.length > 55 ? '...' : '') : '(sin contenido)')}
        </div>
        {!b.groupId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>Separacion</span>
            <input
              type="range" min={0} max={60} step={2}
              value={b.spacing ?? 0}
              onChange={e => {
                const val = Number(e.target.value)
                setContentBlocks(prev => prev.map(x => x.id === b.id ? { ...x, spacing: val } : x))
              }}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 10, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right' }}>{b.spacing ?? 0}px</span>
          </div>
        )}
      </div>
    )
  }

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

  // Precomputed once per render: which index each display unit sits at
  // within its own position (afterId), and how many units share that
  // position — drives the reorder arrows' enabled/disabled state.
  const blockDisplayUnits = computeBlockDisplayUnits()
  const blockUnitPositionIndex = new Map<BlockDisplayUnit, number>()
  const blockUnitPositionCount: Record<string, number> = {}
  for (const u of blockDisplayUnits) {
    const key = u.kind === 'single' ? u.block.afterId : u.group.afterId
    const idx = blockUnitPositionCount[key] ?? 0
    blockUnitPositionIndex.set(u, idx)
    blockUnitPositionCount[key] = idx + 1
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
                  src={`/${storeSlug}?preview=1`}
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

        {/* Precios */}
        <button
          className={`ed-tool-btn${activeTool === 'price' ? ' ed-tool-active' : ''}`}
          title="Precios"
          onClick={() => setActiveTool(p => p === 'price' ? null : 'price')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        </button>

        {/* Encabezado */}
        <button
          className={`ed-tool-btn${activeTool === 'brand' ? ' ed-tool-active' : ''}`}
          title="Encabezado"
          onClick={() => setActiveTool(p => p === 'brand' ? null : 'brand')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="8" height="8" rx="2"/>
            <path d="M14 10h7M14 13h5M14 16h6"/>
          </svg>
        </button>

        {/* Categorias */}
        <button
          className={`ed-tool-btn${activeTool === 'categories' ? ' ed-tool-active' : ''}`}
          title="Categorias"
          onClick={() => setActiveTool(p => p === 'categories' ? null : 'categories')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
        </button>

        {/* Bloques */}
        <button
          className={`ed-tool-btn${activeTool === 'blocks' ? ' ed-tool-active' : ''}`}
          title="Bloques de contenido"
          onClick={() => setActiveTool(p => p === 'blocks' ? null : 'blocks')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="7" rx="1"/>
            <path d="M12 13v5M9.5 15.5h5"/>
            <rect x="3" y="14" width="18" height="7" rx="1"/>
          </svg>
        </button>

        {/* Producto */}
        <button
          className={`ed-tool-btn${activeTool === 'product' ? ' ed-tool-active' : ''}`}
          title="Producto"
          onClick={() => setActiveTool(p => p === 'product' ? null : 'product')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7M4 12h11" />
          </svg>
        </button>

        {/* Repetir pedido */}
        <button
          className={`ed-tool-btn${activeTool === 'reorder' ? ' ed-tool-active' : ''}`}
          title="Repetir pedido"
          onClick={() => setActiveTool(p => p === 'reorder' ? null : 'reorder')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>

        {/* Anuncios */}
        <button
          className={`ed-tool-btn${activeTool === 'ads' ? ' ed-tool-active' : ''}`}
          title="Anuncios"
          onClick={() => setActiveTool(p => p === 'ads' ? null : 'ads')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11v2a2 2 0 002 2h1l3 5V4L6 9H5a2 2 0 00-2 2z" />
            <path d="M14 8a4 4 0 010 8" />
            <path d="M17 5a8 8 0 010 14" />
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

        {/* Panel — Color de fondo */}
        {activeTool === 'colors' && (
          <div className="ed-tool-panel">
            <div className="ed-tp-title">Colores</div>

            <div className="ed-tp-subtitle">Fondo de la pagina</div>
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

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Cuadros de productos</div>
            <div className="ed-tp-swatches" style={{ position: 'relative' }}>
              <button
                className={`ed-tp-swatch ed-tp-light${cardBg === '' ? ' ed-tp-active' : ''}`}
                style={{ background: 'white', fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: 0 }}
                title="Auto"
                onClick={() => setCardBg('')}
              >
                Auto
              </button>
              <button
                className={`ed-tp-swatch${cardBg === 'transparent' ? ' ed-tp-active' : ''}`}
                style={{ background: 'transparent', border: '2px dashed #CBD5E1' }}
                title="Transparente"
                onClick={() => setCardBg('transparent')}
              />
              {BG_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`ed-tp-swatch${cardBg === c.value ? ' ed-tp-active' : ''}${c.light ? ' ed-tp-light' : ''}`}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => setCardBg(c.value)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomCard ? ' ed-tp-active' : ''}`}
                style={isCustomCard ? { background: cardBg } : undefined}
                title="Personalizado"
                onClick={() => cardPickerRef.current?.click()}
              >
                {!isCustomCard && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={cardPickerRef}
                type="color"
                value={isCustomCard ? cardBg : '#FFFFFF'}
                onChange={e => setCardBg(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Titulo de categoria</div>
            <div className="ed-tp-swatches" style={{ position: 'relative' }}>
              <button
                className={`ed-tp-swatch ed-tp-light${catTitleColor === '' ? ' ed-tp-active' : ''}`}
                style={{ background: 'white', fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: 0 }}
                title="Auto"
                onClick={() => setCatTitleColor('')}
              >
                Auto
              </button>
              {ACCENT_COLORS.map(c => (
                <button
                  key={c}
                  className={`ed-tp-swatch${catTitleColor === c ? ' ed-tp-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setCatTitleColor(c)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomCatTitle ? ' ed-tp-active' : ''}`}
                style={isCustomCatTitle ? { background: catTitleColor } : undefined}
                title="Personalizado"
                onClick={() => catTitlePickerRef.current?.click()}
              >
                {!isCustomCatTitle && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={catTitlePickerRef}
                type="color"
                value={isCustomCatTitle ? catTitleColor : '#0F172A'}
                onChange={e => setCatTitleColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Precios</div>
            <div className="ed-tp-swatches" style={{ position: 'relative' }}>
              {ACCENT_COLORS.map(c => (
                <button
                  key={c}
                  className={`ed-tp-swatch${priceColor === c ? ' ed-tp-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setPriceColor(c)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomPrice ? ' ed-tp-active' : ''}`}
                style={isCustomPrice ? { background: priceColor } : undefined}
                title="Personalizado"
                onClick={() => pricePickerColorsRef.current?.click()}
              >
                {!isCustomPrice && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={pricePickerColorsRef}
                type="color"
                value={isCustomPrice ? priceColor : '#7C3AED'}
                onChange={e => setPriceColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Acentos (botones)</div>
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
                onClick={() => acPickerColorsRef.current?.click()}
              >
                {!isCustomAc && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={acPickerColorsRef}
                type="color"
                value={isCustomAc ? accentColor : '#7C3AED'}
                onChange={e => setAccentColor(e.target.value)}
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

            <div className="ed-tp-subtitle">Fuente general</div>
            <FontSelect
              value={pageFont}
              onChange={setPageFont}
              options={PAGE_FONTS}
              placeholder="Elegir fuente"
            />

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Fuente de categorias</div>
            <FontSelect
              value={catTitleFont}
              onChange={setCatTitleFont}
              options={[{ id: '', name: 'Igual que la general' }, ...PAGE_FONTS]}
              placeholder="Igual que la general"
            />

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Fuente de productos</div>
            <FontSelect
              value={productNameFont}
              onChange={setProductNameFont}
              options={[{ id: '', name: 'Igual que la general' }, ...PAGE_FONTS]}
              placeholder="Igual que la general"
            />

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
                          onClick={() => handleCategoryShape(cat.id, null)}
                        >
                          Global
                        </button>
                        {PHOTO_SHAPES_CAT.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className={`ed-cat-pill${categoryShapes[cat.id] === s.id ? ' ed-cat-pill-active' : ''}`}
                            onClick={() => handleCategoryShape(cat.id, s.id)}
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

        {/* Panel — Precios */}
        {activeTool === 'price' && (
          <div className="ed-tool-panel ed-tool-panel-lg ed-tool-panel-type">
            <div className="ed-tp-title">Estilo de precios</div>

            <div className="ed-tp-subtitle">Color</div>
            <div className="ed-tp-swatches" style={{ position: 'relative' }}>
              {ACCENT_COLORS.map(c => (
                <button
                  key={c}
                  className={`ed-tp-swatch${priceColor === c ? ' ed-tp-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setPriceColor(c)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomPrice ? ' ed-tp-active' : ''}`}
                style={isCustomPrice ? { background: priceColor } : undefined}
                title="Personalizado"
                onClick={() => pricePickerRef.current?.click()}
              >
                {!isCustomPrice && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={pricePickerRef}
                type="color"
                value={isCustomPrice ? priceColor : '#7C3AED'}
                onChange={e => setPriceColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Tamano</div>
            <div className="ed-size-opts">
              {([
                { id: 'small',  label: 'Pequeno' },
                { id: 'medium', label: 'Mediano'  },
                { id: 'large',  label: 'Grande'   },
              ] as const).map(s => (
                <button
                  key={s.id}
                  className={`ed-size-opt${priceSize === s.id ? ' ed-size-opt-active' : ''}`}
                  onClick={() => setPriceSize(s.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="ed-size-preview" style={{ width: 24, height: 24 }}>
                    {s.id === 'small'  && <text x="4" y="17" fontSize="10" stroke="none" fill="currentColor">$</text>}
                    {s.id === 'medium' && <text x="3" y="18" fontSize="14" stroke="none" fill="currentColor">$</text>}
                    {s.id === 'large'  && <text x="2" y="20" fontSize="18" stroke="none" fill="currentColor">$</text>}
                  </svg>
                  <span className="ed-size-label">{s.label}</span>
                </button>
              ))}
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Fuente</div>
            <FontSelect
              value={priceFont}
              onChange={setPriceFont}
              options={[{ id: '', name: 'Igual que la general' }, ...PAGE_FONTS]}
              placeholder="Igual que la general"
            />

            <PanelSave />
          </div>
        )}

        {/* Panel — Categorias */}
        {activeTool === 'categories' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Categorias</div>
            <div className="ed-tp-subtitle">Estilo de los botones</div>
            <div className="ed-cat-style-grid">
              {([
                {
                  id: 'pills',
                  name: 'Rellenos',
                  preview: (
                    <div style={{ display: 'flex', gap: 5, padding: '8px 10px' }}>
                      {['Todo', 'Comida', 'Bebidas'].map((l, i) => (
                        <div key={l} style={{ padding: '5px 10px', borderRadius: 100, fontSize: 9, fontWeight: i === 0 ? 700 : 500, background: i === 0 ? '#7C3AED' : 'transparent', color: i === 0 ? 'white' : '#94A3B8', whiteSpace: 'nowrap' as const }}>{l}</div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'chips',
                  name: 'Contorno',
                  preview: (
                    <div style={{ display: 'flex', gap: 5, padding: '8px 10px' }}>
                      {['Todo', 'Comida', 'Bebidas'].map((l, i) => (
                        <div key={l} style={{ padding: '4px 9px', borderRadius: 100, fontSize: 9, fontWeight: i === 0 ? 700 : 500, border: `1.5px solid ${i === 0 ? '#7C3AED' : '#E2E8F0'}`, color: i === 0 ? '#7C3AED' : '#94A3B8', whiteSpace: 'nowrap' as const }}>{l}</div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'underline',
                  name: 'Subrayado',
                  preview: (
                    <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', padding: '0 10px' }}>
                      {['Todo', 'Comida', 'Bebidas'].map((l, i) => (
                        <div key={l} style={{ padding: '8px 10px', fontSize: 9, fontWeight: i === 0 ? 700 : 500, borderBottom: `2px solid ${i === 0 ? '#7C3AED' : 'transparent'}`, marginBottom: -2, color: i === 0 ? '#7C3AED' : '#94A3B8', whiteSpace: 'nowrap' as const }}>{l}</div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'boxes',
                  name: 'Cajas',
                  preview: (
                    <div style={{ display: 'flex', gap: 5, padding: '8px 10px' }}>
                      {['Todo', 'Comida', 'Bebidas'].map((l, i) => (
                        <div key={l} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 9, fontWeight: i === 0 ? 700 : 500, background: i === 0 ? '#7C3AED' : 'rgba(15,23,42,0.05)', color: i === 0 ? 'white' : '#94A3B8', whiteSpace: 'nowrap' as const }}>{l}</div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'tabs',
                  name: 'Tabs',
                  preview: (
                    <div style={{ display: 'flex', gap: 5, padding: '8px 10px', background: pageBg || '#FAFAF9' }}>
                      {['Todo', 'Comida', 'Bebidas'].map((l, i) => (
                        <div key={l} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 9, fontWeight: i === 0 ? 700 : 500, background: i === 0 ? '#7C3AED' : (pageBg || '#FAFAF9'), border: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.12)', color: i === 0 ? 'white' : '#64748B', whiteSpace: 'nowrap' as const }}>{l}</div>
                      ))}
                    </div>
                  ),
                },
              ]).map(s => (
                <button
                  key={s.id}
                  className={`ed-cat-style-card${categoryNavStyle === s.id ? ' ed-cat-style-active' : ''}`}
                  onClick={() => setCategoryNavStyle(s.id)}
                >
                  <div className="ed-cat-style-preview">{s.preview}</div>
                  <div className="ed-cat-style-name">{s.name}</div>
                  {categoryNavStyle === s.id && <div className="ed-template-check">&#10003;</div>}
                </button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Mostrar barra de categorias</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Ocultar si prefieres navegar sin barra</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={showCatNav}
                  onChange={e => setShowCatNav(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{ width: 38, height: 22, borderRadius: 100, background: showCatNav ? '#7C3AED' : '#D1D5DB', transition: 'background 0.2s', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 4, left: showCatNav ? 18 : 4, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Anclar al hacer scroll</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>La barra queda fija arriba al bajar la pantalla</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={stickyCatNav}
                  onChange={e => setStickyCatNav(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{ width: 38, height: 22, borderRadius: 100, background: stickyCatNav ? '#7C3AED' : '#D1D5DB', transition: 'background 0.2s', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 4, left: stickyCatNav ? 18 : 4, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Categorias sobre el banner</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Flota en vidrio esmerilado sobre el borde del banner. Necesita un banner subido.</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={catNavOverBanner}
                  onChange={e => setCatNavOverBanner(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{ width: 38, height: 22, borderRadius: 100, background: catNavOverBanner ? '#7C3AED' : '#D1D5DB', transition: 'background 0.2s', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 4, left: catNavOverBanner ? 18 : 4, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </div>
              </div>
            </label>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>
              Separacion entre categorias
              <span className="ed-size-slider-val">{categorySpacing}px</span>
            </div>
            <div className="ed-size-slider-wrap">
              <span className="ed-size-slider-hint">S</span>
              <input
                type="range"
                min={0}
                max={100}
                step={4}
                value={categorySpacing}
                onChange={e => setCategorySpacing(Number(e.target.value))}
                className="ed-size-slider"
              />
              <span className="ed-size-slider-hint ed-size-slider-hint-lg">L</span>
            </div>

            {categories.length > 0 && (
              <>
                <div className="ed-tp-divider" />
                <div className="ed-tp-subtitle">Diseno de productos por categoria</div>
                <div className="ed-tp-hint" style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
                  Cuadricula normal o fila horizontal deslizable
                </div>
                <div className="ed-cat-shapes">
                  {categories.map(cat => (
                    <div key={cat.id} className="ed-cat-shape-row">
                      <div className="ed-cat-shape-label">{cat.name}</div>
                      <div className="ed-cat-shape-pills">
                        {CATEGORY_LAYOUTS.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            className={`ed-cat-pill${(categoryLayouts[cat.id] ?? 'grid') === l.id ? ' ed-cat-pill-active' : ''}`}
                            onClick={() => handleCategoryLayout(cat.id, l.id === 'grid' ? null : l.id)}
                          >
                            {l.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {categories.length > 0 && (
              <>
                <div className="ed-tp-divider" />
                <div className="ed-tp-subtitle">Categorias ocultas</div>
                <div className="ed-tp-hint" style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
                  Una categoria oculta no aparece en la barra ni en el scroll normal — solo se abre desde el menu lateral o un bloque de imagen/boton que apunte a ella
                </div>
                <div className="ed-cat-shapes">
                  {categories.map(cat => {
                    const hidden = hiddenCategoryIds.includes(cat.id)
                    return (
                      <div key={cat.id} className="ed-cat-shape-row">
                        <div className="ed-cat-shape-label">{cat.name}</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={hidden}
                            onChange={e => handleCategoryHidden(cat.id, e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                          />
                          <div style={{ width: 34, height: 20, borderRadius: 100, background: hidden ? '#7C3AED' : '#D1D5DB', transition: 'background 0.2s', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 3, left: hidden ? 17 : 3, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: hidden ? '#7C3AED' : '#94A3B8' }}>{hidden ? 'Oculta' : 'Visible'}</span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <PanelSave />
          </div>
        )}

        {/* Panel — Encabezado */}
        {activeTool === 'brand' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Encabezado</div>

            <div className="ed-tp-subtitle">Posicion del logo</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'left' as const,   label: 'Izquierda' },
                { id: 'center' as const, label: 'Centro'    },
                { id: 'right' as const,  label: 'Derecha'   },
                { id: 'none' as const,   label: 'Oculto'    },
              ]).map(o => (
                <button
                  key={o.id}
                  onClick={() => handleLogoPosition(o.id)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${logoPosition === o.id ? '#7C3AED' : '#E2E8F0'}`,
                    background: logoPosition === o.id ? '#F5F3FF' : 'white',
                    color: logoPosition === o.id ? '#7C3AED' : '#64748B',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Posicion del nombre</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'left' as const,   label: 'Izquierda' },
                { id: 'center' as const, label: 'Centro'    },
                { id: 'right' as const,  label: 'Derecha'   },
                { id: 'none' as const,   label: 'Oculto'    },
              ]).map(o => (
                <button
                  key={o.id}
                  onClick={() => handleNamePosition(o.id)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${namePosition === o.id ? '#7C3AED' : '#E2E8F0'}`,
                    background: namePosition === o.id ? '#F5F3FF' : 'white',
                    color: namePosition === o.id ? '#7C3AED' : '#64748B',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Forma del logo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { id: 'rounded', label: 'Redondeado', radius: '6px' },
                { id: 'circle',  label: 'Circulo',    radius: '50%' },
                { id: 'square',  label: 'Cuadrado',   radius: '0' },
              ]).map(s => (
                <button
                  key={s.id}
                  onClick={() => setLogoShape(s.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '10px 6px', borderRadius: 10, border: `2px solid ${logoShape === s.id ? '#7C3AED' : '#E2E8F0'}`,
                    background: logoShape === s.id ? '#F5F3FF' : 'white', cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: s.radius, background: logoShape === s.id ? '#7C3AED' : '#E2E8F0' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: logoShape === s.id ? '#7C3AED' : '#64748B' }}>{s.label}</span>
                </button>
              ))}
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>
              Tamano del logo
              <span className="ed-size-slider-val">{logoSizePx}px</span>
            </div>
            <div className="ed-size-slider-wrap">
              <div style={{ width: 16, height: 16, borderRadius: 4, background: '#CBD5E1', flexShrink: 0 }} />
              <input
                type="range"
                min={20}
                max={100}
                step={2}
                value={logoSizePx}
                onChange={e => setLogoSizePx(Number(e.target.value))}
                className="ed-size-slider"
              />
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#CBD5E1', flexShrink: 0 }} />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>
              Tamano del encabezado
              <span className="ed-size-slider-val">{headerHeightPx}px</span>
            </div>
            <div className="ed-size-slider-wrap">
              <div style={{ width: 16, height: 10, borderRadius: 3, background: '#CBD5E1', flexShrink: 0 }} />
              <input
                type="range"
                min={32}
                max={100}
                step={2}
                value={headerHeightPx}
                onChange={e => setHeaderHeightPx(Number(e.target.value))}
                className="ed-size-slider"
              />
              <div style={{ width: 28, height: 18, borderRadius: 4, background: '#CBD5E1', flexShrink: 0 }} />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Menu lateral</div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Mostrar boton de menu</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Abre un panel lateral con categorias y enlaces</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={showMenuButton}
                  onChange={e => setShowMenuButton(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: showMenuButton ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: showMenuButton ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Iconos del encabezado</div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Boton de busqueda</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Abre una barra para buscar productos por nombre</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={showHeaderSearch}
                  onChange={e => setShowHeaderSearch(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: showHeaderSearch ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: showHeaderSearch ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Boton de carrito</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Lleva directo al pedido, con un contador de productos</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={showHeaderCart}
                  onChange={e => setShowHeaderCart(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: showHeaderCart ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: showHeaderCart ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Color de los iconos</div>
            <div className="ed-tp-swatches" style={{ position: 'relative' }}>
              <button
                className={`ed-tp-swatch ed-tp-light${headerIconColor === '' ? ' ed-tp-active' : ''}`}
                style={{ background: 'white', fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: 0 }}
                title="Auto"
                onClick={() => setHeaderIconColor('')}
              >
                Auto
              </button>
              {ACCENT_COLORS.map(c => (
                <button
                  key={c}
                  className={`ed-tp-swatch${headerIconColor === c ? ' ed-tp-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setHeaderIconColor(c)}
                />
              ))}
              <button
                className={`ed-tp-swatch ed-tp-custom${isCustomHeaderIcon ? ' ed-tp-active' : ''}`}
                style={isCustomHeaderIcon ? { background: headerIconColor } : undefined}
                title="Personalizado"
                onClick={() => headerIconPickerRef.current?.click()}
              >
                {!isCustomHeaderIcon && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                ref={headerIconPickerRef}
                type="color"
                value={isCustomHeaderIcon ? headerIconColor : '#475569'}
                onChange={e => setHeaderIconColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Encabezado sobre el banner</div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Flotar en vidrio esmerilado</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>El encabezado flota transparente sobre la foto del banner en vez de ir arriba de ella. Necesita un banner subido.</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={headerOverBanner}
                  onChange={e => setHeaderOverBanner(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: headerOverBanner ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: headerOverBanner ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            <div className="ed-tp-subtitle" style={{ marginTop: 14 }}>Anclar encabezado</div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Fijar al hacer scroll</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Queda fijo arriba de la pantalla al hacer scroll, y la barra de categorias se ancla justo debajo si tambien esta anclada.</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={headerSticky}
                  onChange={e => setHeaderSticky(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: headerSticky ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: headerSticky ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            <PanelSave />
          </div>
        )}

        {/* Panel — Bloques de contenido */}
        {activeTool === 'blocks' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Bloques de contenido</div>

            {contentBlocks.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  {groupMode ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={groupSelectedBlocks}
                        disabled={selectedForGroup.size < 2}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: selectedForGroup.size < 2 ? '#E2E8F0' : '#7C3AED', color: selectedForGroup.size < 2 ? '#94A3B8' : 'white', fontSize: 11, fontWeight: 600, cursor: selectedForGroup.size < 2 ? 'default' : 'pointer' }}
                      >
                        Encerrar seleccionados ({selectedForGroup.size})
                      </button>
                      <button
                        onClick={() => { setGroupMode(false); setSelectedForGroup(new Set()) }}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setGroupMode(true)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#7C3AED', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Encerrar bloques en un grupo
                    </button>
                  )}
                </div>
                {groupMode && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
                    Elige 2 o mas bloques que esten en la misma posicion para encerrarlos juntos.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {blockDisplayUnits.map(unit => {
                    const afterId = unit.kind === 'single' ? unit.block.afterId : unit.group.afterId
                    const index = blockUnitPositionIndex.get(unit) ?? 0
                    const count = blockUnitPositionCount[afterId] ?? 1
                    return unit.kind === 'single' ? (
                    <div key={unit.block.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      {renderOrderArrows(afterId, index, count)}
                      {groupMode && !unit.block.groupId && (
                        <input
                          type="checkbox"
                          checked={selectedForGroup.has(unit.block.id)}
                          onChange={() => toggleBlockForGroup(unit.block.id)}
                          style={{ marginTop: 12, flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1 }}>{renderBlockItemRow(unit.block)}</div>
                    </div>
                  ) : (
                    <div key={unit.group.id} className="ed-block-group">
                      <div className="ed-block-group-head">
                        {renderOrderArrows(afterId, index, count)}
                        <span className="ed-block-item-type" style={{ background: '#EDE9FE', color: '#7C3AED' }}>Grupo · {unit.members.length} bloques</span>
                        <button
                          onClick={() => ungroupBlocks(unit.group.id)}
                          style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 7, border: 'none', background: '#FEF2F2', color: '#DC2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Desagrupar
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                        <input
                          type="color"
                          value={unit.group.background || '#F8FAFC'}
                          onChange={e => updateBlockGroup(unit.group.id, { background: e.target.value })}
                          style={{ width: 30, height: 30, padding: 0, border: '1.5px solid #E2E8F0', borderRadius: 7, cursor: 'pointer', flexShrink: 0 }}
                          title="Color de fondo del grupo"
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <span style={{ fontSize: 10, color: '#94A3B8' }}>Radio</span>
                          <input
                            type="range" min={0} max={32} step={2}
                            value={unit.group.borderRadius ?? 12}
                            onChange={e => updateBlockGroup(unit.group.id, { borderRadius: Number(e.target.value) })}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <span style={{ fontSize: 10, color: '#94A3B8' }}>Relleno</span>
                          <input
                            type="range" min={0} max={40} step={2}
                            value={unit.group.padding ?? 16}
                            onChange={e => updateBlockGroup(unit.group.id, { padding: Number(e.target.value) })}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                          {([['column', 'Apilado'], ['row', 'En fila']] as const).map(([dir, label]) => (
                            <button
                              key={dir}
                              onClick={() => updateBlockGroup(unit.group.id, { direction: dir })}
                              style={{
                                flex: 1, padding: '6px 4px', borderRadius: 7,
                                border: `1.5px solid ${(unit.group.direction ?? 'column') === dir ? '#7C3AED' : '#E2E8F0'}`,
                                background: (unit.group.direction ?? 'column') === dir ? '#F5F3FF' : 'white',
                                color: (unit.group.direction ?? 'column') === dir ? '#7C3AED' : '#64748B',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <span style={{ fontSize: 10, color: '#94A3B8' }}>Espacio</span>
                          <input
                            type="range" min={0} max={40} step={2}
                            value={unit.group.gap ?? 12}
                            onChange={e => updateBlockGroup(unit.group.id, { gap: Number(e.target.value) })}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {unit.members.map(m => <div key={m.id}>{renderBlockItemRow(m)}</div>)}
                      </div>
                      {contentBlocks.some(b => !b.groupId && b.afterId === unit.group.afterId) && (
                        <select
                          value=""
                          onChange={e => {
                            const id = e.target.value
                            if (!id) return
                            setContentBlocks(prev => prev.map(x => x.id === id ? { ...x, groupId: unit.group.id } : x))
                          }}
                          className="ed-block-select"
                          style={{ marginTop: 6, fontSize: 11 }}
                        >
                          <option value="">+ Agregar un bloque existente a este grupo...</option>
                          {contentBlocks.filter(b => !b.groupId && b.afterId === unit.group.afterId).map(b => (
                            <option key={b.id} value={b.id}>
                              {b.type === 'text' ? 'Texto' : b.type === 'image' ? 'Imagen' : b.type === 'video' ? 'Video' : 'Botones'}: {b.content.slice(0, 24)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )})}
                </div>
              </>
            )}

            <div className="ed-tp-subtitle">{editingBlockId ? 'Editando bloque' : 'Agregar bloque'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                value={newBlockPos}
                onChange={e => setNewBlockPos(e.target.value)}
                className="ed-block-select"
              >
                <option value="top">Al inicio (antes de todo)</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>Despues de {c.name}</option>
                ))}
                <option value="bottom">Al final (despues de todo)</option>
              </select>

              <div style={{ display: 'flex', gap: 6 }}>
                {(['text', 'image', 'video', 'buttons'] as const).map(tp => (
                  <button
                    key={tp}
                    onClick={() => setNewBlockType(tp)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8,
                      border: `2px solid ${newBlockType === tp ? '#7C3AED' : '#E2E8F0'}`,
                      background: newBlockType === tp ? '#F5F3FF' : 'white',
                      color: newBlockType === tp ? '#7C3AED' : '#64748B',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {tp === 'text' ? 'Texto' : tp === 'image' ? 'Imagen' : tp === 'video' ? 'Video' : 'Botones'}
                  </button>
                ))}
              </div>

              {newBlockType === 'text' ? (
                <>
                  <textarea
                    value={newBlockContent}
                    onChange={e => setNewBlockContent(e.target.value)}
                    placeholder="Escribe tu texto aqui..."
                    className="ed-block-textarea"
                    rows={4}
                  />
                  <FontSelect
                    value={newBlockFont}
                    onChange={setNewBlockFont}
                    options={[{ id: '', name: 'Fuente de la tienda' }, ...PAGE_FONTS]}
                    placeholder="Fuente de la tienda"
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number" min={10} max={48} step={1}
                      value={newBlockFontSize}
                      onChange={e => setNewBlockFontSize(Number(e.target.value) || 15)}
                      className="ed-block-input"
                      style={{ width: 64, flex: 'none' }}
                      title="Tamano de letra (px)"
                    />
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>px</span>
                    <input
                      type="color"
                      value={newBlockColor}
                      onChange={e => setNewBlockColor(e.target.value)}
                      style={{ width: 34, height: 34, padding: 0, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' }}
                      title="Color del texto"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Grosor</span>
                    <input
                      type="range" min={100} max={1200} step={50}
                      value={newBlockFontWeight}
                      onChange={e => setNewBlockFontWeight(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span
                      style={{
                        fontSize: 11, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right',
                        fontWeight: Math.min(900, newBlockFontWeight),
                        WebkitTextStroke: newBlockFontWeight > 900 ? `${Math.min(1.4, ((newBlockFontWeight - 900) / 300) * 1.4)}px currentColor` : undefined,
                      }}
                    >
                      {newBlockFontWeight}
                    </span>
                  </div>
                  {newBlockFontWeight > 900 && (
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: -4 }}>
                      900 es el maximo real de la fuente — mas alla de eso se agrega un contorno para verse aun mas grueso
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as const).map(([al, label]) => (
                      <button
                        key={al}
                        onClick={() => setNewBlockAlign(al)}
                        style={{
                          flex: 1, padding: '7px 4px', borderRadius: 8,
                          border: `2px solid ${newBlockAlign === al ? '#7C3AED' : '#E2E8F0'}`,
                          background: newBlockAlign === al ? '#F5F3FF' : 'white',
                          color: newBlockAlign === al ? '#7C3AED' : '#64748B',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : newBlockType === 'buttons' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newBlockButtons.map((btn, i) => (
                    <div key={btn.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, background: '#F8FAFC', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={btn.label}
                          onChange={e => setNewBlockButtons(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                          placeholder="Texto (ej: Merch)"
                          className="ed-block-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={() => setNewBlockButtons(prev => prev.filter((_, j) => j !== i))}
                          style={{ flexShrink: 0, width: 30, borderRadius: 8, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          value={btn.target}
                          onChange={e => setNewBlockButtons(prev => prev.map((x, j) => j === i ? { ...x, target: e.target.value as 'product' | 'category', targetId: '' } : x))}
                          className="ed-block-select"
                          style={{ flex: '0 0 110px' }}
                        >
                          <option value="category">Categoria</option>
                          <option value="product">Producto</option>
                        </select>
                        <select
                          value={btn.targetId}
                          onChange={e => setNewBlockButtons(prev => prev.map((x, j) => j === i ? { ...x, targetId: e.target.value } : x))}
                          className="ed-block-select"
                          style={{ flex: 1 }}
                        >
                          <option value="">
                            {btn.target === 'product' ? 'Elige un producto...' : 'Elige una categoria...'}
                          </option>
                          {(btn.target === 'product' ? productsLite : categories).map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setNewBlockButtons(prev => [...prev, { id: crypto.randomUUID(), label: '', target: 'category', targetId: '' }])}
                    style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px dashed #E2E8F0', background: 'white', color: '#7C3AED', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Agregar boton
                  </button>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Estilo del boton</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([['solid', 'Solido'], ['outline', 'Contorno'], ['slide', 'Deslizar']] as const).map(([st, label]) => (
                        <button
                          key={st}
                          onClick={() => setNewBlockButtonStyle(st)}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: 8,
                            border: `2px solid ${newBlockButtonStyle === st ? '#7C3AED' : '#E2E8F0'}`,
                            background: newBlockButtonStyle === st ? '#F5F3FF' : 'white',
                            color: newBlockButtonStyle === st ? '#7C3AED' : '#64748B',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Tamano del boton</span>
                      <input
                        type="range" min={8} max={26} step={1}
                        value={newBlockButtonSize}
                        onChange={e => setNewBlockButtonSize(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right' }}>{newBlockButtonSize}px</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                      Util para que varios botones quepan uno al lado del otro dentro de un grupo En fila
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {newBlockType === 'image' && (
                    <>
                      <div
                        onClick={() => blockImgRef.current?.click()}
                        style={{
                          position: 'relative', width: '100%', height: 120, borderRadius: 8,
                          border: '1.5px dashed #E2E8F0',
                          background: newBlockContent ? `#F8FAFC center/cover no-repeat url(${newBlockContent})` : '#F8FAFC',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', overflow: 'hidden',
                        }}
                      >
                        {!newBlockContent && !blockImgUploading && (
                          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
                            Toca para subir una imagen desde tu dispositivo
                          </span>
                        )}
                        {blockImgUploading && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
                            Subiendo...
                          </div>
                        )}
                        {newBlockContent && !blockImgUploading && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: 10, fontWeight: 600, textAlign: 'center' }}>
                            Cambiar imagen
                          </div>
                        )}
                      </div>
                      <input
                        ref={blockImgRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file || !storeId) return
                          setBlockImgUploading(true)
                          try { setNewBlockContent(await uploadBlockImage(file, storeId)) }
                          catch { /* keep whatever was there before on failure */ }
                          setBlockImgUploading(false)
                          e.target.value = ''
                        }}
                      />
                    </>
                  )}
                  {newBlockType !== 'image' && (
                    <input
                      type="url"
                      value={newBlockContent}
                      onChange={e => setNewBlockContent(e.target.value)}
                      placeholder="URL del video (YouTube, Vimeo...)"
                      className="ed-block-input"
                    />
                  )}
                  {newBlockType === 'image' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Tamano</span>
                      <input
                        type="range" min={10} max={100} step={5}
                        value={newBlockImageSize}
                        onChange={e => setNewBlockImageSize(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{newBlockImageSize}%</span>
                    </div>
                  )}
                  {newBlockType === 'image' && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Al hacer clic (opcional)</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        {([['url', 'Enlace'], ['category', 'Categoria']] as const).map(([tg, label]) => (
                          <button
                            key={tg}
                            onClick={() => setNewBlockLinkTarget(tg)}
                            style={{
                              flex: 1, padding: '8px 4px', borderRadius: 8,
                              border: `2px solid ${newBlockLinkTarget === tg ? '#7C3AED' : '#E2E8F0'}`,
                              background: newBlockLinkTarget === tg ? '#F5F3FF' : 'white',
                              color: newBlockLinkTarget === tg ? '#7C3AED' : '#64748B',
                              fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {newBlockLinkTarget === 'category' ? (
                        <select
                          value={newBlockLinkCategoryId}
                          onChange={e => setNewBlockLinkCategoryId(e.target.value)}
                          className="ed-block-select"
                        >
                          <option value="">Elige una categoria...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="url"
                          value={newBlockLinkUrl}
                          onChange={e => setNewBlockLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="ed-block-input"
                        />
                      )}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Separacion</span>
                <input
                  type="range" min={0} max={60} step={2}
                  value={newBlockSpacing}
                  onChange={e => setNewBlockSpacing(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{newBlockSpacing}px</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    if (newBlockType === 'buttons') {
                      const valid = newBlockButtons.filter(b => b.label.trim() && b.targetId)
                      if (valid.length === 0) return
                      if (editingBlockId) {
                        setContentBlocks(prev => prev.map(x => x.id === editingBlockId
                          ? { ...x, afterId: newBlockPos, type: 'buttons' as const, content: JSON.stringify(valid), spacing: newBlockSpacing, buttonStyle: newBlockButtonStyle, buttonSize: newBlockButtonSize }
                          : x))
                        cancelEditBlock()
                        return
                      }
                      setContentBlocks(prev => [...prev, {
                        id: crypto.randomUUID(), afterId: newBlockPos, type: 'buttons', content: JSON.stringify(valid),
                        spacing: newBlockSpacing, buttonStyle: newBlockButtonStyle, buttonSize: newBlockButtonSize,
                      }])
                      setNewBlockButtons([])
                      return
                    }
                    if (!newBlockContent.trim()) return
                    const fields = {
                      afterId: newBlockPos,
                      type: newBlockType,
                      content: newBlockContent.trim(),
                      spacing: newBlockSpacing,
                      fontSize: newBlockType === 'text' ? newBlockFontSize : undefined,
                      fontWeight: newBlockType === 'text' ? newBlockFontWeight : undefined,
                      color: newBlockType === 'text' ? newBlockColor : undefined,
                      align: newBlockType === 'text' ? newBlockAlign : undefined,
                      font: newBlockType === 'text' ? (newBlockFont || undefined) : undefined,
                      imageSize: newBlockType === 'image' ? newBlockImageSize : undefined,
                      linkUrl: newBlockType === 'image' ? (newBlockLinkUrl.trim() || undefined) : undefined,
                      linkTarget: newBlockType === 'image' ? newBlockLinkTarget : undefined,
                      linkCategoryId: newBlockType === 'image' ? (newBlockLinkCategoryId || undefined) : undefined,
                    }
                    if (editingBlockId) {
                      setContentBlocks(prev => prev.map(x => x.id === editingBlockId ? { ...x, ...fields } : x))
                      cancelEditBlock()
                      return
                    }
                    setContentBlocks(prev => [...prev, { id: crypto.randomUUID(), ...fields }])
                    setNewBlockContent('')
                  }}
                  style={{
                    flex: 1, padding: '9px 16px', borderRadius: 8,
                    background: '#7C3AED', color: 'white',
                    border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {editingBlockId ? 'Guardar cambios' : 'Agregar'}
                </button>
                {editingBlockId && (
                  <button
                    onClick={cancelEditBlock}
                    style={{
                      padding: '9px 16px', borderRadius: 8,
                      background: 'white', color: '#64748B',
                      border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <PanelSave />
          </div>
        )}

        {/* Panel — Producto */}
        {activeTool === 'product' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Producto</div>

            <div className="ed-tp-subtitle">Modal de producto</div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Paso a paso</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Muestra una variable a la vez, como si preguntara, y avanza sola al elegir. Los adicionales, notas y el boton de agregar quedan al final.</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={modalWizard}
                  onChange={e => setModalWizard(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: modalWizard ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: modalWizard ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            <PanelSave />
          </div>
        )}

        {activeTool === 'reorder' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Repetir pedido</div>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>Permitir repetir el ultimo pedido</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Si reconocemos al cliente (por cedula o por telefono en este dispositivo) y tiene un pedido anterior, le mostramos un boton para repetirlo</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={enableReorder}
                  onChange={e => setEnableReorder(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: enableReorder ? '#7C3AED' : '#D1D5DB',
                  transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: enableReorder ? 18 : 4,
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            {enableReorder && (
              <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Segundos flotando</span>
                  <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>
                    {reorderFloatSeconds > 0 ? `${reorderFloatSeconds}s` : 'No se oculta'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
                  Cuanto tiempo se muestra el boton flotante antes de ocultarse solo. En 0 se queda hasta que el cliente lo cierre.
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={reorderFloatSeconds}
                  onChange={e => setReorderFloatSeconds(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {enableReorder && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>De donde sale</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([['top', 'Arriba'], ['bottom', 'Abajo'], ['left', 'Izquierda'], ['right', 'Derecha']] as const).map(([pos, label]) => (
                      <button
                        key={pos}
                        onClick={() => setReorderPosition(pos)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 8,
                          border: `2px solid ${reorderPosition === pos ? '#7C3AED' : '#E2E8F0'}`,
                          background: reorderPosition === pos ? '#F5F3FF' : 'white',
                          color: reorderPosition === pos ? '#7C3AED' : '#64748B',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Texto del mensaje</div>
                  <input
                    type="text"
                    value={reorderTitle}
                    onChange={e => setReorderTitle(e.target.value)}
                    placeholder="¿Pedimos lo mismo que la ultima vez?"
                    className="ed-block-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Foto de fondo (opcional)</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>
                    Si subes una foto, reemplaza el fondo de color y llena todo el cuadro con las mismas esquinas curvas.
                  </div>
                  <div
                    onClick={() => reorderImgRef.current?.click()}
                    style={{
                      position: 'relative', width: '100%', height: 90, borderRadius: 8,
                      border: '1.5px dashed #E2E8F0',
                      background: reorderImageUrl ? `#F8FAFC center/cover no-repeat url(${reorderImageUrl})` : '#F8FAFC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {!reorderImageUrl && !reorderImgUploading && (
                      <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
                        Toca para subir una foto desde tu dispositivo
                      </span>
                    )}
                    {reorderImgUploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
                        Subiendo...
                      </div>
                    )}
                    {reorderImageUrl && !reorderImgUploading && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: 10, fontWeight: 600, textAlign: 'center' }}>
                        Cambiar foto
                      </div>
                    )}
                  </div>
                  <input
                    ref={reorderImgRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file || !storeId) return
                      setReorderImgUploading(true)
                      try { setReorderImageUrl(await uploadBlockImage(file, storeId)) }
                      catch { /* keep whatever was there before on failure */ }
                      setReorderImgUploading(false)
                      e.target.value = ''
                    }}
                  />
                  {reorderImageUrl && (
                    <button
                      onClick={() => setReorderImageUrl('')}
                      style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#DC2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Quitar foto
                    </button>
                  )}
                </div>

                <FontSelect
                  value={reorderFont}
                  onChange={setReorderFont}
                  options={[{ id: '', name: 'Fuente de la tienda' }, ...PAGE_FONTS]}
                  placeholder="Fuente de la tienda"
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min={10} max={48} step={1}
                    value={reorderFontSize}
                    onChange={e => setReorderFontSize(Number(e.target.value) || 14)}
                    className="ed-block-input"
                    style={{ width: 64, flex: 'none' }}
                    title="Tamano de letra (px)"
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>px</span>
                  <input
                    type="color"
                    value={reorderColor || '#0F172A'}
                    onChange={e => setReorderColor(e.target.value)}
                    style={{ width: 34, height: 34, padding: 0, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' }}
                    title="Color del texto"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Grosor</span>
                  <input
                    type="range" min={100} max={1200} step={50}
                    value={reorderFontWeight}
                    onChange={e => setReorderFontWeight(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right' }}>{reorderFontWeight}</span>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Estilo del boton</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([['solid', 'Solido'], ['outline', 'Contorno'], ['slide', 'Deslizar']] as const).map(([st, label]) => (
                      <button
                        key={st}
                        onClick={() => setReorderButtonStyle(st)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 8,
                          border: `2px solid ${reorderButtonStyle === st ? '#7C3AED' : '#E2E8F0'}`,
                          background: reorderButtonStyle === st ? '#F5F3FF' : 'white',
                          color: reorderButtonStyle === st ? '#7C3AED' : '#64748B',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Tamano del boton</span>
                  <input
                    type="range" min={8} max={26} step={1}
                    value={reorderButtonSize}
                    onChange={e => setReorderButtonSize(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right' }}>{reorderButtonSize}px</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Color del boton</span>
                  <input
                    type="color"
                    value={reorderButtonColor || '#7C3AED'}
                    onChange={e => setReorderButtonColor(e.target.value)}
                    style={{ width: 34, height: 34, padding: 0, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                    title="Color del boton"
                  />
                  {reorderButtonColor && (
                    <button
                      onClick={() => setReorderButtonColor('')}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Usar color de la tienda
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Tamano del anuncio</span>
                  <input
                    type="range" min={40} max={150} step={5}
                    value={reorderScale}
                    onChange={e => setReorderScale(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{reorderScale}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Separacion de la pantalla</span>
                  <input
                    type="range" min={0} max={60} step={2}
                    value={reorderInset}
                    onChange={e => setReorderInset(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{reorderInset}px</span>
                </div>
              </div>
            )}

            <PanelSave />
          </div>
        )}

        {activeTool === 'ads' && (
          <div className="ed-tool-panel ed-tool-panel-lg">
            <div className="ed-tp-title">Anuncios</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: -8 }}>
              Crea uno o varios anuncios y elige como aparecen en la tienda: tarjeta flotante, ventana emergente o barra fija arriba/abajo.
            </div>

            {ads.map(ad => (
              <div key={ad.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={ad.enabled !== false}
                        onChange={e => updateAd(ad.id, { enabled: e.target.checked })}
                        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                      />
                      <div style={{
                        width: 34, height: 20, borderRadius: 100,
                        background: ad.enabled !== false ? '#7C3AED' : '#D1D5DB',
                        transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', top: 3, left: ad.enabled !== false ? 16 : 3,
                          width: 14, height: 14, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s',
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{ad.title?.trim() || 'Anuncio sin titulo'}</span>
                  </label>
                  <button
                    onClick={() => removeAd(ad.id)}
                    style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}
                    title="Eliminar anuncio"
                  >
                    ×
                  </button>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Donde aparece</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([['float', 'Flotante'], ['popup', 'Emergente'], ['bar-top', 'Barra arriba'], ['bar-bottom', 'Barra abajo']] as const).map(([pl, label]) => (
                      <button
                        key={pl}
                        onClick={() => updateAd(ad.id, { placement: pl })}
                        style={{
                          flex: 1, padding: '7px 3px', borderRadius: 8,
                          border: `2px solid ${ad.placement === pl ? '#7C3AED' : '#E2E8F0'}`,
                          background: ad.placement === pl ? '#F5F3FF' : 'white',
                          color: ad.placement === pl ? '#7C3AED' : '#64748B',
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Solo en esta categoria (opcional)</div>
                  <select
                    value={ad.categoryId ?? ''}
                    onChange={e => updateAd(ad.id, { categoryId: e.target.value || undefined })}
                    className="ed-block-select"
                    style={{ width: '100%' }}
                  >
                    <option value="">Toda la tienda</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                    Si eliges una categoria, el anuncio solo aparece mientras el cliente esta viendo esa seccion en el catalogo.
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Texto</div>
                  <input
                    type="text"
                    value={ad.title ?? ''}
                    onChange={e => updateAd(ad.id, { title: e.target.value })}
                    placeholder="Ej: 2x1 en postres esta semana"
                    className="ed-block-input"
                    style={{ width: '100%' }}
                  />
                </div>

                {(ad.placement === 'bar-top' || ad.placement === 'bar-bottom') && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Estilo de la barra</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {([['static', 'Fija'], ['marquee', 'Deslizante'], ['rotate', 'Rotativo']] as const).map(([bs, label]) => (
                        <button
                          key={bs}
                          onClick={() => updateAd(ad.id, { barStyle: bs })}
                          style={{
                            flex: 1, padding: '7px 3px', borderRadius: 8,
                            border: `2px solid ${(ad.barStyle ?? 'static') === bs ? '#7C3AED' : '#E2E8F0'}`,
                            background: (ad.barStyle ?? 'static') === bs ? '#F5F3FF' : 'white',
                            color: (ad.barStyle ?? 'static') === bs ? '#7C3AED' : '#64748B',
                            fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {ad.placement === 'bar-top' && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Debajo de</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {([['screen', 'Arriba de todo'], ['header', 'El encabezado'], ['catnav', 'La barra de categorias']] as const).map(([an, label]) => (
                            <button
                              key={an}
                              onClick={() => updateAd(ad.id, { topAnchor: an })}
                              style={{
                                flex: 1, padding: '7px 3px', borderRadius: 8,
                                border: `2px solid ${(ad.topAnchor ?? 'screen') === an ? '#7C3AED' : '#E2E8F0'}`,
                                background: (ad.topAnchor ?? 'screen') === an ? '#F5F3FF' : 'white',
                                color: (ad.topAnchor ?? 'screen') === an ? '#7C3AED' : '#64748B',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {ad.barStyle === 'marquee' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Velocidad</span>
                        <input
                          type="range" min={4} max={30} step={1}
                          value={ad.marqueeSeconds ?? 12}
                          onChange={e => updateAd(ad.id, { marqueeSeconds: Number(e.target.value) })}
                          style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{ad.marqueeSeconds ?? 12}s</span>
                      </div>
                    )}

                    {ad.barStyle === 'rotate' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>
                          Estos mensajes reemplazan al texto de arriba, rotando uno a la vez.
                        </div>
                        {(ad.messages ?? []).map((msg, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={msg}
                              onChange={e => updateAd(ad.id, { messages: (ad.messages ?? []).map((m, j) => j === i ? e.target.value : m) })}
                              placeholder={`Mensaje ${i + 1}`}
                              className="ed-block-input"
                              style={{ flex: 1 }}
                            />
                            <button
                              onClick={() => updateAd(ad.id, { messages: (ad.messages ?? []).filter((_, j) => j !== i) })}
                              style={{ flexShrink: 0, width: 30, borderRadius: 8, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => updateAd(ad.id, { messages: [...(ad.messages ?? []), ''] })}
                          style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px dashed #E2E8F0', background: 'white', color: '#7C3AED', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          + Agregar mensaje
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Cambia cada</span>
                          <input
                            type="range" min={2} max={15} step={1}
                            value={ad.rotateSeconds ?? 4}
                            onChange={e => updateAd(ad.id, { rotateSeconds: Number(e.target.value) })}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{ad.rotateSeconds ?? 4}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(ad.placement === 'float' || ad.placement === 'popup') && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Foto (opcional)</div>
                    <div
                      onClick={() => { adImgTargetRef.current = ad.id; adImgRef.current?.click() }}
                      style={{
                        position: 'relative', width: '100%', height: 90, borderRadius: 8,
                        border: '1.5px dashed #E2E8F0',
                        background: ad.imageUrl ? `#F8FAFC center/cover no-repeat url(${ad.imageUrl})` : '#F8FAFC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', overflow: 'hidden',
                      }}
                    >
                      {!ad.imageUrl && adImgUploadingId !== ad.id && (
                        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
                          Toca para subir una foto
                        </span>
                      )}
                      {adImgUploadingId === ad.id && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
                          Subiendo...
                        </div>
                      )}
                      {ad.imageUrl && adImgUploadingId !== ad.id && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(15,23,42,0.6)', color: 'white', fontSize: 10, fontWeight: 600, textAlign: 'center' }}>
                          Cambiar foto
                        </div>
                      )}
                    </div>
                    {ad.imageUrl && (
                      <button
                        onClick={() => updateAd(ad.id, { imageUrl: '' })}
                        style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#DC2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                )}

                <FontSelect
                  value={ad.font ?? ''}
                  onChange={v => updateAd(ad.id, { font: v })}
                  options={[{ id: '', name: 'Fuente de la tienda' }, ...PAGE_FONTS]}
                  placeholder="Fuente de la tienda"
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min={10} max={48} step={1}
                    value={ad.fontSize ?? 14}
                    onChange={e => updateAd(ad.id, { fontSize: Number(e.target.value) || 14 })}
                    className="ed-block-input"
                    style={{ width: 64, flex: 'none' }}
                    title="Tamano de letra (px)"
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>px</span>
                  <input
                    type="color"
                    value={ad.color || '#0F172A'}
                    onChange={e => updateAd(ad.id, { color: e.target.value })}
                    style={{ width: 34, height: 34, padding: 0, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' }}
                    title="Color del texto"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Grosor</span>
                  <input
                    type="range" min={100} max={1200} step={50}
                    value={ad.fontWeight ?? 700}
                    onChange={e => updateAd(ad.id, { fontWeight: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right' }}>{ad.fontWeight ?? 700}</span>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Boton (opcional)</div>
                  <input
                    type="text"
                    value={ad.buttonLabel ?? ''}
                    onChange={e => updateAd(ad.id, { buttonLabel: e.target.value })}
                    placeholder="Ej: Ver oferta"
                    className="ed-block-input"
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <select
                      value={ad.linkTarget ?? 'none'}
                      onChange={e => updateAd(ad.id, { linkTarget: e.target.value as Ad['linkTarget'] })}
                      className="ed-block-select"
                      style={{ flex: '0 0 110px' }}
                    >
                      <option value="none">Sin enlace</option>
                      <option value="category">Categoria</option>
                      <option value="product">Producto</option>
                      <option value="url">URL</option>
                    </select>
                    {ad.linkTarget === 'url' ? (
                      <input
                        type="text"
                        value={ad.linkUrl ?? ''}
                        onChange={e => updateAd(ad.id, { linkUrl: e.target.value })}
                        placeholder="https://..."
                        className="ed-block-input"
                        style={{ flex: 1 }}
                      />
                    ) : ad.linkTarget === 'category' ? (
                      <select
                        value={ad.linkCategoryId ?? ''}
                        onChange={e => updateAd(ad.id, { linkCategoryId: e.target.value })}
                        className="ed-block-select"
                        style={{ flex: 1 }}
                      >
                        <option value="">Elige una categoria...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : ad.linkTarget === 'product' ? (
                      <select
                        value={ad.linkProductId ?? ''}
                        onChange={e => updateAd(ad.id, { linkProductId: e.target.value })}
                        className="ed-block-select"
                        style={{ flex: 1 }}
                      >
                        <option value="">Elige un producto...</option>
                        {productsLite.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {([['solid', 'Solido'], ['outline', 'Contorno'], ['slide', 'Deslizar']] as const).map(([st, label]) => (
                      <button
                        key={st}
                        onClick={() => updateAd(ad.id, { buttonStyle: st })}
                        style={{
                          flex: 1, padding: '7px 3px', borderRadius: 8,
                          border: `2px solid ${(ad.buttonStyle ?? 'solid') === st ? '#7C3AED' : '#E2E8F0'}`,
                          background: (ad.buttonStyle ?? 'solid') === st ? '#F5F3FF' : 'white',
                          color: (ad.buttonStyle ?? 'solid') === st ? '#7C3AED' : '#64748B',
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Tamano</span>
                    <input
                      type="range" min={8} max={26} step={1}
                      value={ad.buttonSize ?? 14}
                      onChange={e => updateAd(ad.id, { buttonSize: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 11, color: '#94A3B8', width: 28, flexShrink: 0, textAlign: 'right' }}>{ad.buttonSize ?? 14}px</span>
                    <input
                      type="color"
                      value={ad.buttonColor || '#7C3AED'}
                      onChange={e => updateAd(ad.id, { buttonColor: e.target.value })}
                      style={{ width: 34, height: 34, padding: 0, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                      title="Color del boton"
                    />
                  </div>
                </div>

                {ad.placement === 'float' && (
                  <>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>De donde sale</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {([['top', 'Arriba'], ['bottom', 'Abajo'], ['left', 'Izquierda'], ['right', 'Derecha']] as const).map(([pos, label]) => (
                          <button
                            key={pos}
                            onClick={() => updateAd(ad.id, { position: pos })}
                            style={{
                              flex: 1, padding: '7px 3px', borderRadius: 8,
                              border: `2px solid ${(ad.position ?? 'right') === pos ? '#7C3AED' : '#E2E8F0'}`,
                              background: (ad.position ?? 'right') === pos ? '#F5F3FF' : 'white',
                              color: (ad.position ?? 'right') === pos ? '#7C3AED' : '#64748B',
                              fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Tamano del anuncio</span>
                      <input
                        type="range" min={40} max={150} step={5}
                        value={ad.scale ?? 100}
                        onChange={e => updateAd(ad.id, { scale: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{ad.scale ?? 100}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Separacion de la pantalla</span>
                      <input
                        type="range" min={0} max={60} step={2}
                        value={ad.inset ?? 16}
                        onChange={e => updateAd(ad.id, { inset: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 32, flexShrink: 0, textAlign: 'right' }}>{ad.inset ?? 16}px</span>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Aparece despues de</span>
                  <input
                    type="range" min={0} max={30} step={1}
                    value={ad.delaySeconds ?? 0}
                    onChange={e => updateAd(ad.id, { delaySeconds: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 40, flexShrink: 0, textAlign: 'right' }}>
                    {ad.delaySeconds ? `${ad.delaySeconds}s` : 'Ya mismo'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>Se oculta solo despues de</span>
                  <input
                    type="range" min={0} max={60} step={1}
                    value={ad.floatSeconds ?? 0}
                    onChange={e => updateAd(ad.id, { floatSeconds: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#94A3B8', width: 40, flexShrink: 0, textAlign: 'right' }}>
                    {ad.floatSeconds ? `${ad.floatSeconds}s` : 'Nunca'}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!ad.onceOnly}
                      onChange={e => updateAd(ad.id, { onceOnly: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                    />
                    <div style={{
                      width: 34, height: 20, borderRadius: 100,
                      background: ad.onceOnly ? '#7C3AED' : '#D1D5DB',
                      transition: 'background 0.2s', cursor: 'pointer', position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: ad.onceOnly ? 16 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: 'white',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#475569' }}>Mostrar solo una vez por cliente</span>
                </label>
              </div>
            ))}

            <input
              ref={adImgRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0]
                const targetId = adImgTargetRef.current
                if (!file || !storeId || !targetId) return
                setAdImgUploadingId(targetId)
                try { updateAd(targetId, { imageUrl: await uploadBlockImage(file, storeId) }) }
                catch { /* keep whatever was there before on failure */ }
                setAdImgUploadingId(null)
                e.target.value = ''
              }}
            />

            <button
              onClick={() => setAds(prev => [...prev, newAd()])}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px dashed #E2E8F0', background: 'white', color: '#7C3AED', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Nuevo anuncio
            </button>

            <PanelSave />
          </div>
        )}

      </aside>
    </div>
  )
}
