'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '../lib/LocaleProvider'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type VariableGroup  = { label: string; choices: string[] }
type Additional     = { name: string; price: number }
type ProductOptions = {
  variables?:   VariableGroup[]
  colors?:      string[]
  additionals?: Additional[]
  allowNotes?:  boolean
}
type SelectedOptions = {
  variables?:   Record<string, string>
  color?:       string
  additionals?: Additional[]
  notes?:       string
}
type CartItem = {
  id: string; name: string; price: number; extraPrice: number
  image_url: string | null; quantity: number
  options?: ProductOptions; selectedOptions?: SelectedOptions
}
type Product = {
  id: string; name: string; description: string | null
  price: number; image_url: string | null; options?: ProductOptions | null
  category_id?: string | null
}
type PaymentMethod = { type: string; label: string; enabled: boolean; details: Record<string, string> }

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

type TemplateConfig = {
  pageBg?: string; pageFont?: string
  fontSize?: 'small' | 'medium' | 'large'
  fontSizePx?: number
  textAlign?: 'left' | 'center'
  photoShape?: 'sharp' | 'square' | 'circle'
  priceColor?: string; priceFont?: string
  priceSize?: 'small' | 'medium' | 'large'
  photoSize?: 'small' | 'medium' | 'large'
}
type Store = {
  id: string; name: string; slug: string
  logo_url: string | null; banner_url: string | null
  description: string | null; whatsapp: string | null; instagram: string | null
  payment_methods: unknown; template: string | null
  template_config?: TemplateConfig | null
}

