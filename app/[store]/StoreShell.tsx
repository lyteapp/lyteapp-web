'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useT } from '../lib/LocaleProvider'
import { revealFontStack, loadRevealFont } from '../lib/revealFonts'
import { isLightColor, poweredByColors } from '../lib/colorContrast'
import LocationMapPicker from './LocationMapPicker'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type VariableChoice = { value: string; price: number; calories?: number; fat?: number; protein?: number; carbs?: number }
type VariableGroup  = { label: string; choices: VariableChoice[]; min?: number; max?: number }
function normalizeChoice(c: VariableChoice | string): VariableChoice {
  return typeof c === 'string'
    ? { value: c, price: 0 }
    : { value: c.value, price: c.price ?? 0, calories: c.calories, fat: c.fat, protein: c.protein, carbs: c.carbs }
}
// A group defaults to a single required-or-optional pick (min 0, max 1),
// matching pre-existing products that predate min/max — extending it to a
// bounded multi-select is opt-in via the dashboard's Minimo/Maximo fields.
function groupMinMax(g: { min?: number; max?: number }): { min: number; max: number } {
  const max = g.max && g.max > 0 ? Math.floor(g.max) : 1
  const min = g.min && g.min > 0 ? Math.min(Math.floor(g.min), max) : 0
  return { min, max }
}
// Selected variable values are stored per-group; older orders placed before
// multi-select shipped have a plain string here instead of string[].
function variableValues(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}
function variableValueLabel(v: string | string[] | undefined): string {
  return variableValues(v).join(', ')
}
// Product "images" can also be short looping videos, uploaded like any
// other image and told apart purely by file extension (no separate DB field).
const PRODUCT_VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
function isVideoUrl(url?: string | null): boolean {
  return !!url && PRODUCT_VIDEO_EXT_RE.test(url)
}
type Additional     = { name: string; price: number; calories?: number; fat?: number; protein?: number; carbs?: number }
type ColorVariant   = { label: string; color: string; imageUrl: string }
type NutritionInfo  = { enabled?: boolean; calories?: number; fat?: number; protein?: number; carbs?: number }
type ProductOptions = {
  variables?:     VariableGroup[]
  colors?:        string[]
  colorVariants?: ColorVariant[]
  additionals?:   Additional[]
  allowNotes?:    boolean
  nutrition?:     NutritionInfo
}
type SelectedOptions = {
  variables?:   Record<string, string[] | string>
  color?:       string
  additionals?: Additional[]
  notes?:       string
}
type CartItem = {
  id: string; productId?: string; name: string; price: number; extraPrice: number
  image_url: string | null; quantity: number
  options?: ProductOptions; selectedOptions?: SelectedOptions
}
type Product = {
  id: string; name: string; description: string | null
  price: number; image_url: string | null; options?: ProductOptions | null
  category_id?: string | null
}
type PaymentMethod = { type: string; label: string; enabled: boolean; details: Record<string, string> }
type SavedLocation = { id: string; label: string; address: string; lat: number | null; lng: number | null }
type DeliveryZone  = { id: string; name: string; fee: number; color: string; radius_m: number; center_lat: number; center_lng: number }
type LastOrderItem = { product_id: string | null; product_name: string; product_price: number; quantity: number; selected_options: SelectedOptions | null }
type LastOrder = { orderId: string; items: LastOrderItem[] }

const PM_LABELS: Record<string, string> = {
  pago_movil: 'Pago Móvil', zelle: 'Zelle', efectivo_usd: 'Efectivo USD',
  efectivo_bs: 'Efectivo Bs', usdt: 'USDT / Cripto', binance: 'Binance Pay',
  transferencia: 'Transferencia Bs', punto_venta: 'Punto de venta',
}

function parsePaymentMethods(raw: unknown): PaymentMethod[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as PaymentMethod[]
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, { enabled?: boolean; values?: Record<string, string> }>)
      .filter(([, v]) => v?.enabled)
      .map(([key, v]) => ({ type: key, label: PM_LABELS[key] ?? key, enabled: true, details: v?.values ?? {} }))
  }
  return []
}

type ContentBlock = {
  id: string
  afterId: string
  type: 'text' | 'image' | 'video' | 'buttons'
  content: string
  fontSize?: number
  fontWeight?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  spacing?: number
  font?: string
  groupId?: string
}
type BlockGroup = { id: string; afterId: string; background?: string; borderRadius?: number; padding?: number }
type BlockButtonItem = { id: string; label: string; target: 'product' | 'category'; targetId: string }
type TemplateConfig = {
  pageBg?: string; pageFont?: string
  fontSize?: 'small' | 'medium' | 'large'
  fontSizePx?: number
  textAlign?: 'left' | 'center'
  photoShape?: 'sharp' | 'square' | 'circle'
  priceColor?: string; priceFont?: string
  priceSize?: 'small' | 'medium' | 'large'
  photoSize?: 'small' | 'medium' | 'large'
  categoryPhotoShapes?: Record<string, string>
  categoryLayouts?: Record<string, string>
  categorySpacing?: number
  categoryNavStyle?: string
  variantShape?: 'pill' | 'rounded' | 'square'
  extraShape?: 'rounded' | 'pill' | 'square'
  showCatNav?: boolean
  stickyCatNav?: boolean
  catNavOverBanner?: boolean
  showWhatsapp?: boolean
  showInstagram?: boolean
  showMenuButton?: boolean
  showHeaderSearch?: boolean
  showHeaderCart?: boolean
  headerIconColor?: string
  cardBg?: string
  catTitleColor?: string
  catTitleFont?: string
  productNameFont?: string
  accentColor?: string
  logoShape?: string
  logoSize?: string
  logoSizePx?: number
  headerLayout?: string
  logoPosition?: 'left' | 'center' | 'right' | 'none'
  namePosition?: 'left' | 'center' | 'right' | 'none'
  headerOverBanner?: boolean
  headerSticky?: boolean
  headerHeightPx?: number
  modalWizard?: boolean
  enableReorder?: boolean
  contentBlocks?: ContentBlock[]
  blockGroups?: BlockGroup[]
  homePage?: {
    enabled?: boolean
    title?: string
    subtitle?: string
    buttonLabel?: string
    buttonColor?: string
    imageUrl?: string | null
    bgColor?: string
    pills?: { id: string; label: string; url: string; color?: string }[]
    transition?: string
    collectCustomerData?: boolean
    customerFields?: { name?: boolean; phone?: boolean; address?: boolean }
    inputTextColor?: string
    inputBgColor?: string
    inputShape?: 'pill' | 'square' | 'outline'
    elementSizes?: { logo?: number; title?: number; subtitle?: number; fields?: number }
    showLogo?: boolean
    images?: { id: string; url: string; x: number; y: number; width: number; height: number; flipped?: boolean }[]
    inactivityTimeout?: { enabled?: boolean; minutes?: number }
    orderReturnTimeout?: { enabled?: boolean; seconds?: number }
    reveal?: {
      greeting?: string
      subtitlePrefix?: string
      skipLabel?: string
      bgColor?: string
      nameColor?: string
      accentColor?: string
      fontFamily?: string
      seconds?: number
      showSkip?: boolean
      logoInsteadOfText?: boolean
    }
  }
}
type Store = {
  id: string; name: string; slug: string
  logo_url: string | null; banner_url: string | null
  description: string | null; whatsapp: string | null; instagram: string | null
  payment_methods: unknown; template: string | null
  store_currency?: string | null
  template_config?: TemplateConfig | null
  checkout_settings?: {
    requireName?: boolean; requirePhone?: boolean; requireAddress?: boolean
    allowNotes?: boolean; minOrder?: string
    deliveryEnabled?: boolean; deliveryFee?: string
    deliveryTypes?: { delivery?: boolean; pickup?: boolean }
    requirePaymentMethod?: boolean; requirePaymentProof?: boolean
    whatsappFloating?: boolean
  } | null
}


function toEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildCartKey(productId: string, color?: string, variables?: Record<string, string[] | string>): string {
  const parts = [productId]
  if (color) parts.push(color)
  if (variables) Object.entries(variables).sort(([a],[b]) => a.localeCompare(b)).forEach(([k,v]) => parts.push(`${k}:${variableValueLabel(v)}`))
  return parts.join('|||')
}

// Payment-proof photos come straight off a phone camera (often several MB) and
// were being uploaded as-is, blocking order submission on the upload — this
// shrinks them client-side (long edge capped, re-encoded as JPEG) so the file
// that actually gets uploaded at submit time is a fraction of the size.
function compressImage(file: File, maxDimension = 1600, quality = 0.75): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas context')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('toBlob failed')); return }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)
const IG_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
)

export default function StoreShell({ store, products, categories = [], initialBcvRate = null, initialDeliveryZones = [], mapboxToken = '' }: { store: Store; products: Product[]; categories: { id: string; name: string; position: number }[]; initialBcvRate?: number | null; initialDeliveryZones?: DeliveryZone[]; mapboxToken?: string }) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  // The dashboard's storefront preview links here with ?preview=1 so it always
  // opens straight on the catalog, skipping the home splash screen — that
  // preview is for editing the storefront's own appearance, not the splash.
  const isDashboardPreview = searchParams.get('preview') === '1'
  const [cart, setCart]                   = useState<Record<string, CartItem>>({})
  const [view, setView]                   = useState<'catalog' | 'checkout' | 'confirmed' | 'splash' | 'reveal'>(() =>
    (!isDashboardPreview && store.template_config?.homePage?.enabled) ? 'splash' : 'catalog'
  )
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [catalogEnter, setCatalogEnter] = useState(false)
  const [customerCedula, setCustomerCedula] = useState('')
  const [cedulaStatus, setCedulaStatus] = useState<'idle' | 'checking' | 'found' | 'new'>('idle')
  // "Slide to reveal" bar shown before the cedula keypad, for a bit of interactivity
  const [keypadRevealed, setKeypadRevealed] = useState(false)
  const [cedulaSlideProgress, setCedulaSlideProgress] = useState(0)
  const [cedulaSliding, setCedulaSliding] = useState(false)
  const cedulaSlideBarRef = useRef<HTMLDivElement | null>(null)
  const cedulaSlideDraggingRef = useRef(false)
  const [splashError, setSplashError] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const [showReorder, setShowReorder] = useState(false)
  const reorderCheckedRef = useRef(false)

  useEffect(() => {
    if (store.whatsapp) router.prefetch(`/${store.slug}/pedido`)
  }, [store.whatsapp, store.slug, router])

  useEffect(() => {
    if (view !== 'reveal') return
    const seconds = store.template_config?.homePage?.reveal?.seconds ?? 3.2
    revealTimerRef.current = setTimeout(() => finishReveal(), seconds * 1000)
    return () => { if (revealTimerRef.current) clearTimeout(revealTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    loadRevealFont(store.template_config?.homePage?.reveal?.fontFamily)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.template_config?.homePage?.reveal?.fontFamily])

  useEffect(() => {
    if (!catalogEnter) return
    const t = setTimeout(() => setCatalogEnter(false), 550)
    return () => clearTimeout(t)
  }, [catalogEnter])

  // Logo-morph transition: the splash logo flies to its real spot in the
  // storefront header (a measured FLIP animation, not a canned keyframe).
  type LogoRect = { top: number; left: number; width: number; height: number }
  const splashLogoRef  = useRef<HTMLImageElement>(null)
  const catalogLogoRef = useRef<HTMLDivElement>(null)
  const [logoMorphStart, setLogoMorphStart]   = useState<LogoRect | null>(null)
  const [logoMorphEnd, setLogoMorphEnd]       = useState<LogoRect | null>(null)
  const [logoMorphFlying, setLogoMorphFlying] = useState(false)

  useEffect(() => {
    if (!logoMorphStart || view !== 'catalog' || logoMorphEnd) return
    const raf = requestAnimationFrame(() => {
      const el = catalogLogoRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        setLogoMorphEnd({ top: r.top, left: r.left, width: r.width, height: r.height })
        requestAnimationFrame(() => setLogoMorphFlying(true))
      } else {
        setLogoMorphStart(null)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [logoMorphStart, logoMorphEnd, view])
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')

  useEffect(() => {
    if (!store.template_config?.enableReorder) return
    const ph = customerPhone.replace(/\D/g, '')
    if (!ph || reorderCheckedRef.current) return
    reorderCheckedRef.current = true
    fetch(`/api/last-order?store_id=${store.id}&phone=${ph}`)
      .then(res => res.json())
      .then(json => {
        if (json.found && Array.isArray(json.items) && json.items.length > 0) {
          setLastOrder({ orderId: json.orderId, items: json.items })
          setShowReorder(true)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone])

  function reorderLast() {
    if (!lastOrder) return
    const next: Record<string, CartItem> = {}
    for (const item of lastOrder.items) {
      const product = item.product_id ? products.find(p => p.id === item.product_id) : undefined
      const color = item.selected_options?.color
      const variables = item.selected_options?.variables
      const key = buildCartKey(item.product_id ?? item.product_name, color, variables)
      const variablePrice = product?.options?.variables
        ? Object.entries(variables ?? {}).reduce((sum, [label, value]) => {
            const group = product.options!.variables!.find(g => g.label === label)
            return sum + variableValues(value).reduce((s, v) => {
              const choice = group?.choices.map(normalizeChoice).find(c => c.value === v)
              return s + (choice?.price ?? 0)
            }, 0)
          }, 0)
        : 0
      const extraPrice = (item.selected_options?.additionals ?? []).reduce((s, a) => s + (a.price || 0), 0) + variablePrice
      next[key] = {
        id: key,
        productId: item.product_id ?? undefined,
        name: product?.name ?? item.product_name,
        price: product?.price ?? item.product_price,
        extraPrice,
        image_url: product?.image_url ?? null,
        quantity: item.quantity,
        options: product?.options ?? undefined,
        selectedOptions: item.selected_options ?? undefined,
      }
    }
    setCart(next)
    setShowReorder(false)
    setView('checkout')
  }
  const [selectedPayment, setSelectedPayment]   = useState('')
  const [paymentFreeText, setPaymentFreeText]   = useState('')
  const bcvRate = initialBcvRate ?? null
  const [paymentProofFile, setPaymentProofFile]       = useState<File | null>(null)
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [orderId, setOrderId]       = useState('')
  const [deliveryTrackId, setDeliveryTrackId] = useState('')
  const [pickupTrackId, setPickupTrackId]     = useState('')
  const [locationState, setLocationState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [customerLat, setCustomerLat] = useState<number | null>(null)
  const [customerLng, setCustomerLng] = useState<number | null>(null)
  const [deliveryZones] = useState<DeliveryZone[]>(initialDeliveryZones)
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null)
  const [customerAddress, setCustomerAddress] = useState('')
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [selectedLocId, setSelectedLocId]   = useState<string | null>(null)
  const [showNewLoc, setShowNewLoc]         = useState(false)
  const [newLocLabel, setNewLocLabel]       = useState('')
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>(() => {
    const dt = store.checkout_settings?.deliveryTypes
    return (dt?.delivery === false && dt?.pickup) ? 'pickup' : 'delivery'
  })
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt(): void } | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [isIos, setIsIos]   = useState(false)
  const [installed, setInstalled] = useState(false)
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [headerHeightMeasured, setHeaderHeightMeasured] = useState<number | null>(null)
  const [catNavHeightMeasured, setCatNavHeightMeasured] = useState<number | null>(null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false)
  // A "buttons" content block can send the shopper to a single category's
  // own focused view instead of scrolling the full catalog.
  const [focusCategory, setFocusCategory] = useState<{ id: string; name: string } | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({})

  // Product options modal
  const [modalProduct, setModalProduct]       = useState<Product | null>(null)
  const [modalVars, setModalVars]             = useState<Record<string, string[]>>({})
  const [modalColor, setModalColor]           = useState<string | undefined>()
  const [modalAdditionals, setModalAdditionals] = useState<Set<number>>(new Set())
  const [modalNotes, setModalNotes]           = useState('')
  const [modalQty, setModalQty]               = useState(1)
  const [modalStep, setModalStep]             = useState(0)

  // Live nutrition totals + a slow "loading in" animation whenever they change
  // (toggling a variable/additional), instead of jumping straight to the new values.
  const modalNutritionEnabled = !!modalProduct?.options?.nutrition?.enabled
  const modalNutritionAdditionals = (modalProduct?.options?.additionals ?? []).filter((_, i) => modalAdditionals.has(i))
  const modalNutritionVariableChoices = modalProduct
    ? Object.entries(modalVars).flatMap(([label, values]) => {
        const group = modalProduct!.options?.variables?.find(g => g.label === label)
        return values.map(value => group?.choices.map(normalizeChoice).find(c => c.value === value) ?? null)
      }).filter((c): c is VariableChoice => !!c)
    : []
  const modalNutrition = modalNutritionEnabled
    ? {
        calories: (modalProduct!.options!.nutrition!.calories ?? 0) + modalNutritionAdditionals.reduce((s, a) => s + (a.calories ?? 0), 0) + modalNutritionVariableChoices.reduce((s, c) => s + (c.calories ?? 0), 0),
        fat:      (modalProduct!.options!.nutrition!.fat ?? 0)      + modalNutritionAdditionals.reduce((s, a) => s + (a.fat ?? 0), 0)      + modalNutritionVariableChoices.reduce((s, c) => s + (c.fat ?? 0), 0),
        protein:  (modalProduct!.options!.nutrition!.protein ?? 0)  + modalNutritionAdditionals.reduce((s, a) => s + (a.protein ?? 0), 0)  + modalNutritionVariableChoices.reduce((s, c) => s + (c.protein ?? 0), 0),
        carbs:    (modalProduct!.options!.nutrition!.carbs ?? 0)    + modalNutritionAdditionals.reduce((s, a) => s + (a.carbs ?? 0), 0)    + modalNutritionVariableChoices.reduce((s, c) => s + (c.carbs ?? 0), 0),
      }
    : null

  const [animNutrition, setAnimNutrition] = useState<{ calories: number; fat: number; protein: number; carbs: number } | null>(null)
  const animNutritionRaf = useRef<number | null>(null)
  useEffect(() => {
    if (animNutritionRaf.current) cancelAnimationFrame(animNutritionRaf.current)
    if (!modalNutrition) { setAnimNutrition(null); return }
    const target = modalNutrition
    const start = animNutrition ?? { calories: 0, fat: 0, protein: 0, carbs: 0 }
    const startTime = performance.now()
    const duration = 900
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const e = ease(t)
      setAnimNutrition({
        calories: start.calories + (target.calories - start.calories) * e,
        fat:      start.fat      + (target.fat      - start.fat)      * e,
        protein:  start.protein  + (target.protein  - start.protein)  * e,
        carbs:    start.carbs    + (target.carbs    - start.carbs)    * e,
      })
      if (t < 1) animNutritionRaf.current = requestAnimationFrame(tick)
    }
    animNutritionRaf.current = requestAnimationFrame(tick)
    return () => { if (animNutritionRaf.current) cancelAnimationFrame(animNutritionRaf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalNutrition?.calories, modalNutrition?.fat, modalNutrition?.protein, modalNutrition?.carbs])
  const modalNutritionDisplay = modalNutritionEnabled ? (animNutrition ?? { calories: 0, fat: 0, protein: 0, carbs: 0 }) : null

  const modalNutritionRadius = 34
  const modalNutritionCircumference = 2 * Math.PI * modalNutritionRadius
  const modalNutritionTotal = modalNutritionDisplay ? modalNutritionDisplay.fat + modalNutritionDisplay.protein + modalNutritionDisplay.carbs : 0
  const modalNutritionSegments: { key: string; color: string; len: number; dashOffset: number }[] = []
  if (modalNutritionDisplay && modalNutritionTotal > 0) {
    let segOffset = 0
    for (const s of [
      { key: 'fat', value: modalNutritionDisplay.fat, color: '#F59E0B' },
      { key: 'protein', value: modalNutritionDisplay.protein, color: 'var(--sf-accent-color, #7C3AED)' },
      { key: 'carbs', value: modalNutritionDisplay.carbs, color: '#10B981' },
    ]) {
      if (s.value <= 0) continue
      const len = (s.value / modalNutritionTotal) * modalNutritionCircumference
      modalNutritionSegments.push({ key: s.key, color: s.color, len, dashOffset: -segOffset })
      segOffset += len
    }
  }

  const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null)
  const touchStartX             = useRef<number>(0)
  const swipedRef               = useRef<boolean>(false)
  const dragStartIdxRef         = useRef<number>(0)
  const stripRefs               = useRef<Map<string, HTMLDivElement>>(new Map())
  const lightboxStripRef        = useRef<HTMLDivElement | null>(null)
  const lightboxDragStartIdxRef = useRef<number>(0)

  const storeCurrency = (store.store_currency ?? 'USD') as 'USD' | 'EUR'
  const currencySymbol = storeCurrency === 'EUR' ? '€' : '$'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view])

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as Navigator & { standalone?: boolean }).standalone
    setIsIos(ios)
    // `display-mode` reflects the TOP-level browsing context per spec, so inside the
    // dashboard's preview iframe this can report "standalone" just because the dashboard
    // itself is installed/standalone — not because this storefront is. Skip it there.
    if (!isDashboardPreview && window.matchMedia('(display-mode: standalone)').matches) { setInstalled(true); return }
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as Event & { prompt(): void }) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isDashboardPreview])

  async function handleInstall() {
    if (isIos) { setShowIosHint(h => !h); return }
    if (!installPrompt) return
    installPrompt.prompt(); setInstallPrompt(null)
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cart-${store.slug}`)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, CartItem>
        Object.values(parsed).forEach(item => { if (!item.extraPrice) item.extraPrice = 0 })
        setCart(parsed)
      }
    } catch {}
  }, [store.slug])

  useEffect(() => {
    // When the cedula-based customer system is on, identity must come only
    // from a real lookup for whatever cedula is entered — never from a
    // device-wide cache, or a different person on the same device would
    // see the last visitor's name/phone/address.
    const usesCedula = store.template_config?.homePage?.collectCustomerData !== false
      && store.template_config?.homePage?.enabled
    try {
      if (!usesCedula) {
        const saved = localStorage.getItem('lyte-customer')
        if (saved) {
          const { name, phone } = JSON.parse(saved)
          if (name) setCustomerName(name)
          if (phone) setCustomerPhone(phone)
        }
      }
      // The cedula itself is intentionally never remembered on-device — it
      // must always be typed fresh so the right person's profile loads.
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Keyed by cedula when the cedula system is on (that's the actual
    // identity the shopper entered with), falling back to phone for
    // stores without it — never mixing the two, or two different
    // cedulas sharing a phone (common while testing) would see each
    // other's saved locations.
    const key = collectCustomerData && customerCedula.trim()
      ? `cedula-${customerCedula.trim()}`
      : customerPhone.replace(/\D/g, '')
    if (!key) { setSavedLocations([]); setShowNewLoc(true); return }
    try {
      const raw = localStorage.getItem(`lyte-locs-${key}`)
      const locs: SavedLocation[] = raw ? JSON.parse(raw) : []
      setSavedLocations(locs)
      setSelectedLocId(null)
      setShowNewLoc(locs.length === 0)
    } catch { setSavedLocations([]); setShowNewLoc(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone, customerCedula])

  useEffect(() => {
    try { localStorage.setItem(`cart-${store.slug}`, JSON.stringify(cart)) } catch {}
  }, [cart, store.slug])



  useEffect(() => {
    if (customerLat === null || customerLng === null || deliveryZones.length === 0) {
      setMatchedZone(null)
      return
    }
    const hits = deliveryZones.filter(z =>
      haversineMeters(customerLat, customerLng, z.center_lat, z.center_lng) <= z.radius_m
    )
    hits.sort((a, b) => a.radius_m - b.radius_m)
    setMatchedZone(hits[0] ?? null)
  }, [customerLat, customerLng, deliveryZones])

  // ── Scroll-spy: highlight whichever category pill matches the section in view ──
  useEffect(() => {
    if (view !== 'catalog') return
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.sf-cat-section[id]'))
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        const topmost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b))
        const id = topmost.target.id
        setActiveCatId(id === 'cat-other' ? '__other' : id.replace(/^cat-/, ''))
      },
      { rootMargin: '-56px 0px -70% 0px', threshold: 0 }
    )
    sections.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [view])

  // ── Horizontal category carousels: keep only the leading (start-snapped) card in focus,
  // and dismiss the "Desliza" hint the first time each row is scrolled ──
  useEffect(() => {
    if (view !== 'catalog') return
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.sf-grid-horizontal'))
    if (rows.length === 0) return
    const cleanups: (() => void)[] = []
    rows.forEach(row => {
      const cards = Array.from(row.querySelectorAll<HTMLElement>('.sf-card'))
      const dots  = row.parentElement?.querySelectorAll<HTMLElement>('.sf-hcarousel-dot') ?? null
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            entry.target.classList.toggle('sf-carousel-focused', entry.isIntersecting)
            if (entry.isIntersecting && dots) {
              const idx = cards.indexOf(entry.target as HTMLElement)
              dots.forEach((dot, i) => dot.classList.toggle('on', i === idx))
            }
          })
        },
        { root: row, rootMargin: '0px -80% 0px 0px', threshold: 0 }
      )
      cards.forEach(card => observer.observe(card))
      cleanups.push(() => observer.disconnect())

      const hint = row.parentElement?.querySelector<HTMLElement>('.sf-hcarousel-hint')
      if (hint) {
        const dismiss = () => hint.classList.add('sf-hcarousel-hint-hidden')
        row.addEventListener('scroll', dismiss, { once: true, passive: true })
        cleanups.push(() => row.removeEventListener('scroll', dismiss))
      }
    })
    return () => cleanups.forEach(fn => fn())
  }, [view])

  const cartItems  = Object.values(cart).filter(i => i.quantity > 0)
  const cartCount  = cartItems.reduce((s, i) => s + i.quantity, 0)
  const cartTotal  = cartItems.reduce((s, i) => s + (i.price + i.extraPrice) * i.quantity, 0)

  // ── Checkout settings ──
  const cs                   = store.checkout_settings ?? {}
  const requirePaymentMethod = cs.requirePaymentMethod ?? false
  const requirePaymentProof  = cs.requirePaymentProof  ?? false
  const dtOn            = cs.deliveryTypes?.delivery !== false  // domicilio habilitado (default true)
  const puOn            = cs.deliveryTypes?.pickup === true     // retiro habilitado (default false)
  const bothTypes       = dtOn && puOn
  const zoneBasedFee   = deliveryZones.length > 0 && customerLat !== null ? (matchedZone?.fee ?? 0) : null
  const deliveryFeeAmt = dtOn && deliveryType === 'delivery' && cs.deliveryEnabled
    ? (zoneBasedFee !== null ? zoneBasedFee : cs.deliveryFee ? Number(cs.deliveryFee) : 0)
    : 0
  const orderTotal  = cartTotal + deliveryFeeAmt
  const showLocForm = savedLocations.length === 0 || showNewLoc

  function getProdQty(productId: string): number {
    return Object.values(cart).filter(i => (i.productId ?? i.id) === productId).reduce((s, i) => s + i.quantity, 0)
  }
  const enabledMethods = parsePaymentMethods(store.payment_methods)
  const showInstallBtn = !installed && (isIos || !!installPrompt)

  const VES_METHODS = new Set(['pago_movil', 'efectivo_bs', 'transferencia', 'punto_venta'])
  const selectedMethodIsVES = VES_METHODS.has(selectedPayment)
  const vesAmount = selectedMethodIsVES && bcvRate ? orderTotal * bcvRate : null

  // ── Template config ──
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
  }
  const cfg          = store.template_config ?? {}
  const cfgFontFamily  = cfg.pageFont ? FONT_MAP[cfg.pageFont] : undefined
  const cfgFontSize    = cfg.fontSize ?? 'medium'
  const cfgFontSizePx  = cfg.fontSizePx ?? (cfg.fontSize === 'small' ? 13 : cfg.fontSize === 'large' ? 18 : undefined)
  const cfgTextAlign   = cfg.textAlign ?? 'left'
  const cfgPhotoShape  = cfg.photoShape ?? 'square'
  const cfgPhotoSize   = cfg.photoSize  ?? 'medium'
  const cfgPriceColor      = cfg.priceColor ?? '#7C3AED'
  const cfgPriceFontFamily = cfg.priceFont ? FONT_MAP[cfg.priceFont] : undefined
  const cfgPriceSize       = cfg.priceSize ?? 'medium'
  const cfgCategoryShapes  = cfg.categoryPhotoShapes ?? {}
  const cfgCategoryLayouts = cfg.categoryLayouts ?? {}
  const cfgCatNavStyle     = cfg.categoryNavStyle ?? 'pills'
  const cfgStickyCatNav    = cfg.stickyCatNav !== false
  const cfgVariantShape    = cfg.variantShape ?? 'pill'
  const cfgExtraShape      = cfg.extraShape ?? 'rounded'
  const cfgLogoShape   = cfg.logoShape ?? 'rounded'
  const cfgLogoSizePx  = cfg.logoSizePx ?? (cfg.logoSize === 'small' ? 26 : cfg.logoSize === 'large' ? 46 : 34)
  const cfgLogoPosition: 'left' | 'center' | 'right' | 'none' =
    cfg.logoPosition ?? (
      cfg.headerLayout === 'solo-nombre' ? 'none' :
      cfg.headerLayout === 'centrado'    ? 'center' : 'left'
    )
  const cfgNamePosition: 'left' | 'center' | 'right' | 'none' =
    cfg.namePosition ?? (
      cfg.headerLayout === 'solo-logo' ? 'none' :
      cfg.headerLayout === 'centrado'  ? 'center' : 'left'
    )
  const cfgHeaderOverBanner = !!cfg.headerOverBanner && !!store.banner_url && store.template !== 'vitrina' && store.template !== 'catalogo'
  const cfgCatNavOverBanner = !!cfg.catNavOverBanner && !!store.banner_url && store.template !== 'vitrina' && store.template !== 'catalogo'
  // "Anclar encabezado" always keeps the header at the top while scrolling,
  // in either mode — sticky in normal flow, or fixed (instead of absolute)
  // when it floats over the banner. No scroll-position dependency: it's
  // anchored from the very start, not only once you've scrolled some amount.
  const cfgHeaderSticky = !!cfg.headerSticky
  // headerHeightPx only sets a *minimum* height on the header — real content
  // (a tall logo, a wrapping name) can render taller than that. Measuring the
  // actual element avoids the category bar landing under/over the header by
  // however many pixels the configured value was off by.
  const cfgStickyOffsetPx = cfgHeaderSticky ? (headerHeightMeasured ?? cfg.headerHeightPx ?? 56) : 0
  const cfgModalWizard = !!cfg.modalWizard

  // ── iOS Safari reveals <body>'s own background during the rubber-band
  // overscroll bounce past the top/bottom of the page. The app shell's
  // global body background follows the visitor's OS dark-mode setting
  // (near-black in dark mode), which has nothing to do with this store's
  // colors — sync it to match so the bounce doesn't flash a mismatched
  // color behind the header/banner. Reset on unmount so it doesn't leak
  // onto other pages after a client-side navigation away from the store. ──
  useEffect(() => {
    const bg = cfg.pageBg || '#FAFAF9'
    document.body.style.background = bg
    return () => { document.body.style.background = '' }
  }, [cfg.pageBg])

  // ── Measure the header's real rendered height (see cfgStickyOffsetPx) ──
  useEffect(() => {
    if (view !== 'catalog' || !cfgHeaderSticky) { setHeaderHeightMeasured(null); return }
    const header = document.querySelector<HTMLElement>('.sf-topbar')
    if (!header) return
    const update = () => setHeaderHeightMeasured(header.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(header)
    return () => ro.disconnect()
  }, [view, cfgHeaderSticky])

  // ── "Categorias sobre el banner": rather than a JS-triggered jump from
  // "floating over the banner" to "pinned below the header" (which visibly
  // passed the category bar behind the header for a frame or two on the way),
  // this is now native position:sticky the whole time — it drags continuously
  // with the scroll from the exact moment it touches the header, with zero
  // jump, because the browser does it directly instead of a class toggle
  // reacting to scroll position after the fact. A negative margin-top pulls
  // its natural (unstuck) position up to sit over the banner's bottom edge;
  // measuring its own height keeps that overlap exact regardless of font
  // size / button padding. ──
  useEffect(() => {
    if (view !== 'catalog' || !cfgCatNavOverBanner) { setCatNavHeightMeasured(null); return }
    const el = document.querySelector<HTMLElement>('.sf-cat-nav-glass')
    if (!el) return
    const update = () => setCatNavHeightMeasured(el.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, cfgCatNavOverBanner])

  const pageStyle: React.CSSProperties = {
    ...(cfg.pageBg ? { background: cfg.pageBg } : {}),
    ...(cfgFontFamily ? { fontFamily: cfgFontFamily } : {}),
    ...(cfgFontSizePx ? { fontSize: `${cfgFontSizePx}px` } : {}),
    '--sf-price-color': cfgPriceColor,
    ...(cfgPriceFontFamily ? { '--sf-price-font': cfgPriceFontFamily } : {}),
    ...(cfg.cardBg      ? { '--sf-card-bg':     cfg.cardBg      } : {}),
    ...(cfg.accentColor ? { '--sf-accent-color': cfg.accentColor } : {}),
    ...(cfg.pageBg      ? { '--sf-page-bg':      cfg.pageBg      } : {}),
    ...(cfg.catTitleColor ? { '--sf-cat-title-color': cfg.catTitleColor } : {}),
    ...(cfg.categorySpacing !== undefined ? { '--sf-cat-spacing': `${cfg.categorySpacing}px` } : {}),
    ...(cfg.headerHeightPx !== undefined ? { '--sf-header-height': `${cfg.headerHeightPx}px` } : {}),
    ...(cfg.headerIconColor ? { '--sf-header-icon-color': cfg.headerIconColor } : {}),
    '--sf-sticky-offset': `${cfgStickyOffsetPx}px`,
    '--sf-catnav-overlap': `-${catNavHeightMeasured ?? 52}px`,
    ...(cfg.catTitleFont && FONT_MAP[cfg.catTitleFont] ? { '--sf-cat-title-font': FONT_MAP[cfg.catTitleFont] } : {}),
    ...(cfg.productNameFont && FONT_MAP[cfg.productNameFont] ? { '--sf-product-name-font': FONT_MAP[cfg.productNameFont] } : {}),
  } as React.CSSProperties

  function renderSingleBlock(block: ContentBlock) {
    return (
      <div key={block.id} className="sf-content-block" style={{ padding: `${block.spacing ?? 8}px 0` }}>
        {block.type === 'text' && (
          <div
            className="sf-block-text"
            style={{
              fontSize: block.fontSize ? `${block.fontSize}px` : undefined,
              fontWeight: block.fontWeight || undefined,
              color: block.color || undefined,
              textAlign: block.align || undefined,
              fontFamily: block.font && FONT_MAP[block.font] ? FONT_MAP[block.font] : undefined,
            }}
          >
            {block.content}
          </div>
        )}
        {block.type === 'image' && block.content && (
          <img src={block.content} alt="" className="sf-block-img" />
        )}
        {block.type === 'video' && block.content && (
          <div className="sf-block-video-wrap">
            {block.content.includes('youtu') || block.content.includes('vimeo') ? (
              <iframe
                src={toEmbedUrl(block.content)}
                className="sf-block-iframe"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <video src={block.content} controls className="sf-block-video-el" />
            )}
          </div>
        )}
        {block.type === 'buttons' && block.content && (
          <div className="sf-block-buttons">
            {(() => {
              let items: BlockButtonItem[] = []
              try { items = JSON.parse(block.content) } catch {}
              return items.filter(b => b.label?.trim() && b.targetId).map(b => (
                <button
                  key={b.id}
                  type="button"
                  className="sf-block-btn"
                  onClick={() => {
                    if (b.target === 'product') {
                      const p = products.find(pr => pr.id === b.targetId)
                      if (p) openProductModal(p)
                    } else {
                      const cat = categories.find(c => c.id === b.targetId)
                      if (cat) { setFocusCategory(cat); window.scrollTo({ top: 0 }) }
                    }
                  }}
                >
                  {b.label}
                </button>
              ))
            })()}
          </div>
        )}
      </div>
    )
  }

  function renderContentBlocks(afterId: string) {
    const blocks = (cfg.contentBlocks ?? []) as ContentBlock[]
    const groups = (cfg.blockGroups ?? []) as BlockGroup[]
    const matching = blocks.filter(b => b.afterId === afterId)
    if (matching.length === 0) return null
    const renderedGroups = new Set<string>()
    return (
      <>
        {matching.map(block => {
          if (block.groupId) {
            if (renderedGroups.has(block.groupId)) return null
            renderedGroups.add(block.groupId)
            const groupMeta = groups.find(g => g.id === block.groupId)
            const members = matching.filter(m => m.groupId === block.groupId)
            return (
              <div
                key={block.groupId}
                className="sf-block-group"
                style={{
                  background: groupMeta?.background || undefined,
                  borderRadius: groupMeta?.borderRadius !== undefined ? `${groupMeta.borderRadius}px` : undefined,
                  padding: groupMeta?.padding !== undefined ? `${groupMeta.padding}px` : undefined,
                }}
              >
                {members.map(renderSingleBlock)}
              </div>
            )
          }
          return renderSingleBlock(block)
        })}
      </>
    )
  }

  function renderProductGrid(items: Product[], layoutKey: string) {
    if (cfgCategoryLayouts[layoutKey] !== 'horizontal') {
      return <div className="sf-grid">{items.map(renderCard)}</div>
    }
    return (
      <div className="sf-hcarousel-wrap">
        <div className="sf-grid-horizontal">{items.map(renderCard)}</div>
        <div className="sf-hcarousel-hint" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M13 5l7 7-7 7M4 12h15" />
          </svg>
          Desliza
        </div>
        {items.length > 1 && (
          <div className="sf-hcarousel-dots">
            {items.map((_, i) => (
              <div key={i} className={`sf-hcarousel-dot${i === 0 ? ' on' : ''}`} />
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderProductModal() {
    if (!modalProduct) return null
    return (
      <div className="sf-modal-overlay" onClick={() => setModalProduct(null)}>
        <div className="sf-modal-wrap">
          {modalNutritionEnabled && modalNutritionDisplay && (
            <div className="sf-modal-nutrition-badge sf-modal-nutrition-badge-float">
              <div className="sf-modal-nutrition-chart">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r={modalNutritionRadius} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="10" />
                  {modalNutritionSegments.map(s => (
                    <circle
                      key={s.key} cx="40" cy="40" r={modalNutritionRadius} fill="none"
                      stroke={s.color} strokeWidth="10"
                      strokeDasharray={`${s.len} ${modalNutritionCircumference - s.len}`}
                      strokeDashoffset={s.dashOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                    />
                  ))}
                </svg>
                <div className="sf-modal-nutrition-kcal">
                  <strong>{Math.round(modalNutritionDisplay.calories)}</strong>
                  <span>kcal</span>
                </div>
              </div>
              <div className="sf-modal-nutrition-legend">
                <div className="sf-modal-nutrition-legend-item">
                  <span className="sf-modal-nutrition-dot" style={{ background: '#F59E0B' }} />
                  Grasas <strong>{Math.round(modalNutritionDisplay.fat)}g</strong>
                </div>
                <div className="sf-modal-nutrition-legend-item">
                  <span className="sf-modal-nutrition-dot" style={{ background: 'var(--sf-accent-color, #7C3AED)' }} />
                  Proteínas <strong>{Math.round(modalNutritionDisplay.protein)}g</strong>
                </div>
                <div className="sf-modal-nutrition-legend-item">
                  <span className="sf-modal-nutrition-dot" style={{ background: '#10B981' }} />
                  Carbos <strong>{Math.round(modalNutritionDisplay.carbs)}g</strong>
                </div>
              </div>
            </div>
          )}
        <div className="sf-modal" onClick={e => e.stopPropagation()}>
          <button className="sf-modal-close" onClick={() => setModalProduct(null)}>×</button>

          <div className="sf-modal-product-head">
            {modalDisplayImage && (() => {
              const openLightbox = () => {
                const cvs = modalProduct.options?.colorVariants
                const imgs = cvs?.length ? cvs.map(v => v.imageUrl).filter(Boolean) as string[] : [modalDisplayImage!]
                setLightbox({ images: imgs, idx: cvs?.length ? Math.max(0, cvs.findIndex(v => v.label === modalColor)) : 0 })
              }
              return isVideoUrl(modalDisplayImage)
                ? <video src={modalDisplayImage} autoPlay muted loop playsInline className="sf-modal-img sf-modal-img-zoom" onClick={openLightbox} />
                : <img src={modalDisplayImage} alt={modalProduct.name} className="sf-modal-img sf-modal-img-zoom" onClick={openLightbox} />
            })()}
            <div className="sf-modal-product-info">
              <div className="sf-modal-name">{modalProduct.name}</div>
              {modalProduct.description && <div className="sf-modal-desc">{modalProduct.description}</div>}
              <div className="sf-modal-base-price">
                {currencySymbol}{(modalProduct.price + modalExtraPrice).toFixed(2)}
                {modalExtraPrice > 0 && <span className="sf-modal-base-price-was">{currencySymbol}{Number(modalProduct.price).toFixed(2)}</span>}
              </div>
            </div>
          </div>

          {modalWizardActive && modalWizardStep ? (
            <div key={modalStep} className="sf-modal-body sf-modal-wizard">
              <div className="sf-modal-wizard-progress">
                {modalWizardSteps.map((_, i) => (
                  <div key={i} className={`sf-modal-wizard-dot${i === modalStep ? ' active' : ''}${i < modalStep ? ' done' : ''}`} />
                ))}
              </div>
              <div className="sf-modal-wizard-question">
                {modalWizardStep.kind === 'variable' ? modalWizardStep.group.label : 'Color'}
                {modalWizardStep.kind === 'variable' && wizardVarMinMax.min > 0 && (
                  <span className="sf-modal-wizard-hint">Elige {wizardVarMinMax.min === wizardVarMinMax.max ? wizardVarMinMax.min : `${wizardVarMinMax.min}-${wizardVarMinMax.max}`}</span>
                )}
              </div>
              {modalWizardStep.kind === 'variable' ? (
                <div className="sf-modal-chips sf-modal-wizard-chips">
                  {modalWizardStep.group.choices.map(normalizeChoice).map(c => (
                    <button
                      key={c.value}
                      className={`sf-modal-chip${(modalVars[modalWizardStep.group.label] ?? []).includes(c.value) ? ' selected' : ''}`}
                      onClick={() => {
                        toggleModalVar(modalWizardStep.group, c.value)
                        if (wizardVarMinMax.max <= 1) advanceModalWizard()
                      }}
                    >
                      {c.value}
                      {c.price > 0 && <span className="sf-modal-chip-price">+{currencySymbol}{c.price.toFixed(2)}</span>}
                    </button>
                  ))}
                </div>
              ) : (modalProduct.options?.colorVariants?.length ?? 0) > 0 ? (
                <div className="sf-modal-color-swatches sf-modal-wizard-swatches">
                  {modalProduct.options!.colorVariants!.map((v, i) => (
                    <button
                      key={i}
                      className={`sf-modal-color-swatch${modalColor === v.label ? ' selected' : ''}`}
                      style={{ background: v.color }}
                      title={v.label}
                      onClick={() => {
                        setModalColor(v.label)
                        setSelectedVariants(p => ({ ...p, [modalProduct!.id]: i }))
                        advanceModalWizard()
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="sf-modal-chips sf-modal-wizard-chips">
                  {modalProduct.options!.colors!.map(c => (
                    <button
                      key={c}
                      className={`sf-modal-chip${modalColor === c ? ' selected' : ''}`}
                      onClick={() => {
                        setModalColor(c)
                        advanceModalWizard()
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="sf-modal-wizard-actions">
                {modalStep > 0 && (
                  <button className="sf-modal-wizard-back" onClick={() => setModalStep(s => Math.max(0, s - 1))}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M12 15l-5-5 5-5" /></svg>
                    Atras
                  </button>
                )}
                <button
                  className="sf-modal-wizard-skip"
                  disabled={!wizardVarSatisfied}
                  onClick={() => setModalStep(s => s + 1)}
                >
                  {wizardVarMinMax.min > 0 || wizardVarCount > 0 ? 'Siguiente' : 'Omitir'}
                </button>
              </div>
            </div>
          ) : (
            <div className="sf-modal-body">
              {!cfgModalWizard && modalProduct.options?.variables?.filter(g => g.choices.length > 0).map((g, gi) => {
                const { min, max } = groupMinMax(g)
                const count = (modalVars[g.label] ?? []).length
                return (
                  <div key={gi} className="sf-modal-section">
                    <div className="sf-modal-section-title">
                      {g.label}
                      {min > 0
                        ? <span className="sf-required">requerido{max > 1 ? ` · elige ${min === max ? min : `${min}-${max}`}` : ''}</span>
                        : max > 1 && <span className="sf-optional">opcional · hasta {max}</span>}
                    </div>
                    <div className="sf-modal-chips">
                      {g.choices.map(normalizeChoice).map(c => (
                        <button
                          key={c.value}
                          className={`sf-modal-chip${(modalVars[g.label] ?? []).includes(c.value) ? ' selected' : ''}`}
                          onClick={() => toggleModalVar(g, c.value)}
                        >
                          {c.value}
                          {c.price > 0 && <span className="sf-modal-chip-price">+{currencySymbol}{c.price.toFixed(2)}</span>}
                        </button>
                      ))}
                    </div>
                    {min > 0 && count < min && <div className="sf-modal-section-hint">Elige al menos {min}</div>}
                  </div>
                )
              })}

              {!cfgModalWizard && ((modalProduct.options?.colorVariants?.length ?? 0) > 0 ? (
                <div className="sf-modal-section">
                  <div className="sf-modal-section-title">Color</div>
                  <div className="sf-modal-color-swatches">
                    {modalProduct.options!.colorVariants!.map((v, i) => (
                      <button
                        key={i}
                        className={`sf-modal-color-swatch${modalColor === v.label ? ' selected' : ''}`}
                        style={{ background: v.color }}
                        title={v.label}
                        onClick={() => {
                          const next = modalColor === v.label ? undefined : v.label
                          setModalColor(next)
                          if (next) setSelectedVariants(p => ({ ...p, [modalProduct!.id]: i }))
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (modalProduct.options?.colors?.length ?? 0) > 0 ? (
                <div className="sf-modal-section">
                  <div className="sf-modal-section-title">Color</div>
                  <div className="sf-modal-chips">
                    {modalProduct.options!.colors!.map(c => (
                      <button
                        key={c}
                        className={`sf-modal-chip${modalColor === c ? ' selected' : ''}`}
                        onClick={() => setModalColor(prev => prev === c ? undefined : c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null)}

              {(modalProduct.options?.additionals?.length ?? 0) > 0 && (
                <div className="sf-modal-section">
                  <div className="sf-modal-section-title">Adicionales</div>
                  {modalProduct.options!.additionals!.map((a, i) => (
                    <div
                      key={i}
                      className={`sf-modal-extra${modalAdditionals.has(i) ? ' selected' : ''}`}
                      onClick={() => setModalAdditionals(prev => {
                        const next = new Set(prev)
                        next.has(i) ? next.delete(i) : next.add(i)
                        return next
                      })}
                    >
                      <div className={`sf-modal-extra-check${modalAdditionals.has(i) ? ' on' : ''}`} />
                      <span className="sf-modal-extra-name">{a.name}</span>
                      {a.price > 0 && <span className="sf-modal-extra-price">+{currencySymbol}{a.price.toFixed(2)}</span>}
                    </div>
                  ))}
                </div>
              )}

              {modalProduct.options?.allowNotes && (
                <div className="sf-modal-section">
                  <div className="sf-modal-section-title">Notas <span className="sf-optional">opcional</span></div>
                  <textarea
                    className="sf-modal-notes"
                    placeholder="Instrucciones especiales..."
                    value={modalNotes}
                    onChange={e => setModalNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}

          {!modalWizardActive && (
            <div className="sf-modal-footer">
              <div className="sf-modal-qty">
                <button onClick={() => setModalQty(q => Math.max(1, q - 1))}>−</button>
                <span>{modalQty}</span>
                <button onClick={() => setModalQty(q => q + 1)}>+</button>
              </div>
              <button className="sf-modal-confirm" onClick={confirmModal} disabled={!modalVariablesOk}>
                Agregar · {currencySymbol}{((modalProduct.price + modalExtraPrice) * modalQty).toFixed(2)}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    )
  }

  // ── Modal helpers ──
  // Below a group's max, tapping a choice toggles it into the selection
  // (or, for a max-1 group, replaces it — same as the old single-select).
  function toggleModalVar(group: VariableGroup, value: string) {
    const { max } = groupMinMax(group)
    setModalVars(v => {
      const current = v[group.label] ?? []
      if (max <= 1) return { ...v, [group.label]: current[0] === value ? [] : [value] }
      if (current.includes(value)) return { ...v, [group.label]: current.filter(x => x !== value) }
      if (current.length >= max) return v
      return { ...v, [group.label]: [...current, value] }
    })
  }
  function openProductModal(p: Product) {
    setModalProduct(p)
    setModalVars({})
    let initialColor: string | undefined
    if (p.options?.colorVariants?.length) {
      initialColor = p.options.colorVariants[0]?.label
    }
    setModalColor(initialColor)
    setModalAdditionals(new Set())
    setModalNotes('')
    setModalQty(1)
    setModalStep(0)
  }

  function confirmModal() {
    if (!modalProduct || !modalVariablesOk) return
    const selectedAdds = (modalProduct.options?.additionals ?? []).filter((_, i) => modalAdditionals.has(i))
    const extraPrice   = selectedAdds.reduce((s, a) => s + a.price, 0) + modalVariablePrice
    const variantImage = modalColor && modalProduct.options?.colorVariants?.length
      ? (modalProduct.options.colorVariants.find(v => v.label === modalColor)?.imageUrl ?? null)
      : null
    const modalVarsClean = Object.fromEntries(Object.entries(modalVars).filter(([, values]) => values.length > 0))
    const newKey = buildCartKey(modalProduct.id, modalColor, Object.keys(modalVarsClean).length ? modalVarsClean : undefined)
    setCart(prev => {
      const next = { ...prev }
      const baseQty = next[newKey]?.quantity ?? 0
      next[newKey] = {
        id: newKey, productId: modalProduct.id, name: modalProduct.name,
        price: modalProduct.price, extraPrice,
        image_url: variantImage ?? modalProduct.image_url, quantity: baseQty + modalQty,
        options: modalProduct.options ?? undefined,
        selectedOptions: {
          variables:   Object.keys(modalVarsClean).length ? modalVarsClean : undefined,
          color:       modalColor,
          additionals: selectedAdds.length ? selectedAdds : undefined,
          notes:       modalNotes.trim() || undefined,
        },
      }
      return next
    })
    setModalProduct(null)
  }

  function clearCart() { setCart({}) }

  function updateQty(id: string, delta: number) {
    setCart(prev => {
      const next = (prev[id]?.quantity ?? 0) + delta
      if (next <= 0) { const { [id]: _, ...rest } = prev; return rest }
      return { ...prev, [id]: { ...prev[id], quantity: next } }
    })
  }

  function requestLocation() {
    if (!navigator.geolocation) return
    setLocationState('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCustomerLat(pos.coords.latitude)
        setCustomerLng(pos.coords.longitude)
        setLocationState('granted')
      },
      (err) => {
        // code 1 = PERMISSION_DENIED; 2/3 = unavailable/timeout → allow retry
        setLocationState(err.code === 1 ? 'denied' : 'idle')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  // Compress the proof photo as soon as it's picked (while the customer is
  // still filling out the rest of checkout), so by the time they submit the
  // file is already small and the upload is near-instant.
  function handleProofFile(f: File) {
    setPaymentProofPreview(URL.createObjectURL(f))
    setPaymentProofFile(f)
    compressImage(f)
      .then(compressed => { if (compressed.size < f.size) setPaymentProofFile(compressed) })
      .catch(() => {})
  }

  // ── Order submit ──
  async function handleSubmit() {
    if (!customerName.trim() || !customerPhone.trim()) { setError(t('store.error.required')); return }
    if (deliveryType === 'delivery' && !customerLat && !customerAddress.trim()) {
      setError('Ingresa tu direccion o comparte tu ubicacion GPS para continuar')
      return
    }
    if (deliveryType === 'delivery' && deliveryZones.length > 0 && customerLat !== null && matchedZone === null) {
      setError('Ubicacion desconocida, por favor contactenos para coordinar tu entrega')
      return
    }
    if (requirePaymentMethod && !selectedPayment && !paymentFreeText.trim()) {
      setError('Debes seleccionar un metodo de pago para continuar')
      return
    }
    if (requirePaymentProof && (selectedPayment || paymentFreeText.trim()) && !paymentProofFile) {
      setError('Debes subir el comprobante de pago para continuar')
      return
    }
    setSubmitting(true); setError('')
    const paymentLabel = selectedPayment
      ? (enabledMethods.find(m => m.type === selectedPayment)?.label ?? selectedPayment)
      : paymentFreeText
    const isPickup = deliveryType === 'pickup'

    try {
      const newOrderId = crypto.randomUUID()

      let proofUrl: string | null = null
      if (paymentProofFile) {
        const ext = paymentProofFile.name.split('.').pop() ?? 'jpg'
        const path = `orders/proofs/${store.id}/${newOrderId}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('store-assets')
          .upload(path, paymentProofFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('store-assets').getPublicUrl(path)
          proofUrl = urlData.publicUrl
        }
      }

      // Goes through our own server instead of straight from the customer's
      // connection to Supabase — one hop the customer's (often mobile, often
      // slower) network doesn't have to make, and it also creates order_items
      // server-side in the same request instead of a second client call.
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newOrderId, store_id: store.id,
          customer_name: customerName.trim(), customer_phone: customerPhone.trim(),
          customer_notes: customerNotes.trim() || null,
          payment_method: paymentLabel || null, total: orderTotal,
          delivery_type: isPickup ? 'pickup' : 'delivery',
          payment_proof_url: proofUrl,
          items: cartItems.map(i => ({
            product_id: i.productId ?? i.id,
            product_name: i.name, product_price: i.price,
            quantity: i.quantity,
            subtotal: +((i.price + i.extraPrice) * i.quantity).toFixed(2),
            selected_options: i.selectedOptions ?? null,
          })),
        }),
      })
      if (!orderRes.ok) {
        const { error: orderErrMsg } = await orderRes.json().catch(() => ({ error: 'No se pudo crear el pedido' }))
        throw new Error(orderErrMsg)
      }

      if (!collectCustomerData) {
        try { localStorage.setItem('lyte-customer', JSON.stringify({ name: customerName.trim(), phone: customerPhone.trim() })) } catch {}
      }

      if (collectCustomerData && customerCedula.trim()) {
        fetch('/api/customer-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: store.id, cedula: customerCedula.trim(),
            name: customerFields.name ? customerName.trim() : null,
            phone: customerFields.phone ? customerPhone.trim() : null,
            address: customerFields.address ? (customerAddress.trim() || null) : null,
          }),
        }).catch(() => {})
      }

      // Comanda lines
      const newDeliveryId = isPickup ? null : crypto.randomUUID()
      if (newDeliveryId) setDeliveryTrackId(newDeliveryId)

      const lines: string[] = [
        `*Comanda #${newOrderId.slice(0, 8).toUpperCase()}*`,
        new Date().toLocaleString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        '', `*Nombre:* ${customerName}`, `*Telefono:* ${customerPhone}`,
        ...(bothTypes ? [`*Tipo:* ${isPickup ? 'Retiro en tienda' : 'Domicilio'}`] : []),
        ...(!isPickup && customerAddress.trim() ? [`*Direccion:* ${customerAddress.trim()}`] : []),
        ...(paymentLabel ? [`*Pago:* ${paymentLabel}`] : []),
        '', '*Productos:*',
        ...cartItems.flatMap(i => {
          const unitTotal = (i.price + i.extraPrice) * i.quantity
          const rows = [`  - ${i.quantity}x ${i.name}  ${currencySymbol}${unitTotal.toFixed(2)}`]
          const so = i.selectedOptions
          if (so?.variables) Object.entries(so.variables).forEach(([k, v]) => rows.push(`    ${k}: ${variableValueLabel(v)}`))
          if (so?.color)     rows.push(`    Color: ${so.color}`)
          if (so?.additionals?.length) rows.push(`    Extras: ${so.additionals.map(a => a.name).join(', ')}`)
          if (so?.notes)     rows.push(`    Nota: ${so.notes}`)
          return rows
        }),
        '', `*Subtotal: ${currencySymbol}${cartTotal.toFixed(2)}*`,
        ...(deliveryFeeAmt > 0 ? [`*Envio: ${currencySymbol}${deliveryFeeAmt.toFixed(2)}${matchedZone ? ` (${matchedZone.name})` : ''}*`] : []),
        `*Total: ${currencySymbol}${orderTotal.toFixed(2)}*`,
        ...(vesAmount ? [`*Total Bs: ${vesAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (BCV ${bcvRate!.toFixed(4)})*`] : []),
        ...(proofUrl ? ['', `*Comprobante:* ${proofUrl}`] : []),
        ...(customerNotes ? ['', `*Notas:* ${customerNotes}`] : []),
        ...(!isPickup && newDeliveryId ? ['', 'Rastrea tu pedido en tiempo real:', `https://lyte-app.com/delivery/${newDeliveryId}`] : []),
        ...(isPickup ? ['', 'Sigue el estado de tu pedido:', `https://lyte-app.com/order/${newOrderId}`] : []),
      ]

      // Create delivery record only for domicilio — not awaited, same reasoning
      // as order_items above: the tracking link works as soon as this lands,
      // which is well before the customer would tap it.
      if (!isPickup && newDeliveryId) {
        fetch('/api/delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newDeliveryId,
            store_id: store.id,
            order_id: newOrderId,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            delivery_address: customerAddress.trim(),
            customer_lat: customerLat,
            customer_lng: customerLng,
          }),
        }).catch(() => {})
      }

      const shortId = newOrderId.slice(0, 8).toUpperCase()
      setOrderId(shortId); setCart({})
      if (isPickup) setPickupTrackId(newOrderId)
      else setPickupTrackId('')

      if (store.whatsapp) {
        const num = store.whatsapp.replace(/\D/g, '')
        const trackParam = isPickup
          ? `pickup=${newOrderId}`
          : `delivery=${newDeliveryId}`
        // Pass already-loaded settings along so the confirmation page can render
        // instantly instead of re-fetching the store row it just came from.
        const csAny = (store.checkout_settings ?? {}) as Record<string, unknown>
        const mapUrlAny = (store as unknown as { map_url?: string | null }).map_url ?? ''
        const queueBoardEnabled = Boolean(
          (store.template_config as unknown as { trackingConfig?: { queueBoard?: { enabled?: boolean } } })
            ?.trackingConfig?.queueBoard?.enabled
        )
        const returnTimeout = hp.orderReturnTimeout
        const settingsParams =
          `&swa=${csAny.showWhatsappBtn === false ? 0 : 1}` +
          `&st=${csAny.showTrackBtn === false ? 0 : 1}` +
          `&sm=${csAny.showMapBtn ? 1 : 0}` +
          `&mu=${encodeURIComponent(mapUrlAny)}` +
          `&qb=${queueBoardEnabled ? 1 : 0}` +
          (returnTimeout?.enabled && returnTimeout.seconds ? `&ret=${returnTimeout.seconds}` : '')
        router.push(`/${store.slug}/pedido?id=${shortId}&${trackParam}&wa=${encodeURIComponent(`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`)}${settingsParams}`)
      } else {
        setView('confirmed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('store.error.generic'))
    }
    setSubmitting(false)
  }

  // ── SPLASH (home page) ──
  const hp = store.template_config?.homePage ?? {}
  const transitionId = hp.transition || 'slide'
  const collectCustomerData = !!hp.enabled && hp.collectCustomerData !== false
  const customerFields = {
    name: hp.customerFields?.name !== false,
    phone: hp.customerFields?.phone !== false,
    address: hp.customerFields?.address !== false,
  }

  // Kiosk-style reset: clears the session and sends the screen back to the
  // home page (or the catalog, if this store doesn't use one), ready for
  // the next customer. Used by both the inactivity and post-order timers.
  function resetToHome() {
    setCart({})
    setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setCustomerNotes('')
    setCustomerCedula(''); setCedulaStatus('idle')
    setSelectedPayment(''); setPaymentFreeText('')
    setDeliveryTrackId(''); setPickupTrackId('')
    setLocationState('idle'); setCustomerLat(null); setCustomerLng(null); setLocationLabel('')
    setPaymentProofFile(null); setPaymentProofPreview(null)
    setOrderId(''); setError(''); setSplashError('')
    setSplashLeaving(false); setCatalogEnter(false)
    setView(hp.enabled ? 'splash' : 'catalog')
  }

  // Reset after N minutes of no interaction (tap/click/scroll/key), so the
  // screen frees up for the next customer if someone walks away mid-browse.
  useEffect(() => {
    const cfg = hp.inactivityTimeout
    if (!cfg?.enabled || !cfg.minutes || view === 'splash') return
    let timer: ReturnType<typeof setTimeout>
    const bump = () => {
      clearTimeout(timer)
      timer = setTimeout(() => resetToHome(), cfg.minutes! * 60000)
    }
    const events: (keyof WindowEventMap)[] = ['mousedown', 'touchstart', 'keydown', 'scroll']
    events.forEach(ev => window.addEventListener(ev, bump))
    bump()
    return () => { clearTimeout(timer); events.forEach(ev => window.removeEventListener(ev, bump)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, hp.inactivityTimeout?.enabled, hp.inactivityTimeout?.minutes])

  // Reset N seconds after an order is confirmed, so a kiosk hands itself
  // back to the home page instead of sitting on the confirmation screen.
  useEffect(() => {
    const cfg = hp.orderReturnTimeout
    if (view !== 'confirmed' || !cfg?.enabled || !cfg.seconds) return
    const t = setTimeout(() => resetToHome(), cfg.seconds * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, hp.orderReturnTimeout?.enabled, hp.orderReturnTimeout?.seconds])

  // Visible countdown for the timer above — purely cosmetic, the actual
  // reset is driven by the setTimeout in the effect above. State updates are
  // deferred via setTimeout(fn, 0) rather than called synchronously in the
  // effect body, same pattern as the reveal-screen timers.
  const [returnCountdown, setReturnCountdown] = useState<number | null>(null)
  useEffect(() => {
    const cfg = hp.orderReturnTimeout
    if (view !== 'confirmed' || !cfg?.enabled || !cfg.seconds) {
      const t = setTimeout(() => setReturnCountdown(null), 0)
      return () => clearTimeout(t)
    }
    const seconds = cfg.seconds
    const t0 = setTimeout(() => setReturnCountdown(seconds), 0)
    const interval = setInterval(() => {
      setReturnCountdown(s => (s !== null && s > 0 ? s - 1 : s))
    }, 1000)
    return () => { clearTimeout(t0); clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, hp.orderReturnTimeout?.enabled, hp.orderReturnTimeout?.seconds])

  type CedulaLookupResult = {
    status: 'found' | 'new' | 'error'
    customer?: { name?: string | null; phone?: string | null; address?: string | null }
  }

  async function lookupCedula(cedula: string): Promise<CedulaLookupResult> {
    if (!cedula) return { status: 'error' }
    setCedulaStatus('checking')
    try {
      const res = await fetch(`/api/customer-lookup?store_id=${store.id}&cedula=${encodeURIComponent(cedula)}`)
      const json = await res.json()
      if (!res.ok || json.error) {
        console.error('customer-lookup failed:', json.error)
        setCedulaStatus('idle')
        setSplashError('No pudimos verificar tu cedula, intenta de nuevo')
        return { status: 'error' }
      }
      if (json.found && json.customer) {
        if (customerFields.name && json.customer.name)       setCustomerName(json.customer.name)
        if (customerFields.phone && json.customer.phone)     setCustomerPhone(json.customer.phone)
        if (customerFields.address && json.customer.address) setCustomerAddress(json.customer.address)
        setCedulaStatus('found')
        return { status: 'found', customer: json.customer }
      } else {
        setCedulaStatus('new')
        return { status: 'new' }
      }
    } catch (err) {
      console.error('customer-lookup network error:', err)
      setCedulaStatus('idle')
      setSplashError('No pudimos verificar tu cedula, intenta de nuevo')
      return { status: 'error' }
    }
  }

  // ── Circular number pad for the cedula field (instead of the OS keyboard) ──
  // Lookup only runs when "Empezar" is pressed (handleSplashStart) — the
  // found/new hint and name/phone/address fields must not pop in while typing.
  function resetCedulaDependents() {
    setCedulaStatus('idle')
    setCustomerName(''); setCustomerPhone(''); setCustomerAddress('')
    setLocationState('idle'); setCustomerLat(null); setCustomerLng(null); setLocationLabel('')
  }
  function pressCedulaDigit(d: string) {
    resetCedulaDependents()
    setCustomerCedula(prev => (prev + d).slice(0, 12))
  }
  function pressCedulaBackspace() {
    resetCedulaDependents()
    setCustomerCedula(prev => prev.slice(0, -1))
  }

  // ── "Slide to reveal" bar that unlocks the number pad ──
  function cedulaSlideUpdate(clientX: number) {
    const bar = cedulaSlideBarRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const thumbSize = 56, pad = 6
    const travel = rect.width - thumbSize - pad * 2
    const raw = travel > 0 ? (clientX - rect.left - pad - thumbSize / 2) / travel : 0
    setCedulaSlideProgress(Math.min(1, Math.max(0, raw)))
  }
  function cedulaSlidePointerDown(e: React.PointerEvent) {
    cedulaSlideDraggingRef.current = true
    setCedulaSliding(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    cedulaSlideUpdate(e.clientX)
  }
  function cedulaSlidePointerMove(e: React.PointerEvent) {
    if (!cedulaSlideDraggingRef.current) return
    cedulaSlideUpdate(e.clientX)
  }
  function cedulaSlidePointerUp() {
    if (!cedulaSlideDraggingRef.current) return
    cedulaSlideDraggingRef.current = false
    setCedulaSliding(false)
    setCedulaSlideProgress(prev => {
      if (prev >= 0.82) { setTimeout(() => setKeypadRevealed(true), 200); return 1 }
      return 0
    })
  }

  function proceedToTransition() {
    if (transitionId === 'logo-morph' && splashLogoRef.current) {
      const r = splashLogoRef.current.getBoundingClientRect()
      setLogoMorphStart({ top: r.top, left: r.left, width: r.width, height: r.height })
      setSplashLeaving(true)
      setTimeout(() => { setCatalogEnter(true); setView('catalog') }, 300)
      return
    }
    if (transitionId === 'reveal') {
      setSplashLeaving(true)
      setTimeout(() => setView('reveal'), 350)
      return
    }
    setSplashLeaving(true)
    setTimeout(() => { setCatalogEnter(true); setView('catalog') }, 550)
  }

  function finishReveal() {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    setCatalogEnter(true)
    setView('catalog')
  }

  function enterStore(status: 'found' | 'new', foundCustomer?: CedulaLookupResult['customer']) {
    const cedula = customerCedula.trim()

    if (status === 'new') {
      if (customerFields.name && !customerName.trim())   { setSplashError('Ingresa tu nombre para continuar'); return }
      if (customerFields.phone && !customerPhone.trim()) { setSplashError('Ingresa tu telefono para continuar'); return }
      if (customerFields.address && !customerAddress.trim() && customerLat === null) {
        setSplashError('Comparte tu ubicacion o ingresa tu direccion para continuar'); return
      }
    }

    // For a just-recognized cedula, use the freshly-fetched values directly
    // rather than customerName/Phone/Address state, which may not have
    // finished updating yet if this runs right after the lookup resolved.
    const nameToSave    = foundCustomer ? (foundCustomer.name ?? '')    : customerName.trim()
    const phoneToSave   = foundCustomer ? (foundCustomer.phone ?? '')   : customerPhone.trim()
    const addressToSave = foundCustomer ? (foundCustomer.address ?? '') : customerAddress.trim()

    fetch('/api/customer-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: store.id, cedula,
        name: customerFields.name ? nameToSave : null,
        phone: customerFields.phone ? phoneToSave : null,
        address: customerFields.address ? (addressToSave || null) : null,
      }),
    }).catch(() => {})

    if (customerFields.address && customerLat !== null) {
      const locKey = cedula ? `cedula-${cedula}` : customerPhone.replace(/\D/g, '')
      if (locKey) {
        try {
          const raw = localStorage.getItem(`lyte-locs-${locKey}`)
          const existing: SavedLocation[] = raw ? JSON.parse(raw) : []
          const loc: SavedLocation = {
            id: crypto.randomUUID(),
            label: locationLabel.trim() || customerAddress.trim() || 'Mi ubicacion',
            address: customerAddress,
            lat: customerLat, lng: customerLng,
          }
          const updated = [...existing, loc]
          localStorage.setItem(`lyte-locs-${locKey}`, JSON.stringify(updated))
          setSavedLocations(updated)
          setSelectedLocId(loc.id)
        } catch {}
      }
    }
    proceedToTransition()
  }

  async function handleSplashStart() {
    setSplashError('')
    const cedula = customerCedula.trim()

    if (!collectCustomerData) { proceedToTransition(); return }

    if (!cedula) { setSplashError('Ingresa tu cedula para continuar'); return }
    if (cedulaStatus === 'found' || cedulaStatus === 'new') { enterStore(cedulaStatus); return }
    const result = await lookupCedula(cedula)
    if (result.status === 'error') return
    enterStore(result.status, result.customer)
  }

  const logoShapeRadius: Record<string, string> = { circle: '50%', rounded: '8px', square: '0px' }

  function renderLogoMorphOverlay() {
    if (!logoMorphStart || !store.logo_url) return null
    const rect = logoMorphFlying && logoMorphEnd ? logoMorphEnd : logoMorphStart
    return (
      <img
        src={store.logo_url}
        alt=""
        className={`sf-logo-morph${logoMorphFlying ? ' flying' : ''}`}
        style={{
          top: rect.top, left: rect.left, width: rect.width, height: rect.height,
          borderRadius: logoMorphFlying ? (logoShapeRadius[cfgLogoShape] ?? '8px') : '20px',
        }}
        onTransitionEnd={() => {
          if (logoMorphFlying) { setLogoMorphStart(null); setLogoMorphEnd(null); setLogoMorphFlying(false) }
        }}
      />
    )
  }

  if (view === 'splash') {
    const splashPoweredColors = poweredByColors(!hp.imageUrl && isLightColor(hp.bgColor || '#0F172A'))
    return (
      <>
      {renderLogoMorphOverlay()}
      <div
        className={`sf-splash-screen sf-trans-${transitionId}${splashLeaving ? ' sf-splash-leaving' : ''}`}
        style={{
          ...pageStyle,
          background: hp.imageUrl
            ? `linear-gradient(rgba(15,23,42,0.25), rgba(15,23,42,0.55)), url(${hp.imageUrl}) center/cover no-repeat`
            : (hp.bgColor || '#0F172A'),
        }}
      >
        {hp.images && hp.images.length > 0 && (
          <div className="sf-splash-images-layer">
            {hp.images.map(img => (
              <img
                key={img.id} src={img.url} alt=""
                className="sf-splash-photo"
                style={{
                  left: img.x, top: img.y, width: img.width, height: img.height,
                  transform: img.flipped ? 'scaleX(-1)' : undefined,
                }}
              />
            ))}
          </div>
        )}
        <div className="sf-splash-content">
          {store.logo_url && hp.showLogo !== false && (
            <img
              ref={splashLogoRef} src={store.logo_url} alt={store.name}
              className={`sf-splash-logo${logoMorphStart ? ' sf-splash-logo-hidden' : ''}`}
              style={hp.elementSizes?.logo ? { width: hp.elementSizes.logo, height: hp.elementSizes.logo } : undefined}
            />
          )}
          <h1 className="sf-splash-title" style={hp.elementSizes?.title ? { fontSize: hp.elementSizes.title } : undefined}>{hp.title || store.name}</h1>
          {hp.subtitle && <p className="sf-splash-sub" style={hp.elementSizes?.subtitle ? { fontSize: hp.elementSizes.subtitle } : undefined}>{hp.subtitle}</p>}

          {collectCustomerData && (
            <div
              className={`sf-splash-cedula-wrap sf-splash-shape-${hp.inputShape || 'pill'}`}
              style={{
                '--sf-splash-input-color': hp.inputTextColor || '#FFFFFF',
                '--sf-splash-input-bg': hp.inputBgColor || '#FFFFFF',
                '--sf-splash-input-size': `${hp.elementSizes?.fields || 14}px`,
              } as React.CSSProperties}
            >
              {keypadRevealed && (
                <div className="sf-splash-cedula-field">
                  <input
                    className="sf-splash-cedula"
                    type="text"
                    inputMode="none"
                    readOnly
                    placeholder="Tu cedula de identidad"
                    value={customerCedula}
                  />
                  {cedulaStatus === 'new' && (
                    <button
                      type="button"
                      className="sf-splash-cedula-edit"
                      onClick={() => setCedulaStatus('idle')}
                      aria-label="Editar cedula"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              {!keypadRevealed ? (
                <div
                  ref={cedulaSlideBarRef}
                  className={`sf-splash-slide-bar${cedulaSliding ? ' sliding' : ' sf-splash-slide-hint'}`}
                  style={{
                    '--sf-slide-progress': cedulaSlideProgress,
                    ...(hp.buttonColor ? { background: hp.buttonColor } : {}),
                  } as React.CSSProperties}
                  onPointerDown={cedulaSlidePointerDown}
                  onPointerMove={cedulaSlidePointerMove}
                  onPointerUp={cedulaSlidePointerUp}
                  onPointerCancel={cedulaSlidePointerUp}
                >
                  <div className="sf-splash-slide-fill" />
                  <span className="sf-splash-slide-label">Desliza para ingresar tu cedula</span>
                  <div className="sf-splash-slide-thumb">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                      <path d="M7 4l6 6-6 6" />
                    </svg>
                  </div>
                </div>
              ) : cedulaStatus !== 'new' && (
                <div className="sf-splash-keypad sf-splash-keypad-in">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                    <button key={d} type="button" className="sf-splash-keypad-btn" onClick={() => pressCedulaDigit(d)}>{d}</button>
                  ))}
                  <div className="sf-splash-keypad-spacer" />
                  <button type="button" className="sf-splash-keypad-btn" onClick={() => pressCedulaDigit('0')}>0</button>
                  <button
                    type="button"
                    className="sf-splash-keypad-btn sf-splash-keypad-back"
                    onClick={pressCedulaBackspace}
                    disabled={!customerCedula}
                    aria-label="Borrar"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                      <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                      <path d="M15 9l-4 6M11 9l4 6" />
                    </svg>
                  </button>
                </div>
              )}
              {cedulaStatus === 'found' && <div className="sf-splash-cedula-hint found">Te reconocimos{customerName ? `, ${customerName.split(' ')[0]}` : ''}</div>}
              {cedulaStatus === 'new' && <div className="sf-splash-cedula-hint">Eres nuevo por aqui, completa tus datos</div>}

              {cedulaStatus === 'new' && customerFields.name && (
                <input
                  className="sf-splash-cedula" type="text" placeholder="Tu nombre completo"
                  style={{ marginTop: 10 }}
                  value={customerName} onChange={e => setCustomerName(e.target.value)}
                />
              )}
              {cedulaStatus === 'new' && customerFields.phone && (
                <input
                  className="sf-splash-cedula" type="tel" placeholder="Tu telefono"
                  style={{ marginTop: 10 }}
                  value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                />
              )}
              {cedulaStatus === 'new' && customerFields.address && (
                <>
                  {locationState !== 'granted' && (
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="sf-splash-cedula sf-splash-location-btn"
                      style={{ marginTop: 10 }}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      {locationState === 'requesting' ? 'Obteniendo ubicacion...' : 'Compartir mi ubicacion'}
                    </button>
                  )}
                  {locationState === 'granted' && (
                    <>
                      <div className="sf-splash-cedula-hint found">Ubicacion compartida</div>
                      <input
                        className="sf-splash-cedula" type="text" placeholder="Nombra esta ubicacion (Casa, Trabajo...)"
                        style={{ marginTop: 10 }}
                        value={locationLabel} onChange={e => setLocationLabel(e.target.value)}
                      />
                    </>
                  )}
                  <input
                    className="sf-splash-cedula" type="text" placeholder="Tu direccion"
                    style={{ marginTop: 10 }}
                    value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                  />
                </>
              )}
              {splashError && <div className="sf-splash-cedula-hint error">{splashError}</div>}
            </div>
          )}

          {(!collectCustomerData || keypadRevealed) && (
            <button
              className={`sf-splash-btn${collectCustomerData ? ' sf-splash-btn-in' : ''}`}
              style={hp.buttonColor ? { background: hp.buttonColor } : undefined}
              disabled={cedulaStatus === 'checking'}
              onClick={handleSplashStart}
            >
              <span>{cedulaStatus === 'checking' ? 'Buscando...' : (hp.buttonLabel || 'Empezar')}</span>
              {cedulaStatus !== 'checking' && (
                <svg className="sf-splash-btn-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M4 10h12M12 5l5 5-5 5" />
                </svg>
              )}
            </button>
          )}

          {(hp.pills ?? []).filter(p => p.label?.trim() && p.url?.trim()).length > 0 && (
            <div className="sf-splash-pills">
              {(hp.pills ?? []).filter(p => p.label?.trim() && p.url?.trim()).map(pill => (
                <a
                  key={pill.id}
                  href={pill.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sf-splash-pill"
                  style={{ borderColor: pill.color || '#7C3AED' }}
                >
                  {pill.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <a className="sf-powered-by" href="https://lyte-app.com" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: splashPoweredColors.text }}>
          <img src="/logo.png" alt="" />
          <span>Powered by <strong style={{ color: splashPoweredColors.strong }}>LYTE APP</strong></span>
        </a>
      </div>
      </>
    )
  }

  // ── REVEAL (animated name welcome, "reveal" transition only) ──
  if (view === 'reveal') {
    const revealName = customerName.trim().split(' ')[0] || ''
    const revealLetters = revealName.split('').map((char, i) => ({
      char: char === ' ' ? ' ' : char,
      delay: 0.35 + i * 0.045,
    }))
    const revealBaseDelay = 0.35 + revealLetters.length * 0.045
    const rv = hp.reveal ?? {}
    const revealShowSkip = rv.showSkip !== false
    const revealFont = revealFontStack(rv.fontFamily)
    const revealPoweredColors = poweredByColors(isLightColor(rv.bgColor || '#111111'))
    return (
      <div
        className="sf-reveal-screen"
        style={{
          '--sf-reveal-bg': rv.bgColor || '#111111',
          '--sf-reveal-name-color': rv.nameColor || '#FAF9F7',
          '--sf-reveal-accent-color': rv.accentColor || '#A8A196',
          ...(revealFont ? { '--sf-reveal-font': revealFont } : {}),
        } as React.CSSProperties}
      >
        <div className="sf-reveal-content">
          <div className="sf-reveal-greeting">{rv.greeting || 'Bienvenido'}</div>
          {revealLetters.length > 0 && (
            <div className="sf-reveal-letters">
              {revealLetters.map((l, i) => (
                <span key={i} className="sf-reveal-letter" style={{ animationDelay: `${l.delay}s` }}>{l.char}</span>
              ))}
            </div>
          )}
          <div className="sf-reveal-line" style={{ animationDelay: `${revealBaseDelay + 0.15}s` }} />
          {rv.logoInsteadOfText && store.logo_url ? (
            <img
              src={store.logo_url} alt={store.name} className="sf-reveal-logo"
              style={{ animationDelay: `${revealBaseDelay + 0.35}s` }}
            />
          ) : (
            <div className="sf-reveal-sub" style={{ animationDelay: `${revealBaseDelay + 0.35}s` }}>{rv.subtitlePrefix || 'a'} {store.name}</div>
          )}
        </div>
        {revealShowSkip && (
          <button className="sf-reveal-skip" onClick={finishReveal}>{rv.skipLabel || 'Saltar →'}</button>
        )}
        <a className="sf-powered-by" href="https://lyte-app.com" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: revealPoweredColors.text }}>
          <img src="/logo.png" alt="" />
          <span>Powered by <strong style={{ color: revealPoweredColors.strong }}>LYTE APP</strong></span>
        </a>
      </div>
    )
  }

  // ── CONFIRMED ──
  if (view === 'confirmed') return (
    <>
    {installed && <div className="sf-statusbar-strip" />}
    <div className="sf-confirm-screen">
      <div className="sf-confirm-card">
        <div className="sf-confirm-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 32, height: 32 }}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>
        <h1 className="sf-confirm-title">{t('store.confirmed.title')}</h1>
        <p className="sf-confirm-sub">{t('store.confirmed.sub', { id: orderId })}</p>
        {returnCountdown !== null && (
          <div className="sf-confirm-countdown">Volviendo al inicio en {returnCountdown}s</div>
        )}
        {deliveryTrackId && (
          <a
            href={`/delivery/${deliveryTrackId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: '#7C3AED', color: 'white', borderRadius: 12, padding: '13px 20px',
              textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 12,
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Rastrear mi pedido
          </a>
        )}
        {pickupTrackId && (
          <a
            href={`/order/${pickupTrackId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: '#7C3AED', color: 'white', borderRadius: 12, padding: '13px 20px',
              textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 12,
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Rastrear mi pedido
          </a>
        )}
        <button className="sf-confirm-btn" onClick={() => { setView('catalog'); setCustomerName(''); setCustomerPhone(''); setCustomerNotes(''); setSelectedPayment(''); setPaymentFreeText(''); setDeliveryTrackId(''); setPickupTrackId(''); setLocationState('idle') }}>
          {t('store.confirmed.continue')}
        </button>
        <Link href="/" className="sf-confirm-link">{t('store.confirmed.link')}</Link>
      </div>
    </div>
    </>
  )

  // Product modal extra price (for footer price display)
  const modalVariablePrice = modalProduct
    ? Object.entries(modalVars).reduce((sum, [label, values]) => {
        const group = modalProduct!.options?.variables?.find(g => g.label === label)
        return sum + values.reduce((s, value) => {
          const choice = group?.choices.map(normalizeChoice).find(c => c.value === value)
          return s + (choice?.price ?? 0)
        }, 0)
      }, 0)
    : 0

  const modalExtraPrice = modalProduct
    ? (modalProduct.options?.additionals ?? []).filter((_, i) => modalAdditionals.has(i)).reduce((s, a) => s + a.price, 0) + modalVariablePrice
    : 0

  // Required (min > 0) variable groups must have enough picks before "Agregar" is allowed
  const modalVariablesOk = !modalProduct || (modalProduct.options?.variables ?? []).every(g => {
    const { min } = groupMinMax(g)
    return min <= 0 || (modalVars[g.label] ?? []).length >= min
  })

  const modalDisplayImage = modalProduct
    ? (modalProduct.options?.colorVariants?.length && modalColor
        ? (modalProduct.options.colorVariants.find(v => v.label === modalColor)?.imageUrl ?? modalProduct.image_url)
        : modalProduct.image_url)
    : null

  // "Paso a paso": ask one variable/color question at a time instead of
  // dumping every option on screen at once. Additionals/notes/confirm are
  // always the final step, shown once every question has been answered
  // (or skipped) — or immediately, for a product with nothing to ask.
  const modalWizardSteps: ({ kind: 'variable'; group: VariableGroup } | { kind: 'color' })[] = modalProduct
    ? [
        ...(modalProduct.options?.variables ?? [])
          .filter(g => g.choices.length > 0)
          .map(group => ({ kind: 'variable' as const, group })),
        ...(((modalProduct.options?.colorVariants?.length ?? 0) > 0 || (modalProduct.options?.colors?.length ?? 0) > 0)
          ? [{ kind: 'color' as const }]
          : []),
      ]
    : []
  const modalWizardActive = cfgModalWizard && modalStep < modalWizardSteps.length
  const modalWizardStep = modalWizardActive ? modalWizardSteps[modalStep] : null
  const wizardVarMinMax = modalWizardStep?.kind === 'variable' ? groupMinMax(modalWizardStep.group) : { min: 0, max: 1 }
  const wizardVarCount = modalWizardStep?.kind === 'variable' ? (modalVars[modalWizardStep.group.label] ?? []).length : 0
  const wizardVarSatisfied = wizardVarCount >= wizardVarMinMax.min

  function advanceModalWizard() {
    setTimeout(() => setModalStep(s => s + 1), 220)
  }

  // ── CHECKOUT ──
  if (view === 'checkout') return (
    <>
    {installed && <div className="sf-statusbar-strip" />}
    <div className={`sf-page sf-tpl-${store.template ?? 'clasico'} sf-fsize-${cfgFontSize} sf-align-${cfgTextAlign} sf-pshape-${cfgPhotoShape} sf-prsize-${cfgPriceSize} sf-imgsize-${cfgPhotoSize} sf-vshape-${cfgVariantShape} sf-eshape-${cfgExtraShape}`} style={pageStyle}>
      {showMapPicker && mapboxToken && (
        <LocationMapPicker
          initialLat={customerLat ?? 10.4806}
          initialLng={customerLng ?? -66.9036}
          mapboxToken={mapboxToken}
          onConfirm={(lat, lng) => {
            setCustomerLat(lat)
            setCustomerLng(lng)
            setLocationState('granted')
            setShowMapPicker(false)
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
      <nav className="sf-nav">
        <div className="sf-nav-inner">
          <button className="sf-nav-back" onClick={() => setView('catalog')}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
            {t('store.back')}
          </button>
          <span className="sf-nav-checkout-title">{t('store.yourOrder')}</span>
          <span />
        </div>
      </nav>

      <div className="sf-checkout-wrap">
        <div className="sf-co-section">
          <div className="sf-co-section-head">
            <h3 className="sf-co-section-title">{t('store.summary')}</h3>
            <button className="sf-co-clear-btn" onClick={clearCart}>Vaciar</button>
          </div>
          {cartItems.map(item => (
            <div key={item.id} className="sf-co-row">
              {item.image_url
                ? (isVideoUrl(item.image_url)
                    ? <video src={item.image_url} autoPlay muted loop playsInline className="sf-co-img" />
                    : <img src={item.image_url} alt={item.name} className="sf-co-img" />)
                : <div className="sf-co-img sf-co-img-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg></div>
              }
              <div className="sf-co-info">
                <div className="sf-co-name">{item.name}</div>
                {/* Selected options summary */}
                {item.selectedOptions && (
                  <div className="sf-co-opts">
                    {item.selectedOptions.variables && Object.entries(item.selectedOptions.variables).map(([k, v]) => (
                      <span key={k} className="sf-co-opt-tag">{k}: {variableValueLabel(v)}</span>
                    ))}
                    {item.selectedOptions.color && <span className="sf-co-opt-tag">{item.selectedOptions.color}</span>}
                    {item.selectedOptions.additionals?.map(a => (
                      <span key={a.name} className="sf-co-opt-tag">+ {a.name}</span>
                    ))}
                    {item.selectedOptions.notes && <span className="sf-co-opt-note">{item.selectedOptions.notes}</span>}
                  </div>
                )}
                <div className="sf-co-price">{currencySymbol}{((item.price + item.extraPrice) * item.quantity).toFixed(2)}</div>
              </div>
              <div className="sf-qty">
                <button onClick={() => updateQty(item.id, -1)}>−</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQty(item.id, +1)}>+</button>
              </div>
            </div>
          ))}
          {deliveryType === 'delivery' && cs.deliveryEnabled && (
            <div className="sf-co-total" style={{ fontWeight: 400, fontSize: 13, color: '#64748B', borderTop: 'none', paddingTop: 0 }}>
              <span>Envio{matchedZone ? ` · ${matchedZone.name}` : ''}</span>
              <span>{deliveryFeeAmt > 0 ? `${currencySymbol}${deliveryFeeAmt.toFixed(2)}` : (deliveryZones.length > 0 && customerLat === null ? 'segun zona' : deliveryFeeAmt === 0 && deliveryZones.length > 0 ? 'fuera de zona' : `${currencySymbol}0.00`)}</span>
            </div>
          )}
          <div className="sf-co-total">
            <span>{t('store.total')}</span>
            <span className="sf-co-total-amt">{currencySymbol}{orderTotal.toFixed(2)}</span>
          </div>
          {bcvRate && (
            <div className="sf-co-total" style={{ borderTop: 'none', paddingTop: 0, fontSize: 13, color: '#64748B', fontWeight: 400 }}>
              <span>Total Bs (BCV)</span>
              <span>Bs {(orderTotal * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {/* Delivery type selector */}
        {bothTypes && (
          <div className="sf-co-section">
            <h3 className="sf-co-section-title">Tipo de entrega</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: deliveryType === 'delivery' ? '#EDE9FE' : '#F8FAFC',
                  outline: `2px solid ${deliveryType === 'delivery' ? '#7C3AED' : '#E2E8F0'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <svg viewBox="0 0 24 24" fill={deliveryType === 'delivery' ? '#7C3AED' : '#94A3B8'} width="20" height="20">
                  <path fillRule="evenodd" d="M5 12a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM17 12a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
                  <path d="M8 15l3.5-6h4l1.5-2.5H20V9l-1.5 3H9.5z"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: deliveryType === 'delivery' ? 700 : 500, color: deliveryType === 'delivery' ? '#7C3AED' : '#64748B' }}>Domicilio</span>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: deliveryType === 'pickup' ? '#EDE9FE' : '#F8FAFC',
                  outline: `2px solid ${deliveryType === 'pickup' ? '#7C3AED' : '#E2E8F0'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <svg viewBox="0 0 20 20" fill={deliveryType === 'pickup' ? '#7C3AED' : '#94A3B8'} width="20" height="20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 4H2v7a2 2 0 002 2h12a2 2 0 002-2V8zm-8 3a1 1 0 011 1v2a1 1 0 01-2 0v-2a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: deliveryType === 'pickup' ? 700 : 500, color: deliveryType === 'pickup' ? '#7C3AED' : '#64748B' }}>Retiro en tienda</span>
              </button>
            </div>
          </div>
        )}

        {/* Ubicacion de entrega — solo para domicilio */}
        {deliveryType === 'delivery' && (
          <div className="sf-co-section">
            <h3 className="sf-co-section-title">
              Ubicacion de entrega <span style={{ color: '#EF4444' }}>*</span>
            </h3>

            {/* Saved locations */}
            {savedLocations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: showLocForm ? 12 : 0 }}>
                {savedLocations.map(loc => (
                  <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocId(loc.id)
                        setCustomerAddress(loc.address)
                        setCustomerLat(loc.lat)
                        setCustomerLng(loc.lng)
                        setShowNewLoc(false)
                        setLocationState('idle')
                        setShowSavePrompt(false)
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 14px', borderRadius: 12, border: 'none',
                        cursor: 'pointer', textAlign: 'left' as const,
                        background: selectedLocId === loc.id ? '#EDE9FE' : '#F8FAFC',
                        outline: `2px solid ${selectedLocId === loc.id ? '#7C3AED' : '#E2E8F0'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <svg viewBox="0 0 20 20" fill={selectedLocId === loc.id ? '#7C3AED' : '#94A3B8'} width="14" height="14" style={{ flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: selectedLocId === loc.id ? '#7C3AED' : '#0F172A', lineHeight: 1.2 }}>{loc.label}</div>
                        {loc.address && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{loc.address}</div>}
                      </div>
                      {selectedLocId === loc.id && (
                        <svg viewBox="0 0 20 20" fill="#7C3AED" width="14" height="14" style={{ flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const locKey = collectCustomerData && customerCedula.trim() ? `cedula-${customerCedula.trim()}` : customerPhone.replace(/\D/g, '')
                        const updated = savedLocations.filter(l => l.id !== loc.id)
                        try { localStorage.setItem(`lyte-locs-${locKey}`, JSON.stringify(updated)) } catch {}
                        setSavedLocations(updated)
                        if (selectedLocId === loc.id) {
                          setSelectedLocId(null)
                          setCustomerAddress('')
                          setCustomerLat(null)
                          setCustomerLng(null)
                          setShowNewLoc(updated.length === 0)
                        }
                      }}
                      style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#FEE2E2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <svg viewBox="0 0 20 20" fill="#EF4444" width="12" height="12">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}

                {!showNewLoc && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocId(null)
                      setShowNewLoc(true)
                      setCustomerLat(null)
                      setCustomerLng(null)
                      setCustomerAddress('')
                      setLocationState('idle')
                      setShowSavePrompt(false)
                      setNewLocLabel('')
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: '2px dashed #D1D5DB', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#64748B', width: '100%' }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Nueva ubicacion
                  </button>
                )}
              </div>
            )}

            {/* Form: GPS + address input */}
            {showLocForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {locationState === 'idle' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button type="button" onClick={requestLocation} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#7C3AED', color: 'white', border: 'none', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      Compartir mi ubicacion
                    </button>
                    {mapboxToken && (
                      <button type="button" onClick={() => setShowMapPicker(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#F1F0FF', color: '#6D28D9', border: '1px solid #DDD6FE', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
                        </svg>
                        Marcar en mapa
                      </button>
                    )}
                  </div>
                )}
                {locationState === 'requesting' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: '#F8FAFC', borderRadius: 10, fontSize: 13, color: '#64748B' }}>
                    <div style={{ width: 14, height: 14, border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    Obteniendo ubicacion...
                  </div>
                )}
                {locationState === 'granted' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#065F46', fontWeight: 500 }}>
                    <svg viewBox="0 0 20 20" fill="#10B981" width="14" height="14" style={{ flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    <span style={{ flex: 1 }}>Ubicacion seleccionada</span>
                    {mapboxToken && (
                      <button type="button" onClick={() => setShowMapPicker(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#059669', padding: 0 }}>
                        Cambiar
                      </button>
                    )}
                  </div>
                )}
                {locationState === 'granted' && deliveryZones.length > 0 && (
                  matchedZone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EDE9FE', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#5B21B6', fontWeight: 500 }}>
                      <svg viewBox="0 0 20 20" fill="#7C3AED" width="14" height="14" style={{ flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span>Zona: <strong>{matchedZone.name ?? 'Sin nombre'}</strong> · Envio {currencySymbol}{(matchedZone.fee ?? 0).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF7ED', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
                      <svg viewBox="0 0 20 20" fill="#F59E0B" width="14" height="14" style={{ flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Tu ubicacion esta fuera de las zonas de cobertura
                    </div>
                  )
                )}
                {locationState === 'denied' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#FFF7ED', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg viewBox="0 0 20 20" fill="#F59E0B" width="14" height="14" style={{ flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>Ubicacion bloqueada. Ve a Configuracion &gt; Privacidad &gt; Ubicacion y activa el permiso, luego intenta de nuevo.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={requestLocation} style={{ background: 'none', border: '1px solid #F59E0B', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>
                        Reintentar GPS
                      </button>
                      {mapboxToken && (
                        <button type="button" onClick={() => setShowMapPicker(true)} style={{ background: '#92400E', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer' }}>
                          Marcar en mapa
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="sf-co-field" style={{ marginBottom: 0 }}>
                  <label>Direccion de entrega{locationState === 'granted' ? ' (opcional)' : ''}</label>
                  <input type="text" placeholder="Av. Principal, Edificio X, Apto Y" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                </div>

                {!showSavePrompt && ((collectCustomerData && customerCedula.trim()) || customerPhone.replace(/\D/g, '')) && (customerLat || customerAddress.trim()) && (
                  <button type="button" onClick={() => setShowSavePrompt(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7C3AED', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: 0, alignSelf: 'flex-start' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Guardar ubicacion
                  </button>
                )}
                {showSavePrompt && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nombre (Casa, Trabajo...)"
                      value={newLocLabel}
                      onChange={e => setNewLocLabel(e.target.value)}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const locKey = collectCustomerData && customerCedula.trim() ? `cedula-${customerCedula.trim()}` : customerPhone.replace(/\D/g, '')
                        if (!locKey) return
                        const loc: SavedLocation = {
                          id: crypto.randomUUID(),
                          label: newLocLabel.trim() || customerAddress.trim() || 'Mi ubicacion',
                          address: customerAddress,
                          lat: customerLat,
                          lng: customerLng,
                        }
                        const updated = [...savedLocations, loc]
                        try { localStorage.setItem(`lyte-locs-${locKey}`, JSON.stringify(updated)) } catch {}
                        setSavedLocations(updated)
                        setSelectedLocId(loc.id)
                        setShowNewLoc(false)
                        setShowSavePrompt(false)
                        setNewLocLabel('')
                      }}
                      style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0 }}
                    >
                      Guardar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="sf-co-section">
          <h3 className="sf-co-section-title">{t('store.yourInfo')}</h3>
          <div className="sf-co-field">
            <label>{t('store.fullName')}</label>
            <input type="text" placeholder={t('store.namePlaceholder')} value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="sf-co-field">
            <label>{t('store.phone')}</label>
            <input type="tel" placeholder={t('store.phonePlaceholder')} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          </div>
          <div className="sf-co-field">
            <label>{t('store.notes')} <span className="sf-optional">{t('store.optional')}</span></label>
            <textarea placeholder={t('store.notesPlaceholder')} rows={2} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />
          </div>
        </div>

        <div className="sf-co-section">
          <h3 className="sf-co-section-title">{t('store.paymentMethod')}{requirePaymentMethod && <span className="sf-required"> *</span>}</h3>
          {enabledMethods.length > 0 ? (
            <div className="sf-payment-list">
              {enabledMethods.map(m => {
                const isSelected = selectedPayment === m.type
                const isVES      = VES_METHODS.has(m.type)
                return (
                  <div key={m.type} className={`sf-payment-opt${isSelected ? ' selected' : ''}`} onClick={() => setSelectedPayment(m.type)}>
                    <div className="sf-payment-opt-top">
                      <div className={`sf-payment-radio${isSelected ? ' on' : ''}`} />
                      <span className="sf-payment-label">{m.label}</span>
                    </div>
                    {isSelected && Object.keys(m.details ?? {}).length > 0 && (
                      <div className="sf-payment-info">
                        {Object.entries(m.details).map(([k, v]) => (
                          <div key={k} className="sf-payment-detail-row"><span>{k}</span><strong>{v as string}</strong></div>
                        ))}
                      </div>
                    )}
                    {isSelected && (
                      <div className="sf-proof-upload" onClick={e => e.stopPropagation()}>
                        <div className="sf-proof-total">
                          <span>Total a pagar</span>
                          {isVES && vesAmount ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <strong style={{ fontSize: '1.2em' }}>Bs {vesAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                              <span style={{ fontSize: 12, color: '#6B7280' }}>{currencySymbol}{orderTotal.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div>
                              <strong>{currencySymbol}{orderTotal.toFixed(2)}</strong>
                              {vesAmount && (
                                <span className="sf-proof-total-bs">
                                  {' · '}Bs {vesAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <label className="sf-proof-label" htmlFor="sf-proof-input">
                          Comprobante de pago{requirePaymentProof ? <span className="sf-required"> *</span> : <span className="sf-optional"> (opcional)</span>}
                        </label>
                        <input
                          id="sf-proof-input"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            handleProofFile(f)
                          }}
                        />
                        {paymentProofPreview ? (
                          <div className="sf-proof-preview-wrap">
                            <img src={paymentProofPreview} alt="Comprobante" className="sf-proof-preview" />
                            <button
                              type="button"
                              className="sf-proof-remove"
                              onClick={() => { setPaymentProofFile(null); setPaymentProofPreview(null) }}
                            >
                              Quitar foto
                            </button>
                          </div>
                        ) : (
                          <label htmlFor="sf-proof-input" className="sf-proof-drop">
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v1.25A1.25 1.25 0 004.25 19h11.5A1.25 1.25 0 0017 17.75V16.5M10 3v10m0 0l-3-3m3 3l3-3" />
                            </svg>
                            <span>Subir foto del pago</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="sf-co-field">
              <label>{t('store.howPay')}</label>
              <input type="text" placeholder={t('store.howPayPlaceholder')} value={paymentFreeText} onChange={e => setPaymentFreeText(e.target.value)} />
            </div>
          )}

          {paymentFreeText && (
            <div className="sf-proof-upload">
              <div className="sf-proof-total">
                <span>Total a pagar</span>
                <div><strong>{currencySymbol}{orderTotal.toFixed(2)}</strong></div>
              </div>
              <label className="sf-proof-label" htmlFor="sf-proof-input">
                Comprobante de pago{requirePaymentProof ? <span className="sf-required"> *</span> : <span className="sf-optional"> (opcional)</span>}
              </label>
              <input
                id="sf-proof-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  handleProofFile(f)
                }}
              />
              {paymentProofPreview ? (
                <div className="sf-proof-preview-wrap">
                  <img src={paymentProofPreview} alt="Comprobante" className="sf-proof-preview" />
                  <button
                    type="button"
                    className="sf-proof-remove"
                    onClick={() => { setPaymentProofFile(null); setPaymentProofPreview(null) }}
                  >
                    Quitar foto
                  </button>
                </div>
              ) : (
                <label htmlFor="sf-proof-input" className="sf-proof-drop">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v1.25A1.25 1.25 0 004.25 19h11.5A1.25 1.25 0 0017 17.75V16.5M10 3v10m0 0l-3-3m3 3l3-3" />
                  </svg>
                  <span>Subir foto del pago</span>
                </label>
              )}
            </div>
          )}
        </div>

        {error && <div className="sf-co-error">{error}</div>}
        <button className="sf-submit-btn" onClick={handleSubmit} disabled={submitting || cartItems.length === 0 || (deliveryType === 'delivery' && deliveryZones.length > 0 && customerLat !== null && matchedZone === null)}>
          {submitting ? t('store.sending') : `${t('store.confirmOrder')} · ${currencySymbol}${orderTotal.toFixed(2)}`}
        </button>
      </div>

      {/* Modal inside checkout too */}
      {renderProductModal()}

      {lightbox && (
        <div className="sf-lightbox" onClick={() => setLightbox(null)}>
          <button className="sf-lightbox-close" onClick={() => setLightbox(null)}>×</button>
          <div
            className="sf-lightbox-viewport"
            onTouchStart={lightbox.images.length > 1 ? e => {
              touchStartX.current = e.touches[0].clientX
              swipedRef.current = false
              lightboxDragStartIdxRef.current = lightbox.idx
              if (lightboxStripRef.current) lightboxStripRef.current.classList.add('dragging')
            } : undefined}
            onTouchMove={lightbox.images.length > 1 ? e => {
              const dx = e.touches[0].clientX - touchStartX.current
              if (Math.abs(dx) > 5) {
                e.stopPropagation()
                const strip = lightboxStripRef.current
                if (strip) {
                  const n = lightbox.images.length
                  const fw = strip.offsetWidth / n
                  const pct = (Math.max(0, Math.min((n - 1) * fw, lightboxDragStartIdxRef.current * fw - dx)) / (n * fw)) * 100
                  strip.style.transform = `translateX(-${pct}%)`
                }
              }
            } : undefined}
            onTouchEnd={lightbox.images.length > 1 ? e => {
              const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
              if (lightboxStripRef.current) lightboxStripRef.current.classList.remove('dragging')
              if (Math.abs(dx) > 40) {
                swipedRef.current = true
                const next = dx < 0 ? Math.min(lightbox.images.length - 1, lightboxDragStartIdxRef.current + 1) : Math.max(0, lightboxDragStartIdxRef.current - 1)
                setLightbox(lb => lb ? { ...lb, idx: next } : null)
              } else {
                setLightbox(lb => lb ? { ...lb, idx: lightboxDragStartIdxRef.current } : null)
              }
            } : undefined}
            onClick={e => e.stopPropagation()}
          >
            <div className="sf-lightbox-strip" ref={lightboxStripRef} style={{ width: `${lightbox.images.length * 100}%`, transform: `translateX(-${lightbox.idx * (100 / lightbox.images.length)}%)` }}>
              {lightbox.images.map((img, i) => (
                <div key={i} className="sf-lightbox-frame" style={{ width: `${100 / lightbox.images.length}%` }}>
                  {isVideoUrl(img)
                    ? <video src={img} autoPlay muted loop playsInline className="sf-lightbox-img" />
                    : <img src={img} alt="" className="sf-lightbox-img" />}
                </div>
              ))}
            </div>
          </div>
          {lightbox.images.length > 1 && (
            <div className="sf-lightbox-dots">
              {lightbox.images.map((_, i) => (
                <div key={i} className={`sf-slide-dot${lightbox.idx === i ? ' on' : ''}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Floating WhatsApp button ── */}
      {store.whatsapp && cs.whatsappFloating && (
        <a
          href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="sf-wa-float"
          aria-label="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="sf-wa-float-label">&iquest;Tienes alguna duda?</span>
        </a>
      )}
    </div>
    </>
  )

  // ── CATALOG ──
  const tpl = store.template ?? 'clasico'

  // Category grouping
  const catGroups = categories
    .map(cat => ({ cat, items: products.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0)
  const uncategorized = products.filter(p => !p.category_id || !categories.find(c => c.id === p.category_id))
  const hasCats = catGroups.length > 0
  const catNavEl = hasCats && tpl !== 'catalogo' && cfg.showCatNav !== false ? (
    <nav className={`sf-cat-nav sf-cat-nav-${cfgCatNavStyle}${cfgStickyCatNav ? '' : ' sf-cat-nav-nosticky'}${cfgCatNavOverBanner ? ' sf-cat-nav-glass' : ''}`}>
      {catGroups.map(({ cat }) => (
        <button
          key={cat.id}
          className={`sf-cat-btn${activeCatId === cat.id ? ' sf-cat-active' : ''}`}
          onClick={() => {
            setActiveCatId(cat.id)
            document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          {cat.name}
        </button>
      ))}
      {uncategorized.length > 0 && (
        <button
          className={`sf-cat-btn${activeCatId === '__other' ? ' sf-cat-active' : ''}`}
          onClick={() => {
            setActiveCatId('__other')
            document.getElementById('cat-other')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          {t('store.ourProducts')}
        </button>
      )}
    </nav>
  ) : null
  const escFeatured = products.slice(0, 2)
  const escRest     = products.slice(2)
  const vitHero     = products.length > 0 ? products[0] : null
  const vitRest     = products.slice(1)
  // Filtering keys off having a search query at all, not the template — the
  // catalogo template's own bar and the header search icon (any template)
  // both just write into the same searchQuery state.
  const catFiltered = searchQuery.trim()
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    : products
  const catGroupsFiltered = catGroups.map(({ cat, items }) => ({
    cat,
    items: searchQuery.trim()
      ? items.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
      : items,
  })).filter(g => g.items.length > 0)
  const uncatGroupFiltered = searchQuery.trim()
    ? uncategorized.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    : uncategorized

  const PLACEHOLDER = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  )

  const renderCard = (product: Product) => {
    const qty        = getProdQty(product.id)
    const variants   = product.options?.colorVariants
    const selIdx     = selectedVariants[product.id] ?? (variants?.length ? 0 : undefined)
    const displayImg = variants?.length
      ? (variants[selIdx ?? 0]?.imageUrl || product.image_url)
      : product.image_url
    return (
      <div key={product.id} className="sf-card" onClick={() => openProductModal(product)}>
        <div
          className="sf-card-img-wrap"
          style={{ touchAction: variants?.length ? 'pan-y' : 'auto' }}
          onTouchStart={variants?.length ? e => {
            touchStartX.current = e.touches[0].clientX
            swipedRef.current = false
            dragStartIdxRef.current = selIdx ?? 0
            const strip = stripRefs.current.get(product.id)
            if (strip) strip.classList.add('dragging')
          } : undefined}
          onTouchMove={variants?.length ? e => {
            const dx = e.touches[0].clientX - touchStartX.current
            if (Math.abs(dx) > 5) {
              e.stopPropagation()
              const strip = stripRefs.current.get(product.id)
              if (strip) {
                const n = variants.length
                const fw = strip.offsetWidth / n
                const pct = (Math.max(0, Math.min((n - 1) * fw, dragStartIdxRef.current * fw - dx)) / (n * fw)) * 100
                strip.style.transform = `translateX(-${pct}%)`
              }
            }
          } : undefined}
          onTouchEnd={variants?.length ? e => {
            const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
            const strip = stripRefs.current.get(product.id)
            if (strip) strip.classList.remove('dragging')
            if (Math.abs(dx) > 25) {
              swipedRef.current = true
              const next = dx < 0 ? Math.min(variants.length - 1, dragStartIdxRef.current + 1) : Math.max(0, dragStartIdxRef.current - 1)
              setSelectedVariants(p => ({ ...p, [product.id]: next }))
            } else {
              setSelectedVariants(p => ({ ...p, [product.id]: dragStartIdxRef.current }))
            }
          } : undefined}
          onClick={e => { if (swipedRef.current) { e.stopPropagation(); swipedRef.current = false } }}
        >
          {variants?.length ? (
            <div className="sf-slide-strip"
              ref={el => { if (el) stripRefs.current.set(product.id, el); else stripRefs.current.delete(product.id) }}
              style={{ width: `${variants.length * 100}%`, transform: `translateX(-${(selIdx ?? 0) * (100 / variants.length)}%)` }}>
              {variants.map((v, i) => (
                <div key={i} className="sf-slide-frame" style={{ width: `${100 / variants.length}%` }}>
                  {v.imageUrl
                    ? (isVideoUrl(v.imageUrl)
                        ? <video src={v.imageUrl} autoPlay muted loop playsInline className="sf-card-img" />
                        : <img src={v.imageUrl} alt={product.name} className="sf-card-img" loading="lazy" />)
                    : <div className="sf-card-img-empty">{PLACEHOLDER}</div>}
                </div>
              ))}
            </div>
          ) : displayImg ? (
            isVideoUrl(displayImg)
              ? <video src={displayImg} autoPlay muted loop playsInline className="sf-card-img" />
              : <img src={displayImg} alt={product.name} className="sf-card-img" loading="lazy" />
          ) : (
            <div className="sf-card-img-empty">{PLACEHOLDER}</div>
          )}
          {qty > 0 && <div className="sf-card-badge">{qty}</div>}
          {(variants?.length ?? 0) > 1 && (
            <div className="sf-slide-dots">
              {variants!.map((_, i) => (
                <div key={i} className={`sf-slide-dot${(selIdx ?? 0) === i ? ' on' : ''}`} />
              ))}
            </div>
          )}
        </div>
        <div className="sf-card-body">
          <div className="sf-card-name">{product.name}</div>
          {product.description && <div className="sf-card-desc">{product.description}</div>}
          {variants?.length ? (
            <div className="sf-card-swatches" onClick={e => e.stopPropagation()}>
              {variants.map((v, i) => (
                <button key={i} className={`sf-color-swatch${(selIdx ?? 0) === i ? ' selected' : ''}`}
                  style={{ background: v.color }} title={v.label}
                  onClick={() => setSelectedVariants(p => ({ ...p, [product.id]: i }))} />
              ))}
            </div>
          ) : null}
          <div className="sf-card-footer">
            <div className="sf-card-price">{currencySymbol}{Number(product.price).toFixed(2)}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderEscRow = (product: Product) => {
    const variants   = product.options?.colorVariants
    const selIdx     = selectedVariants[product.id] ?? (variants?.length ? 0 : undefined)
    const displayImg = variants?.length
      ? (variants[selIdx ?? 0]?.imageUrl || product.image_url)
      : product.image_url
    return (
      <div key={product.id} className="sf-esc-row" onClick={() => openProductModal(product)}>
        <div
          className="sf-esc-img-wrap"
          onTouchStart={variants?.length ? e => {
            touchStartX.current = e.touches[0].clientX
            swipedRef.current = false
            dragStartIdxRef.current = selIdx ?? 0
            const strip = stripRefs.current.get(product.id)
            if (strip) strip.classList.add('dragging')
          } : undefined}
          onTouchMove={variants?.length ? e => {
            const dx = e.touches[0].clientX - touchStartX.current
            if (Math.abs(dx) > 5) {
              e.stopPropagation()
              const strip = stripRefs.current.get(product.id)
              if (strip) {
                const n = variants.length
                const fw = strip.offsetWidth / n
                const pct = (Math.max(0, Math.min((n - 1) * fw, dragStartIdxRef.current * fw - dx)) / (n * fw)) * 100
                strip.style.transform = `translateX(-${pct}%)`
              }
            }
          } : undefined}
          onTouchEnd={variants?.length ? e => {
            const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
            const strip = stripRefs.current.get(product.id)
            if (strip) strip.classList.remove('dragging')
            if (Math.abs(dx) > 25) {
              swipedRef.current = true
              const next = dx < 0 ? Math.min(variants.length - 1, dragStartIdxRef.current + 1) : Math.max(0, dragStartIdxRef.current - 1)
              setSelectedVariants(p => ({ ...p, [product.id]: next }))
            } else {
              setSelectedVariants(p => ({ ...p, [product.id]: dragStartIdxRef.current }))
            }
          } : undefined}
          onClick={e => { if (swipedRef.current) { e.stopPropagation(); swipedRef.current = false } }}
        >
          {variants?.length ? (
            <div className="sf-slide-strip"
              ref={el => { if (el) stripRefs.current.set(product.id, el); else stripRefs.current.delete(product.id) }}
              style={{ width: `${variants.length * 100}%`, transform: `translateX(-${(selIdx ?? 0) * (100 / variants.length)}%)` }}>
              {variants.map((v, i) => (
                <div key={i} className="sf-slide-frame" style={{ width: `${100 / variants.length}%` }}>
                  {v.imageUrl
                    ? (isVideoUrl(v.imageUrl)
                        ? <video src={v.imageUrl} autoPlay muted loop playsInline className="sf-esc-img" />
                        : <img src={v.imageUrl} alt={product.name} className="sf-esc-img" loading="lazy" />)
                    : <div className="sf-esc-img sf-esc-img-empty">{PLACEHOLDER}</div>}
                </div>
              ))}
            </div>
          ) : displayImg ? (
            isVideoUrl(displayImg)
              ? <video src={displayImg} autoPlay muted loop playsInline className="sf-esc-img" />
              : <img src={displayImg} alt={product.name} className="sf-esc-img" loading="lazy" />
          ) : (
            <div className="sf-esc-img sf-esc-img-empty">{PLACEHOLDER}</div>
          )}
          {getProdQty(product.id) > 0 && <div className="sf-card-badge">{getProdQty(product.id)}</div>}
          {(variants?.length ?? 0) > 1 && (
            <div className="sf-slide-dots">
              {variants!.map((_, i) => (
                <div key={i} className={`sf-slide-dot${(selIdx ?? 0) === i ? ' on' : ''}`} />
              ))}
            </div>
          )}
        </div>
        <div className="sf-esc-info">
          <div className="sf-esc-name">{product.name}</div>
          {variants?.length ? (
            <div className="sf-esc-swatches" onClick={e => e.stopPropagation()}>
              {variants.map((v, i) => (
                <button key={i} className={`sf-color-swatch${(selIdx ?? 0) === i ? ' selected' : ''}`}
                  style={{ background: v.color }} title={v.label}
                  onClick={() => setSelectedVariants(p => ({ ...p, [product.id]: i }))} />
              ))}
            </div>
          ) : null}
          <div className="sf-esc-price">{currencySymbol}{Number(product.price).toFixed(2)}</div>
        </div>
      </div>
    )
  }

  const renderCatRow = (product: Product) => {
    const variants   = product.options?.colorVariants
    const selIdx     = selectedVariants[product.id] ?? (variants?.length ? 0 : undefined)
    const displayImg = variants?.length
      ? (variants[selIdx ?? 0]?.imageUrl || product.image_url)
      : product.image_url
    return (
      <div key={product.id} className="sf-cat-card" onClick={() => openProductModal(product)}>
        <div
          className="sf-cat-img-wrap"
          onTouchStart={variants?.length ? e => {
            touchStartX.current = e.touches[0].clientX
            swipedRef.current = false
            dragStartIdxRef.current = selIdx ?? 0
            const strip = stripRefs.current.get(product.id)
            if (strip) strip.classList.add('dragging')
          } : undefined}
          onTouchMove={variants?.length ? e => {
            const dx = e.touches[0].clientX - touchStartX.current
            if (Math.abs(dx) > 5) {
              e.stopPropagation()
              const strip = stripRefs.current.get(product.id)
              if (strip) {
                const n = variants.length
                const fw = strip.offsetWidth / n
                const pct = (Math.max(0, Math.min((n - 1) * fw, dragStartIdxRef.current * fw - dx)) / (n * fw)) * 100
                strip.style.transform = `translateX(-${pct}%)`
              }
            }
          } : undefined}
          onTouchEnd={variants?.length ? e => {
            const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
            const strip = stripRefs.current.get(product.id)
            if (strip) strip.classList.remove('dragging')
            if (Math.abs(dx) > 25) {
              swipedRef.current = true
              const next = dx < 0 ? Math.min(variants.length - 1, dragStartIdxRef.current + 1) : Math.max(0, dragStartIdxRef.current - 1)
              setSelectedVariants(p => ({ ...p, [product.id]: next }))
            } else {
              setSelectedVariants(p => ({ ...p, [product.id]: dragStartIdxRef.current }))
            }
          } : undefined}
          onClick={e => { if (swipedRef.current) { e.stopPropagation(); swipedRef.current = false } }}
        >
          {variants?.length ? (
            <div className="sf-slide-strip"
              ref={el => { if (el) stripRefs.current.set(product.id, el); else stripRefs.current.delete(product.id) }}
              style={{ width: `${variants.length * 100}%`, transform: `translateX(-${(selIdx ?? 0) * (100 / variants.length)}%)` }}>
              {variants.map((v, i) => (
                <div key={i} className="sf-slide-frame" style={{ width: `${100 / variants.length}%` }}>
                  {v.imageUrl
                    ? (isVideoUrl(v.imageUrl)
                        ? <video src={v.imageUrl} autoPlay muted loop playsInline className="sf-cat-img" />
                        : <img src={v.imageUrl} alt={product.name} className="sf-cat-img" loading="lazy" />)
                    : <div className="sf-cat-img sf-cat-img-empty">{PLACEHOLDER}</div>}
                </div>
              ))}
            </div>
          ) : displayImg ? (
            isVideoUrl(displayImg)
              ? <video src={displayImg} autoPlay muted loop playsInline className="sf-cat-img" />
              : <img src={displayImg} alt={product.name} className="sf-cat-img" loading="lazy" />
          ) : (
            <div className="sf-cat-img sf-cat-img-empty">{PLACEHOLDER}</div>
          )}
          {getProdQty(product.id) > 0 && <div className="sf-card-badge">{getProdQty(product.id)}</div>}
          {(variants?.length ?? 0) > 1 && (
            <div className="sf-slide-dots">
              {variants!.map((_, i) => (
                <div key={i} className={`sf-slide-dot${(selIdx ?? 0) === i ? ' on' : ''}`} />
              ))}
            </div>
          )}
        </div>
        <div className="sf-cat-info">
          <div className="sf-cat-name">{product.name}</div>
          {product.description && <div className="sf-cat-desc">{product.description}</div>}
          {variants?.length ? (
            <div className="sf-cat-swatches" onClick={e => e.stopPropagation()}>
              {variants.map((v, i) => (
                <button key={i} className={`sf-color-swatch${(selIdx ?? 0) === i ? ' selected' : ''}`}
                  style={{ background: v.color }} title={v.label}
                  onClick={() => setSelectedVariants(p => ({ ...p, [product.id]: i }))} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="sf-cat-action">
          <div className="sf-cat-price">{currencySymbol}{Number(product.price).toFixed(2)}</div>
        </div>
      </div>
    )
  }

  return (
    <>
    {renderLogoMorphOverlay()}
    {installed && <div className="sf-statusbar-strip" />}
    <div className={`sf-page sf-tpl-${tpl} sf-fsize-${cfgFontSize} sf-align-${cfgTextAlign} sf-pshape-${cfgPhotoShape} sf-prsize-${cfgPriceSize} sf-imgsize-${cfgPhotoSize} sf-vshape-${cfgVariantShape} sf-eshape-${cfgExtraShape}${catalogEnter ? ` sf-catalog-enter sf-trans-${store.template_config?.homePage?.transition || 'slide'}` : ''}`} style={pageStyle}>
      <div className={`sf-topbar${cfgHeaderOverBanner ? ' sf-topbar-glass' : ''}${cfgHeaderSticky && !cfgHeaderOverBanner ? ' sf-topbar-sticky' : ''}${cfgHeaderSticky && cfgHeaderOverBanner ? ' sf-topbar-pinned' : ''}`}>
        <div className="sf-topbar-inner sf-topbar-3col">
          <div className="sf-topbar-slot-left">
            {cfg.showMenuButton && (
              <button className="sf-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {cfgLogoPosition === 'left' && store.logo_url && (
              <div ref={catalogLogoRef} className={`sf-nav-logo-wrap sf-nav-logo-${cfgLogoShape}${logoMorphStart ? ' sf-nav-logo-hidden' : ''}`} style={{ height: cfgLogoSizePx }}>
                <img src={store.logo_url} alt={store.name} className="sf-nav-logo-img" />
              </div>
            )}
            {cfgNamePosition === 'left' && (
              <span className="sf-nav-name">{store.name}</span>
            )}
          </div>
          <div className="sf-topbar-slot-center">
            {cfgLogoPosition === 'center' && store.logo_url && (
              <div ref={catalogLogoRef} className={`sf-nav-logo-wrap sf-nav-logo-${cfgLogoShape}${logoMorphStart ? ' sf-nav-logo-hidden' : ''}`} style={{ height: cfgLogoSizePx }}>
                <img src={store.logo_url} alt={store.name} className="sf-nav-logo-img" />
              </div>
            )}
            {cfgNamePosition === 'center' && (
              <span className="sf-nav-name">{store.name}</span>
            )}
          </div>
          <div className="sf-topbar-slot-right">
            {cfgLogoPosition === 'right' && store.logo_url && (
              <div ref={catalogLogoRef} className={`sf-nav-logo-wrap sf-nav-logo-${cfgLogoShape}${logoMorphStart ? ' sf-nav-logo-hidden' : ''}`} style={{ height: cfgLogoSizePx }}>
                <img src={store.logo_url} alt={store.name} className="sf-nav-logo-img" />
              </div>
            )}
            {cfgNamePosition === 'right' && (
              <span className="sf-nav-name">{store.name}</span>
            )}
            {store.whatsapp && cfg.showWhatsapp !== false && (
              <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="sf-nav-wa">
                {WA_ICON} {t('store.contact')}
              </a>
            )}
            {cfg.showHeaderSearch && (
              <button className="sf-header-icon-btn" onClick={() => setHeaderSearchOpen(o => !o)} aria-label="Buscar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </button>
            )}
            {cfg.showHeaderCart && (
              <button className="sf-header-icon-btn" onClick={() => setView('checkout')} aria-label="Carrito">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                {cartCount > 0 && <span className="sf-header-icon-badge">{cartCount}</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {showReorder && lastOrder && (
        <div className="sf-reorder-banner">
          <div className="sf-reorder-info">
            <div className="sf-reorder-title">¿Pedimos lo mismo que la ultima vez?</div>
            <div className="sf-reorder-sub">
              {lastOrder.items.reduce((s, i) => s + i.quantity, 0)} {lastOrder.items.reduce((s, i) => s + i.quantity, 0) === 1 ? 'producto' : 'productos'}
            </div>
          </div>
          <div className="sf-reorder-actions">
            <button type="button" className="sf-reorder-btn" onClick={reorderLast}>Repetir pedido</button>
            <button type="button" className="sf-reorder-close" onClick={() => setShowReorder(false)} aria-label="Cerrar">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path strokeLinecap="round" d="M15 5L5 15M5 5l10 10"/></svg>
            </button>
          </div>
        </div>
      )}

      {focusCategory ? (
        <div className="sf-focus-category">
          <button className="sf-focus-back" onClick={() => setFocusCategory(null)}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M12 15l-5-5 5-5" /></svg>
            Volver
          </button>
          <h2 className="sf-section-title">{focusCategory.name}</h2>
          <div className="sf-grid">
            {products.filter(p => p.category_id === focusCategory.id).map(renderCard)}
          </div>
        </div>
      ) : (
      <>
      {store.banner_url && tpl !== 'vitrina' && tpl !== 'catalogo' && (
        <div className="sf-banner-wrap">
          <div className="sf-banner"><img src={store.banner_url} alt="Banner" className="sf-banner-img" /></div>
        </div>
      )}
      {cfgCatNavOverBanner && catNavEl}

      {(store.description || (store.instagram && cfg.showInstagram !== false)) && (
        <div className="sf-header">
          <div className="sf-header-inner sf-header-inner-compact">
            <div className="sf-header-info">
              {store.description && <p className="sf-store-desc">{store.description}</p>}
              {store.instagram && cfg.showInstagram !== false && (
                <div className="sf-social">
                  <a href={`https://instagram.com/${store.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="sf-social-btn ig">{IG_ICON} Instagram</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(tpl === 'catalogo' || headerSearchOpen) && (
        <div className="sf-search-wrap">
          <div className="sf-search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="search" placeholder="Buscar productos…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus={headerSearchOpen && tpl !== 'catalogo'} />
          </div>
        </div>
      )}

      {!cfgCatNavOverBanner && catNavEl}

      <div className="sf-products-section">
        <div className="sf-section-inner">
          {products.length === 0 ? (
            <div className="sf-empty">
              <div className="sf-empty-icon"></div>
              <div className="sf-empty-title">{t('store.comingSoon')}</div>
              <div className="sf-empty-sub">{t('store.comingSoonSub')}</div>
            </div>
          ) : tpl === 'vitrina' ? (
            hasCats ? (
              <>
                {renderContentBlocks('top')}
                {catGroups.map(({ cat, items }) => (
                  <Fragment key={cat.id}>
                    <div id={`cat-${cat.id}`} className={`sf-cat-section${cfgCategoryShapes[cat.id] ? ` sf-pshape-${cfgCategoryShapes[cat.id]}` : ''}`}>
                      <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                      <div className="sf-grid">{items.map(renderCard)}</div>
                    </div>
                    {renderContentBlocks(cat.id)}
                  </Fragment>
                ))}
                {uncategorized.length > 0 && (
                  <div id="cat-other" className="sf-cat-section">
                    <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
                    <div className="sf-grid">{uncategorized.map(renderCard)}</div>
                  </div>
                )}
                {renderContentBlocks('bottom')}
              </>
            ) : vitHero ? (
              <>
                <div className="sf-vit-hero" onClick={() => openProductModal(vitHero)}>
                  <div className="sf-vit-hero-img-wrap">
                    {vitHero.image_url
                      ? (isVideoUrl(vitHero.image_url)
                          ? <video src={vitHero.image_url} autoPlay muted loop playsInline className="sf-vit-hero-img" />
                          : <img src={vitHero.image_url} alt={vitHero.name} className="sf-vit-hero-img" />)
                      : <div className="sf-vit-hero-img-empty">{PLACEHOLDER}</div>
                    }
                    {getProdQty(vitHero.id) > 0 && <div className="sf-card-badge sf-vit-badge">{getProdQty(vitHero.id)}</div>}
                  </div>
                  <div className="sf-vit-hero-body">
                    <div className="sf-vit-hero-name">{vitHero.name}</div>
                    {vitHero.description && <div className="sf-vit-hero-desc">{vitHero.description}</div>}
                    <div className="sf-vit-hero-footer">
                      <div className="sf-vit-hero-price">{currencySymbol}{Number(vitHero.price).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
                {vitRest.length > 0 && (
                  <><h2 className="sf-section-title sf-vit-more-title">{t('store.ourProducts')}</h2>
                  <div className="sf-grid">{vitRest.map(renderCard)}</div></>
                )}
              </>
            ) : null
          ) : tpl === 'escaparate' ? (
            hasCats ? (
              <>
                {renderContentBlocks('top')}
                {catGroups.map(({ cat, items }) => (
                  <Fragment key={cat.id}>
                    <div id={`cat-${cat.id}`} className={`sf-cat-section${cfgCategoryShapes[cat.id] ? ` sf-pshape-${cfgCategoryShapes[cat.id]}` : ''}`}>
                      <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                      <div className="sf-esc-list">{items.map(renderEscRow)}</div>
                    </div>
                    {renderContentBlocks(cat.id)}
                  </Fragment>
                ))}
                {uncategorized.length > 0 && (
                  <div id="cat-other" className="sf-cat-section">
                    <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
                    <div className="sf-esc-list">{uncategorized.map(renderEscRow)}</div>
                  </div>
                )}
                {renderContentBlocks('bottom')}
              </>
            ) : (
              <>
                <div className="sf-esc-featured">{escFeatured.map(renderCard)}</div>
                {escRest.length > 0 && (
                  <div className="sf-esc-list">{escRest.map(renderEscRow)}</div>
                )}
              </>
            )
          ) : tpl === 'catalogo' ? (
            hasCats ? (
              catGroupsFiltered.length === 0 && uncatGroupFiltered.length === 0 ? (
                <div className="sf-empty">
                  <div className="sf-empty-title">Sin resultados</div>
                  <div className="sf-empty-sub">Prueba con otro término.</div>
                </div>
              ) : (
                <>
                  {catGroupsFiltered.map(({ cat, items }) => (
                    <div key={cat.id} id={`cat-${cat.id}`} className={`sf-cat-section${cfgCategoryShapes[cat.id] ? ` sf-pshape-${cfgCategoryShapes[cat.id]}` : ''}`}>
                      <h2 className={`sf-section-title sf-cat-section-title${cfgStickyCatNav ? ' sf-cat-section-title-sticky' : ''}`}>{cat.name}</h2>
                      <div className="sf-cat-list">{items.map(renderCatRow)}</div>
                    </div>
                  ))}
                  {uncatGroupFiltered.length > 0 && (
                    <div className="sf-cat-section">
                      <h2 className={`sf-section-title sf-cat-section-title${cfgStickyCatNav ? ' sf-cat-section-title-sticky' : ''}`}>{t('store.ourProducts')}</h2>
                      <div className="sf-cat-list">{uncatGroupFiltered.map(renderCatRow)}</div>
                    </div>
                  )}
                </>
              )
            ) : catFiltered.length === 0 ? (
              <div className="sf-empty">
                <div className="sf-empty-title">Sin resultados</div>
                <div className="sf-empty-sub">Prueba con otro término.</div>
              </div>
            ) : (
              <div className="sf-cat-list">{catFiltered.map(renderCatRow)}</div>
            )
          ) : hasCats ? (
            <>
              {renderContentBlocks('top')}
              {catGroups.map(({ cat, items }) => (
                <Fragment key={cat.id}>
                  <div id={`cat-${cat.id}`} className={`sf-cat-section${cfgCategoryShapes[cat.id] ? ` sf-pshape-${cfgCategoryShapes[cat.id]}` : ''}`}>
                    <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                    {renderProductGrid(items, cat.id)}
                  </div>
                  {renderContentBlocks(cat.id)}
                </Fragment>
              ))}
              {uncategorized.length > 0 && (
                <div id="cat-other" className="sf-cat-section">
                  <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
                  {renderProductGrid(uncategorized, '__other')}
                </div>
              )}
              {renderContentBlocks('bottom')}
            </>
          ) : (
            <>
              <h2 className="sf-section-title">{t('store.ourProducts')}</h2>
              <div className="sf-grid">{products.map(renderCard)}</div>
            </>
          )}
        </div>
      </div>
      </>
      )}

      {cartCount > 0 && (
        <button className="sf-cart-bar" onClick={() => setView('checkout')}>
          <span className="sf-cart-badge">{cartCount}</span>
          <span className="sf-cart-label">{t('store.viewOrder')}</span>
          <span className="sf-cart-total">{currencySymbol}{cartTotal.toFixed(2)}</span>
        </button>
      )}

      <footer className="sf-footer">
        {showInstallBtn && (
          <div className="sf-install-wrap">
            <button className="sf-install-btn" onClick={handleInstall}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              {t('store.installBtn')}
            </button>
            {showIosHint && (
              <div className="sf-ios-hint">
                {t('store.iosHint1')} <strong>Share</strong>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 3px' }}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {t('store.iosHint2')} <strong>{t('store.iosHint3')}</strong>
              </div>
            )}
          </div>
        )}
        <Link href="/" className="sf-footer-link">{t('store.footerLink')}</Link>
      </footer>

      {renderProductModal()}

      {lightbox && (
        <div className="sf-lightbox" onClick={() => setLightbox(null)}>
          <button className="sf-lightbox-close" onClick={() => setLightbox(null)}>×</button>
          <div
            className="sf-lightbox-viewport"
            onTouchStart={lightbox.images.length > 1 ? e => {
              touchStartX.current = e.touches[0].clientX
              swipedRef.current = false
              lightboxDragStartIdxRef.current = lightbox.idx
              if (lightboxStripRef.current) lightboxStripRef.current.classList.add('dragging')
            } : undefined}
            onTouchMove={lightbox.images.length > 1 ? e => {
              const dx = e.touches[0].clientX - touchStartX.current
              if (Math.abs(dx) > 5) {
                e.stopPropagation()
                const strip = lightboxStripRef.current
                if (strip) {
                  const n = lightbox.images.length
                  const fw = strip.offsetWidth / n
                  const pct = (Math.max(0, Math.min((n - 1) * fw, lightboxDragStartIdxRef.current * fw - dx)) / (n * fw)) * 100
                  strip.style.transform = `translateX(-${pct}%)`
                }
              }
            } : undefined}
            onTouchEnd={lightbox.images.length > 1 ? e => {
              const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
              if (lightboxStripRef.current) lightboxStripRef.current.classList.remove('dragging')
              if (Math.abs(dx) > 40) {
                swipedRef.current = true
                const next = dx < 0 ? Math.min(lightbox.images.length - 1, lightboxDragStartIdxRef.current + 1) : Math.max(0, lightboxDragStartIdxRef.current - 1)
                setLightbox(lb => lb ? { ...lb, idx: next } : null)
              } else {
                setLightbox(lb => lb ? { ...lb, idx: lightboxDragStartIdxRef.current } : null)
              }
            } : undefined}
            onClick={e => e.stopPropagation()}
          >
            <div className="sf-lightbox-strip" ref={lightboxStripRef} style={{ width: `${lightbox.images.length * 100}%`, transform: `translateX(-${lightbox.idx * (100 / lightbox.images.length)}%)` }}>
              {lightbox.images.map((img, i) => (
                <div key={i} className="sf-lightbox-frame" style={{ width: `${100 / lightbox.images.length}%` }}>
                  {isVideoUrl(img)
                    ? <video src={img} autoPlay muted loop playsInline className="sf-lightbox-img" />
                    : <img src={img} alt="" className="sf-lightbox-img" />}
                </div>
              ))}
            </div>
          </div>
          {lightbox.images.length > 1 && (
            <div className="sf-lightbox-dots">
              {lightbox.images.map((_, i) => (
                <div key={i} className={`sf-slide-dot${lightbox.idx === i ? ' on' : ''}`} />
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── DRAWER MENU ── */}
      {cfg.showMenuButton && (
        <>
          {menuOpen && <div className="sf-drawer-overlay" onClick={() => setMenuOpen(false)} />}
          <div className={`sf-drawer${menuOpen ? ' sf-drawer-open' : ''}`}>
            <div className="sf-drawer-header">
              <div className="sf-drawer-brand">
                {store.logo_url && (
                <div className={`sf-drawer-logo sf-nav-logo-${cfgLogoShape}`}>
                  <img src={store.logo_url} alt={store.name} />
                </div>
              )}
                <span className="sf-drawer-name">{store.name}</span>
              </div>
              <button className="sf-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {hasCats && (
              <nav className="sf-drawer-nav">
                {catGroups.map(({ cat }) => (
                  <button
                    key={cat.id}
                    className="sf-drawer-link"
                    onClick={() => {
                      setMenuOpen(false)
                      setActiveCatId(cat.id)
                      setTimeout(() => document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
                {uncategorized.length > 0 && (
                  <button
                    className="sf-drawer-link"
                    onClick={() => {
                      setMenuOpen(false)
                      setActiveCatId('__other')
                      setTimeout(() => document.getElementById('cat-other')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    }}
                  >
                    {t('store.ourProducts')}
                  </button>
                )}
              </nav>
            )}

            <div className="sf-drawer-social">
              {store.whatsapp && cfg.showWhatsapp !== false && (
                <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="sf-drawer-social-btn wa">
                  {WA_ICON} WhatsApp
                </a>
              )}
              {store.instagram && cfg.showInstagram !== false && (
                <a href={`https://instagram.com/${store.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="sf-drawer-social-btn ig">
                  {IG_ICON} Instagram
                </a>
              )}
            </div>
          </div>
        </>
      )}

    </div>
    </>
  )
}