function hasOptions(p: Product): boolean {
  return !!(
    p.options?.variables?.some(g => g.choices.length > 0) ||
    (p.options?.colors?.length ?? 0) > 0 ||
    (p.options?.additionals?.length ?? 0) > 0 ||
    p.options?.allowNotes
  )
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

export default function StoreShell({ store, products, categories = [] }: { store: Store; products: Product[]; categories: { id: string; name: string; position: number }[] }) {
  const t = useT()
  const router = useRouter()
  const [cart, setCart]                   = useState<Record<string, CartItem>>({})
  const [view, setView]                   = useState<'catalog' | 'checkout' | 'confirmed'>('catalog')
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [selectedPayment, setSelectedPayment]   = useState('')
  const [paymentFreeText, setPaymentFreeText]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [orderId, setOrderId]       = useState('')
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt(): void } | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [isIos, setIsIos]   = useState(false)
  const [installed, setInstalled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Product options modal
  const [modalProduct, setModalProduct]       = useState<Product | null>(null)
  const [modalVars, setModalVars]             = useState<Record<string, string>>({})
  const [modalColor, setModalColor]           = useState<string | undefined>()
  const [modalAdditionals, setModalAdditionals] = useState<Set<number>>(new Set())
  const [modalNotes, setModalNotes]           = useState('')
  const [modalQty, setModalQty]               = useState(1)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as Navigator & { standalone?: boolean }).standalone
    setIsIos(ios)
    if (window.matchMedia('(display-mode: standalone)').matches) { setInstalled(true); return }
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as Event & { prompt(): void }) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

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
    try {
      const saved = localStorage.getItem('lyte-customer')
      if (saved) {
        const { name, phone } = JSON.parse(saved)
        if (name) setCustomerName(name)
        if (phone) setCustomerPhone(phone)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(`cart-${store.slug}`, JSON.stringify(cart)) } catch {}
  }, [cart, store.slug])

  const cartItems  = Object.values(cart).filter(i => i.quantity > 0)
  const cartCount  = cartItems.reduce((s, i) => s + i.quantity, 0)
  const cartTotal  = cartItems.reduce((s, i) => s + (i.price + i.extraPrice) * i.quantity, 0)
  const enabledMethods = parsePaymentMethods(store.payment_methods)
  const showInstallBtn = !installed && (isIos || !!installPrompt)

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
  }
  const cfg          = store.template_config ?? {}
  const cfgFontFamily  = cfg.pageFont ? FONT_MAP[cfg.pageFont] : undefined
  const cfgFontSize    = cfg.fontSize ?? 'medium'
  const cfgFontSizePx  = cfg.fontSizePx ?? (cfg.fontSize === 'small' ? 13 : cfg.fontSize === 'large' ? 18 : undefined)
  const cfgTextAlign   = cfg.textAlign ?? 'left'
  const cfgPhotoShape  = cfg.photoShape ?? 'square'
  const cfgPhotoSize   = cfg.photoSize  ?? 'medium'
  const cfgPriceColor  = cfg.priceColor ?? '#7C3AED'
  const cfgPriceFontFamily = cfg.priceFont ? FONT_MAP[cfg.priceFont] : undefined
  const cfgPriceSize   = cfg.priceSize ?? 'medium'
  const pageStyle: React.CSSProperties = {
    ...(cfg.pageBg ? { background: cfg.pageBg } : {}),
    ...(cfgFontFamily ? { fontFamily: cfgFontFamily } : {}),
    ...(cfgFontSizePx ? { fontSize: `${cfgFontSizePx}px` } : {}),
    '--sf-price-color': cfgPriceColor,
    ...(cfgPriceFontFamily ? { '--sf-price-font': cfgPriceFontFamily } : {}),
  } as React.CSSProperties

  // ── Modal helpers ──
  function openProductModal(p: Product) {
    const existing = cart[p.id]
    setModalProduct(p)
    setModalVars(existing?.selectedOptions?.variables ?? {})
    setModalColor(existing?.selectedOptions?.color)
    const existingAdds = existing?.selectedOptions?.additionals ?? []
    const addIdxs = new Set<number>()
    p.options?.additionals?.forEach((a, i) => {
      if (existingAdds.some(ea => ea.name === a.name)) addIdxs.add(i)
    })
    setModalAdditionals(addIdxs)
    setModalNotes(existing?.selectedOptions?.notes ?? '')
    setModalQty(existing?.quantity ?? 1)
  }

  function confirmModal() {
    if (!modalProduct) return
    const selectedAdds = (modalProduct.options?.additionals ?? []).filter((_, i) => modalAdditionals.has(i))
    const extraPrice   = selectedAdds.reduce((s, a) => s + a.price, 0)
    setCart(prev => ({
      ...prev,
      [modalProduct.id]: {
        id: modalProduct.id, name: modalProduct.name,
        price: modalProduct.price, extraPrice,
        image_url: modalProduct.image_url, quantity: modalQty,
        options: modalProduct.options ?? undefined,
        selectedOptions: {
          variables:   Object.keys(modalVars).length ? modalVars : undefined,
          color:       modalColor,
          additionals: selectedAdds.length ? selectedAdds : undefined,
          notes:       modalNotes.trim() || undefined,
        },
      }
    }))
    setModalProduct(null)
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => {
      const next = (prev[id]?.quantity ?? 0) + delta
      if (next <= 0) { const { [id]: _, ...rest } = prev; return rest }
      return { ...prev, [id]: { ...prev[id], quantity: next } }
    })
  }

  // ── Order submit ──
  async function handleSubmit() {
    if (!customerName.trim() || !customerPhone.trim()) { setError(t('store.error.required')); return }
    setSubmitting(true); setError('')
    const paymentLabel = selectedPayment
      ? (enabledMethods.find(m => m.type === selectedPayment)?.label ?? selectedPayment)
      : paymentFreeText

    try {
      const newOrderId = crypto.randomUUID()
      const { error: oErr } = await supabase.from('orders').insert({
        id: newOrderId, store_id: store.id,
        customer_name: customerName.trim(), customer_phone: customerPhone.trim(),
        customer_notes: customerNotes.trim() || null,
        payment_method: paymentLabel || null, total: cartTotal, status: 'pending',
      })
      if (oErr) throw new Error(oErr.message)

      try { localStorage.setItem('lyte-customer', JSON.stringify({ name: customerName.trim(), phone: customerPhone.trim() })) } catch {}

      await supabase.from('order_items').insert(
        cartItems.map(i => ({
          order_id: newOrderId, product_id: i.id,
          product_name: i.name, product_price: i.price,
          quantity: i.quantity,
          subtotal: +((i.price + i.extraPrice) * i.quantity).toFixed(2),
          selected_options: i.selectedOptions ?? null,
        }))
      )

      // Comanda lines
      const lines: string[] = [
        `*Comanda #${newOrderId.slice(0, 8).toUpperCase()}*`,
        new Date().toLocaleString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        '', `*Nombre:* ${customerName}`, `*Telefono:* ${customerPhone}`,
        ...(paymentLabel ? [`*Pago:* ${paymentLabel}`] : []),
        '', '*Productos:*',
        ...cartItems.flatMap(i => {
          const unitTotal = (i.price + i.extraPrice) * i.quantity
          const rows = [`  - ${i.quantity}x ${i.name}  $${unitTotal.toFixed(2)}`]
          const so = i.selectedOptions
          if (so?.variables) Object.entries(so.variables).forEach(([k, v]) => rows.push(`    ${k}: ${v}`))
          if (so?.color)     rows.push(`    Color: ${so.color}`)
          if (so?.additionals?.length) rows.push(`    Extras: ${so.additionals.map(a => a.name).join(', ')}`)
          if (so?.notes)     rows.push(`    Nota: ${so.notes}`)
          return rows
        }),
        '', `*Total: $${cartTotal.toFixed(2)}*`,
        ...(customerNotes ? ['', `*Notas:* ${customerNotes}`] : []),
      ]

      const shortId = newOrderId.slice(0, 8).toUpperCase()
      setOrderId(shortId); setCart({})

      if (store.whatsapp) {
        const num = store.whatsapp.replace(/\D/g, '')
        router.push(`/${store.slug}/pedido?id=${shortId}&wa=${encodeURIComponent(`whatsapp://send?phone=${num}&text=${encodeURIComponent(lines.join('\n'))}`)}`)
      } else {
        setView('confirmed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('store.error.generic'))
    }
    setSubmitting(false)
  }

  // ── CONFIRMED ──
  if (view === 'confirmed') return (
    <div className="sf-confirm-screen">
      <div className="sf-confirm-card">
        <div className="sf-confirm-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 32, height: 32 }}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>
        <h1 className="sf-confirm-title">{t('store.confirmed.title')}</h1>
        <p className="sf-confirm-sub">{t('store.confirmed.sub', { id: orderId })}</p>
        <button className="sf-confirm-btn" onClick={() => { setView('catalog'); setCustomerName(''); setCustomerPhone(''); setCustomerNotes(''); setSelectedPayment(''); setPaymentFreeText('') }}>
          {t('store.confirmed.continue')}
        </button>
        <Link href="/" className="sf-confirm-link">{t('store.confirmed.link')}</Link>
      </div>
    </div>
  )

  // Product modal extra price (for footer price display)
  const modalExtraPrice = modalProduct
    ? (modalProduct.options?.additionals ?? []).filter((_, i) => modalAdditionals.has(i)).reduce((s, a) => s + a.price, 0)
    : 0

  // ── CHECKOUT ──
  if (view === 'checkout') return (
    <div className={`sf-page sf-tpl-${store.template ?? 'clasico'} sf-fsize-${cfgFontSize} sf-align-${cfgTextAlign} sf-pshape-${cfgPhotoShape} sf-prsize-${cfgPriceSize} sf-imgsize-${cfgPhotoSize}`} style={pageStyle}>
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
          <h3 className="sf-co-section-title">{t('store.summary')}</h3>
          {cartItems.map(item => (
            <div key={item.id} className="sf-co-row">
              {item.image_url
                ? <img src={item.image_url} alt={item.name} className="sf-co-img" />
                : <div className="sf-co-img sf-co-img-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg></div>
              }
              <div className="sf-co-info">
                <div className="sf-co-name">{item.name}</div>
                {/* Selected options summary */}
                {item.selectedOptions && (
                  <div className="sf-co-opts">
                    {item.selectedOptions.variables && Object.entries(item.selectedOptions.variables).map(([k, v]) => (
                      <span key={k} className="sf-co-opt-tag">{k}: {v}</span>
                    ))}
                    {item.selectedOptions.color && <span className="sf-co-opt-tag">{item.selectedOptions.color}</span>}
                    {item.selectedOptions.additionals?.map(a => (
                      <span key={a.name} className="sf-co-opt-tag">+ {a.name}</span>
                    ))}
                    {item.selectedOptions.notes && <span className="sf-co-opt-note">{item.selectedOptions.notes}</span>}
                  </div>
                )}
                <div className="sf-co-price">${((item.price + item.extraPrice) * item.quantity).toFixed(2)}</div>
              </div>
              {hasOptions({ id: item.id, name: item.name, price: item.price, description: null, image_url: item.image_url, options: item.options }) ? (
                <button className="sf-co-edit-btn" onClick={() => openProductModal({ id: item.id, name: item.name, price: item.price, description: null, image_url: item.image_url, options: item.options })}>
                  Editar
                </button>
              ) : (
                <div className="sf-qty">
                  <button onClick={() => updateQty(item.id, -1)}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, +1)}>+</button>
                </div>
              )}
            </div>
          ))}
          <div className="sf-co-total">
            <span>{t('store.total')}</span>
            <span className="sf-co-total-amt">${cartTotal.toFixed(2)}</span>
          </div>
        </div>

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
          <h3 className="sf-co-section-title">{t('store.paymentMethod')}</h3>
          {enabledMethods.length > 0 ? (
            <div className="sf-payment-list">
              {enabledMethods.map(m => (
                <div key={m.type} className={`sf-payment-opt${selectedPayment === m.type ? ' selected' : ''}`} onClick={() => setSelectedPayment(m.type)}>
                  <div className="sf-payment-opt-top">
                    <div className={`sf-payment-radio${selectedPayment === m.type ? ' on' : ''}`} />
                    <span className="sf-payment-label">{m.label}</span>
                  </div>
                  {selectedPayment === m.type && Object.keys(m.details ?? {}).length > 0 && (
                    <div className="sf-payment-info">
                      {Object.entries(m.details).map(([k, v]) => (
                        <div key={k} className="sf-payment-detail-row"><span>{k}</span><strong>{v}</strong></div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="sf-co-field">
              <label>{t('store.howPay')}</label>
              <input type="text" placeholder={t('store.howPayPlaceholder')} value={paymentFreeText} onChange={e => setPaymentFreeText(e.target.value)} />
            </div>
          )}
        </div>

        {error && <div className="sf-co-error">{error}</div>}
        <button className="sf-submit-btn" onClick={handleSubmit} disabled={submitting || cartItems.length === 0}>
          {submitting ? t('store.sending') : `${t('store.confirmOrder')} · $${cartTotal.toFixed(2)}`}
        </button>
      </div>

      {/* Modal inside checkout too */}
      {modalProduct && (
        <div className="sf-modal-overlay" onClick={() => setModalProduct(null)}>
          <div className="sf-modal" onClick={e => e.stopPropagation()}>
            <button className="sf-modal-close" onClick={() => setModalProduct(null)}>×</button>

            <div className="sf-modal-product-head">
              {modalProduct.image_url && (
                <img src={modalProduct.image_url} alt={modalProduct.name} className="sf-modal-img" />
              )}
              <div className="sf-modal-product-info">
                <div className="sf-modal-name">{modalProduct.name}</div>
                {modalProduct.description && <div className="sf-modal-desc">{modalProduct.description}</div>}
                <div className="sf-modal-base-price">${Number(modalProduct.price).toFixed(2)}</div>
              </div>
            </div>

            <div className="sf-modal-body">
              {modalProduct.options?.variables?.filter(g => g.choices.length > 0).map((g, gi) => (
                <div key={gi} className="sf-modal-section">
                  <div className="sf-modal-section-title">{g.label}</div>
                  <div className="sf-modal-chips">
                    {g.choices.map(c => (
                      <button
                        key={c}
                        className={`sf-modal-chip${modalVars[g.label] === c ? ' selected' : ''}`}
                        onClick={() => setModalVars(v => ({ ...v, [g.label]: v[g.label] === c ? '' : c }))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {(modalProduct.options?.colors?.length ?? 0) > 0 && (
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
              )}

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
                      {a.price > 0 && <span className="sf-modal-extra-price">+${a.price.toFixed(2)}</span>}
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

            <div className="sf-modal-footer">
              <div className="sf-modal-qty">
                <button onClick={() => setModalQty(q => Math.max(1, q - 1))}>−</button>
                <span>{modalQty}</span>
                <button onClick={() => setModalQty(q => q + 1)}>+</button>
              </div>
              <button className="sf-modal-confirm" onClick={confirmModal}>
                {cart[modalProduct.id] ? 'Actualizar' : 'Agregar'} · ${((modalProduct.price + modalExtraPrice) * modalQty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── CATALOG ──
  const tpl = store.template ?? 'clasico'

  // Category grouping
  const catGroups = categories
    .map(cat => ({ cat, items: products.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0)
  const uncategorized = products.filter(p => !p.category_id || !categories.find(c => c.id === p.category_id))
  const hasCats = catGroups.length > 0
  const escFeatured = products.slice(0, 2)
  const escRest     = products.slice(2)
  const vitHero     = products.length > 0 ? products[0] : null
  const vitRest     = products.slice(1)
  const catFiltered = tpl === 'catalogo'
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    : products
  const catGroupsFiltered = catGroups.map(({ cat, items }) => ({
    cat,
    items: tpl === 'catalogo'
      ? items.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
      : items,
  })).filter(g => g.items.length > 0)
  const uncatGroupFiltered = tpl === 'catalogo'
    ? uncategorized.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    : uncategorized

  const PLACEHOLDER = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  )

  const renderCard = (product: Product) => {
    const inCart = cart[product.id]
    return (
      <div key={product.id} className="sf-card" onClick={() => openProductModal(product)}>
        <div className="sf-card-img-wrap">
          {product.image_url
            ? <img src={product.image_url} alt={product.name} className="sf-card-img" />
            : <div className="sf-card-img-empty">{PLACEHOLDER}</div>
          }
          {inCart && <div className="sf-card-badge">{inCart.quantity}</div>}
        </div>
        <div className="sf-card-body">
          <div className="sf-card-name">{product.name}</div>
          {product.description && <div className="sf-card-desc">{product.description}</div>}
          <div className="sf-card-footer">
            <div className="sf-card-price">${Number(product.price).toFixed(2)}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderEscRow = (product: Product) => (
    <div key={product.id} className="sf-esc-row" onClick={() => openProductModal(product)}>
      <div className="sf-esc-img-wrap">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="sf-esc-img" />
          : <div className="sf-esc-img sf-esc-img-empty">{PLACEHOLDER}</div>}
        {cart[product.id] && <div className="sf-card-badge">{cart[product.id].quantity}</div>}
      </div>
      <div className="sf-esc-info">
        <div className="sf-esc-name">{product.name}</div>
        <div className="sf-esc-price">${Number(product.price).toFixed(2)}</div>
      </div>
    </div>
  )

  const renderCatRow = (product: Product) => (
    <div key={product.id} className="sf-cat-card" onClick={() => openProductModal(product)}>
      <div className="sf-cat-img-wrap">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="sf-cat-img" />
          : <div className="sf-cat-img sf-cat-img-empty">{PLACEHOLDER}</div>}
        {cart[product.id] && <div className="sf-card-badge">{cart[product.id].quantity}</div>}
      </div>
      <div className="sf-cat-info">
        <div className="sf-cat-name">{product.name}</div>
        {product.description && <div className="sf-cat-desc">{product.description}</div>}
      </div>
      <div className="sf-cat-action">
        <div className="sf-cat-price">${Number(product.price).toFixed(2)}</div>
      </div>
    </div>
  )

  return (
    <div className={`sf-page sf-tpl-${tpl} sf-fsize-${cfgFontSize} sf-align-${cfgTextAlign} sf-pshape-${cfgPhotoShape} sf-prsize-${cfgPriceSize} sf-imgsize-${cfgPhotoSize}`} style={pageStyle}>
      <div className="sf-topbar">
        <div className="sf-topbar-inner">
          <div className="sf-topbar-brand">
            {store.logo_url && <img src={store.logo_url} alt={store.name} className="sf-nav-logo" />}
            <span className="sf-nav-name">{store.name}</span>
          </div>
          {store.whatsapp && (
            <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="sf-nav-wa">
              {WA_ICON} {t('store.contact')}
            </a>
          )}
        </div>
      </div>

      {store.banner_url && tpl !== 'vitrina' && tpl !== 'catalogo' && (
        <div className="sf-banner"><img src={store.banner_url} alt="Banner" className="sf-banner-img" /></div>
      )}

      {(store.description || store.instagram) && (
        <div className="sf-header">
          <div className="sf-header-inner sf-header-inner-compact">
            <div className="sf-header-info">
              {store.description && <p className="sf-store-desc">{store.description}</p>}
              {store.instagram && (
                <div className="sf-social">
                  <a href={`https://instagram.com/${store.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="sf-social-btn ig">{IG_ICON} Instagram</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tpl === 'catalogo' && (
        <div className="sf-search-wrap">
          <div className="sf-search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="search" placeholder="Buscar productos…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      )}

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
                {catGroups.map(({ cat, items }) => (
                  <div key={cat.id} className="sf-cat-section">
                    <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                    <div className="sf-grid">{items.map(renderCard)}</div>
                  </div>
                ))}
                {uncategorized.length > 0 && (
                  <div className="sf-cat-section">
                    <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
                    <div className="sf-grid">{uncategorized.map(renderCard)}</div>
                  </div>
                )}
              </>
            ) : vitHero ? (
              <>
                <div className="sf-vit-hero" onClick={() => openProductModal(vitHero)}>
                  <div className="sf-vit-hero-img-wrap">
                    {vitHero.image_url
                      ? <img src={vitHero.image_url} alt={vitHero.name} className="sf-vit-hero-img" />
                      : <div className="sf-vit-hero-img-empty">{PLACEHOLDER}</div>
                    }
                    {cart[vitHero.id] && <div className="sf-card-badge sf-vit-badge">{cart[vitHero.id].quantity}</div>}
                  </div>
                  <div className="sf-vit-hero-body">
                    <div className="sf-vit-hero-name">{vitHero.name}</div>
                    {vitHero.description && <div className="sf-vit-hero-desc">{vitHero.description}</div>}
                    <div className="sf-vit-hero-footer">
                      <div className="sf-vit-hero-price">${Number(vitHero.price).toFixed(2)}</div>
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
                {catGroups.map(({ cat, items }) => (
                  <div key={cat.id} className="sf-cat-section">
                    <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                    <div className="sf-esc-list">{items.map(renderEscRow)}</div>
                  </div>
                ))}
                {uncategorized.length > 0 && (
                  <div className="sf-cat-section">
                    <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
                    <div className="sf-esc-list">{uncategorized.map(renderEscRow)}</div>
                  </div>
                )}
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
                    <div key={cat.id} className="sf-cat-section">
                      <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                      <div className="sf-cat-list">{items.map(renderCatRow)}</div>
                    </div>
                  ))}
                  {uncatGroupFiltered.length > 0 && (
                    <div className="sf-cat-section">
                      <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
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
              {catGroups.map(({ cat, items }) => (
                <div key={cat.id} className="sf-cat-section">
                  <h2 className="sf-section-title sf-cat-section-title">{cat.name}</h2>
                  <div className="sf-grid">{items.map(renderCard)}</div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div className="sf-cat-section">
                  <h2 className="sf-section-title sf-cat-section-title">{t('store.ourProducts')}</h2>
                  <div className="sf-grid">{uncategorized.map(renderCard)}</div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="sf-section-title">{t('store.ourProducts')}</h2>
              <div className="sf-grid">{products.map(renderCard)}</div>
            </>
          )}
        </div>
      </div>

      {cartCount > 0 && (
        <button className="sf-cart-bar" onClick={() => setView('checkout')}>
          <span className="sf-cart-badge">{cartCount}</span>
          <span className="sf-cart-label">{t('store.viewOrder')}</span>
          <span className="sf-cart-total">${cartTotal.toFixed(2)}</span>
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

      {modalProduct && (
        <div className="sf-modal-overlay" onClick={() => setModalProduct(null)}>
          <div className="sf-modal" onClick={e => e.stopPropagation()}>
            <button className="sf-modal-close" onClick={() => setModalProduct(null)}>×</button>

            <div className="sf-modal-product-head">
              {modalProduct.image_url && (
                <img src={modalProduct.image_url} alt={modalProduct.name} className="sf-modal-img" />
              )}
              <div className="sf-modal-product-info">
                <div className="sf-modal-name">{modalProduct.name}</div>
                {modalProduct.description && <div className="sf-modal-desc">{modalProduct.description}</div>}
                <div className="sf-modal-base-price">${Number(modalProduct.price).toFixed(2)}</div>
              </div>
            </div>

            <div className="sf-modal-body">
              {modalProduct.options?.variables?.filter(g => g.choices.length > 0).map((g, gi) => (
                <div key={gi} className="sf-modal-section">
                  <div className="sf-modal-section-title">{g.label}</div>
                  <div className="sf-modal-chips">
                    {g.choices.map(c => (
                      <button
                        key={c}
                        className={`sf-modal-chip${modalVars[g.label] === c ? ' selected' : ''}`}
                        onClick={() => setModalVars(v => ({ ...v, [g.label]: v[g.label] === c ? '' : c }))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {(modalProduct.options?.colors?.length ?? 0) > 0 && (
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
              )}

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
                      {a.price > 0 && <span className="sf-modal-extra-price">+${a.price.toFixed(2)}</span>}
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

            <div className="sf-modal-footer">
              <div className="sf-modal-qty">
                <button onClick={() => setModalQty(q => Math.max(1, q - 1))}>−</button>
                <span>{modalQty}</span>
                <button onClick={() => setModalQty(q => q + 1)}>+</button>
              </div>
              <button className="sf-modal-confirm" onClick={confirmModal}>
                {cart[modalProduct.id] ? 'Actualizar' : 'Agregar'} · ${((modalProduct.price + modalExtraPrice) * modalQty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
