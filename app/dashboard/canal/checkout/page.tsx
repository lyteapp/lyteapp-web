'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useDashboardStore } from '../../../lib/DashboardStoreProvider'
import '../canal.css'

const ACCENT_PRESETS = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#059669', '#DB2777', '#0F172A', '#64748B']

// ── PAYMENT METHODS ────────────────────────────────────────────
interface PaymentMethod {
  id: string; name: string; icon: string; enabled: boolean
  fields: { key: string; label: string; placeholder: string }[]
  values: Record<string, string>
}
const METHODS: Omit<PaymentMethod, 'enabled' | 'values'>[] = [
  { id: 'pago_movil', name: 'Pago Movil', icon: 'PM', fields: [
    { key: 'banco', label: 'Banco', placeholder: 'Ej: Banesco' },
    { key: 'cedula', label: 'Cedula / RIF', placeholder: 'Ej: V-12345678' },
    { key: 'telefono', label: 'Telefono', placeholder: 'Ej: 0414-1234567' },
  ]},
  { id: 'zelle', name: 'Zelle', icon: 'ZL', fields: [
    { key: 'email', label: 'Email o telefono', placeholder: 'nombre@email.com' },
    { key: 'titular', label: 'Nombre del titular', placeholder: 'Juan Perez' },
  ]},
  { id: 'usdt', name: 'USDT / Cripto', icon: 'CR', fields: [
    { key: 'red', label: 'Red', placeholder: 'Ej: TRC20 (Tron)' },
    { key: 'wallet', label: 'Wallet / Direccion', placeholder: 'TXxx...' },
  ]},
  { id: 'efectivo', name: 'Efectivo', icon: 'EF', fields: [
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Pago al momento de entrega' },
  ]},
  { id: 'transferencia', name: 'Transferencia bancaria', icon: 'TB', fields: [
    { key: 'banco', label: 'Banco', placeholder: 'Ej: Mercantil' },
    { key: 'cuenta', label: 'No de cuenta', placeholder: '0105-0000-00-0000000000' },
    { key: 'titular', label: 'Titular', placeholder: 'Juan Perez' },
    { key: 'rif', label: 'Cedula / RIF', placeholder: 'V-12345678' },
  ]},
  { id: 'binance', name: 'Binance Pay', icon: 'BN', fields: [
    { key: 'id', label: 'Binance ID / Pay ID', placeholder: 'Ej: 123456789' },
  ]},
  { id: 'punto_venta', name: 'Punto de venta', icon: 'PV', fields: [
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Ej: Disponible en local' },
  ]},
]

interface CheckoutSettings {
  requireName: boolean; requirePhone: boolean; requireAddress: boolean
  allowNotes: boolean; minOrder: string; deliveryEnabled: boolean; deliveryFee: string
  deliveryTypes: { delivery: boolean; pickup: boolean; national: boolean }
  requirePaymentMethod: boolean; requirePaymentProof: boolean
  whatsappFloating: boolean
  showBcvInSummary: boolean
  // Empty = matches the store's general accent color automatically.
  accentColor: string
}

const DEFAULTS: CheckoutSettings = {
  requireName: true, requirePhone: true, requireAddress: false,
  allowNotes: true, minOrder: '', deliveryEnabled: false, deliveryFee: '',
  deliveryTypes: { delivery: true, pickup: false, national: false },
  requirePaymentMethod: false, requirePaymentProof: false,
  whatsappFloating: false,
  accentColor: '',
  showBcvInSummary: true,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cn-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cn-toggle-track" />
    </label>
  )
}

// Shows the real storefront's checkout, not a redrawn mockup — the iframe
// opens straight into /{slug}?previewCheckout=1, which seeds a sample cart
// and jumps to the checkout view (see StoreShell's isCheckoutPreview). It
// only reflects the last *saved* settings, so it reloads (via previewKey)
// after a successful save rather than redrawing on every keystroke.
function CheckoutPreview({ storeSlug, previewKey }: { storeSlug: string | null; previewKey: number }) {
  const [loadId] = useState(() => Date.now())
  return (
    <div className="cn-checkout-preview-frame" style={{
      border: '10px solid #1E1E2E', borderRadius: 36,
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      overflow: 'hidden', background: '#F8F7F4',
      height: 844, maxHeight: 844, display: 'flex', flexDirection: 'column',
    }}>
      {storeSlug ? (
        <iframe
          key={previewKey}
          src={`/${storeSlug}?previewCheckout=1&_r=${loadId}-${previewKey}`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: 'white' }}
          title="Vista previa del checkout"
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Cargando vista previa...
        </div>
      )}
    </div>
  )
}

export default function CheckoutPage() {
  const { storeId, store } = useDashboardStore()
  const storeSlug = store?.slug ?? null
  const [settings, setSettings] = useState<CheckoutSettings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  // Pagos
  const [methods, setMethods] = useState<PaymentMethod[]>(() =>
    METHODS.map(m => ({ ...m, enabled: false, values: {} }))
  )
  const [openMethod, setOpenMethod] = useState<string | null>(null)
  const [savingPagos, setSavingPagos] = useState(false)
  const [successPagos, setSuccessPagos] = useState(false)
  const [pagosError, setPagosError] = useState('')
  const [storeWhatsapp, setStoreWhatsapp] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  useEffect(() => {
    if (!storeId) return
    async function load() {
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('checkout_settings,payment_methods,whatsapp')
          .eq('id', storeId!)
          .maybeSingle()
        if (!store) return
        setStoreWhatsapp((store as Record<string, unknown>).whatsapp as string | null ?? null)
        if (store.checkout_settings) setSettings({ ...DEFAULTS, ...store.checkout_settings })
        if (store.payment_methods) {
          const pm = store.payment_methods as Record<string, { enabled: boolean; values: Record<string, string> }>
          setMethods(prev => prev.map(m => {
            const s = pm[m.id]
            return s ? { ...m, enabled: s.enabled ?? false, values: s.values ?? {} } : m
          }))
        }
      } catch { /* silently handle */ }
    }
    load()
  }, [storeId])

  function setSetting<K extends keyof CheckoutSettings>(key: K, value: CheckoutSettings[K]) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  async function saveSettings(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!storeId) return
    setSettingsError(''); setSuccess(false); setSaving(true)
    const { error: err } = await supabase.from('stores').update({ checkout_settings: settings }).eq('id', storeId)
    if (err) setSettingsError(err.message)
    else { setSuccess(true); setPreviewKey(k => k + 1) }
    setSaving(false)
  }

  async function savePagos() {
    if (!storeId) return
    setSavingPagos(true); setPagosError(''); setSuccessPagos(false)
    const pm: Record<string, { enabled: boolean; values: Record<string, string> }> = {}
    for (const m of methods) pm[m.id] = { enabled: m.enabled, values: m.values }
    const { error: err } = await supabase.from('stores').update({ payment_methods: pm }).eq('id', storeId)
    setSavingPagos(false)
    if (err) { setPagosError(err.message); return }
    setSuccessPagos(true)
    setPreviewKey(k => k + 1)
    setTimeout(() => setSuccessPagos(false), 3000)
  }

  return (
    <div className="cn-page" style={{ maxWidth: 'none' }}>
      <div className="cn-header">
        <div className="cn-title">Checkout</div>
        <div className="cn-desc">Configura el proceso de compra de tu tienda.</div>
      </div>

      <div className="cn-checkout-split">

        {/* ── Settings form ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── Pagos ── */}
          <div className="cn-section">
            <div className="cn-section-head">
              <div className="cn-section-icon">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM2 9v5a2 2 0 002 2h12a2 2 0 002-2V9H2zm4 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"/>
                </svg>
              </div>
              <div>
                <div className="cn-section-title">Metodos de pago</div>
                <div className="cn-section-sub">Activa los metodos que aceptas y agrega tus datos</div>
              </div>
            </div>
            <div className="cn-section-body" style={{ padding: '12px 20px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {methods.map(m => (
                  <div key={m.id} style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                    <div
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => setOpenMethod(prev => prev === m.id ? null : m.id)}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#64748B', flexShrink: 0 }}>
                        {m.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: m.enabled ? '#7C3AED' : '#94A3B8' }}>{m.enabled ? 'Activo' : 'Inactivo'}</div>
                      </div>
                      <label className="cn-toggle" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={m.enabled} onChange={e => setMethods(prev => prev.map(x => x.id === m.id ? { ...x, enabled: e.target.checked } : x))} />
                        <span className="cn-toggle-track" />
                      </label>
                    </div>
                    {openMethod === m.id && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: m.fields.length > 2 ? '1fr 1fr' : '1fr', gap: 12 }}>
                          {m.fields.map(f => (
                            <div key={f.key} className="cn-field" style={{ marginBottom: 0 }}>
                              <div className="cn-label">{f.label}</div>
                              <input
                                className="cn-input"
                                placeholder={f.placeholder}
                                value={m.values[f.key] ?? ''}
                                onChange={e => setMethods(prev => prev.map(x => x.id === m.id ? { ...x, values: { ...x.values, [f.key]: e.target.value } } : x))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {pagosError && <div className="cn-error" style={{ marginTop: 12 }}>{pagosError}</div>}
              {successPagos && <div className="cn-success" style={{ marginTop: 12 }}>Metodos de pago guardados.</div>}
              <div className="cn-actions">
                <button type="button" className="cn-save-btn" onClick={savePagos} disabled={savingPagos}>
                  {savingPagos ? 'Guardando...' : 'Guardar metodos de pago'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Checkout settings ── */}
          <form onSubmit={saveSettings}>
            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="cn-section-title">Campos del formulario</div>
                  <div className="cn-section-sub">Que datos solicitar al comprador</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Nombre del cliente</div>
                    <div className="cn-toggle-hint">Pedir el nombre completo al hacer el pedido</div>
                  </div>
                  <Toggle checked={settings.requireName} onChange={v => setSetting('requireName', v)} />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Telefono del cliente</div>
                    <div className="cn-toggle-hint">Util para contactar y coordinar la entrega</div>
                  </div>
                  <Toggle checked={settings.requirePhone} onChange={v => setSetting('requirePhone', v)} />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Direccion de entrega</div>
                    <div className="cn-toggle-hint">Activar si haces domicilios</div>
                  </div>
                  <Toggle checked={settings.requireAddress} onChange={v => setSetting('requireAddress', v)} />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Notas del pedido</div>
                    <div className="cn-toggle-hint">Permite que el cliente agregue instrucciones especiales</div>
                  </div>
                  <Toggle checked={settings.allowNotes} onChange={v => setSetting('allowNotes', v)} />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Metodo de pago obligatorio</div>
                    <div className="cn-toggle-hint">El cliente debe seleccionar o escribir su forma de pago para confirmar</div>
                  </div>
                  <Toggle checked={settings.requirePaymentMethod} onChange={v => setSetting('requirePaymentMethod', v)} />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Comprobante de pago obligatorio</div>
                    <div className="cn-toggle-hint">El cliente debe subir una foto del comprobante antes de confirmar</div>
                  </div>
                  <Toggle checked={settings.requirePaymentProof} onChange={v => setSetting('requirePaymentProof', v)} />
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5 10.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10-1a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
                    <path d="M5.5 10.5L8 7h1.5L10 5.5h2.5L13 7.5l1.5-1.5h2v2L14.5 10.5H5.5z"/>
                  </svg>
                </div>
                <div>
                  <div className="cn-section-title">Tipo de entrega</div>
                  <div className="cn-section-sub">Metodos de entrega que ofreces</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Domicilio</div>
                    <div className="cn-toggle-hint">El pedido se entrega en la direccion del cliente</div>
                  </div>
                  <Toggle
                    checked={settings.deliveryTypes.delivery}
                    onChange={v => setSettings(s => ({ ...s, deliveryTypes: { ...s.deliveryTypes, delivery: v } }))}
                  />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Retiro en tienda</div>
                    <div className="cn-toggle-hint">El cliente viene a buscar su pedido</div>
                  </div>
                  <Toggle
                    checked={settings.deliveryTypes.pickup}
                    onChange={v => setSettings(s => ({ ...s, deliveryTypes: { ...s.deliveryTypes, pickup: v } }))}
                  />
                </div>
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Envio nacional</div>
                    <div className="cn-toggle-hint">El pedido se envia a otra ciudad o estado por encomienda</div>
                  </div>
                  <Toggle
                    checked={settings.deliveryTypes.national}
                    onChange={v => setSettings(s => ({ ...s, deliveryTypes: { ...s.deliveryTypes, national: v } }))}
                  />
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="cn-section-title">Reglas del pedido</div>
                  <div className="cn-section-sub">Minimo de compra y envio</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-field">
                  <div className="cn-label">Monto minimo de pedido (USD)</div>
                  <div className="cn-prefix-wrap">
                    <span className="cn-prefix">$</span>
                    <input className="cn-prefix-input" type="number" min="0" step="0.01"
                      value={settings.minOrder} onChange={e => setSetting('minOrder', e.target.value)}
                      placeholder="0.00 — sin minimo" />
                  </div>
                </div>
                <div className="cn-toggle-row" style={{ marginTop: 16 }}>
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Cobrar envio</div>
                    <div className="cn-toggle-hint">Agrega un costo fijo de delivery al pedido</div>
                  </div>
                  <Toggle checked={settings.deliveryEnabled} onChange={v => setSetting('deliveryEnabled', v)} />
                </div>
                {settings.deliveryEnabled && (
                  <div className="cn-field" style={{ marginTop: 12 }}>
                    <div className="cn-label">Costo de envio (USD)</div>
                    <div className="cn-prefix-wrap">
                      <span className="cn-prefix">$</span>
                      <input className="cn-prefix-input" type="number" min="0" step="0.01"
                        value={settings.deliveryFee} onChange={e => setSetting('deliveryFee', e.target.value)}
                        placeholder="2.00" />
                    </div>
                  </div>
                )}
                <div className="cn-toggle-row" style={{ marginTop: 16 }}>
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Mostrar conversion a Bs</div>
                    <div className="cn-toggle-hint">Agrega una linea con el total en bolivares (tasa BCV) debajo del total en el resumen del pedido</div>
                  </div>
                  <Toggle checked={settings.showBcvInSummary} onChange={v => setSetting('showBcvInSummary', v)} />
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a8 8 0 105.29 14.006c.19-.17.281-.42.244-.669a.75.75 0 00-.652-.652 2.5 2.5 0 01-2.13-2.607 2.5 2.5 0 012.5-2.328h1.038a2.25 2.25 0 002.209-1.836A8.008 8.008 0 0010 2zM4.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm2-4.5a1 1 0 102 0 1 1 0 00-2 0zm5 0a1 1 0 102 0 1 1 0 00-2 0zM13 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <div className="cn-section-title">Color de acentos</div>
                  <div className="cn-section-sub">Botones, metodo de pago seleccionado y demas, solo dentro del checkout</div>
                </div>
              </div>
              <div className="cn-section-body">
                <button
                  type="button"
                  className={`cn-pill-btn${!settings.accentColor ? ' selected' : ''}`}
                  onClick={() => setSetting('accentColor', '')}
                  style={{ marginBottom: 12 }}
                >
                  Igual que la tienda
                </button>
                <div className="cn-colors">
                  {ACCENT_PRESETS.map(c => (
                    <div
                      key={c}
                      className={`cn-color-swatch${settings.accentColor === c ? ' selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setSetting('accentColor', c)}
                    />
                  ))}
                  <label
                    className="cn-color-custom"
                    style={{ background: settings.accentColor && !ACCENT_PRESETS.includes(settings.accentColor) ? settings.accentColor : undefined }}
                  >
                    {!settings.accentColor || ACCENT_PRESETS.includes(settings.accentColor) ? '+' : null}
                    <input
                      type="color"
                      value={settings.accentColor || '#7C3AED'}
                      onChange={e => setSetting('accentColor', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="cn-section">
              <div className="cn-section-head">
                <div className="cn-section-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <div className="cn-section-title">Boton de WhatsApp</div>
                  <div className="cn-section-sub">Boton flotante en tu tienda para que los clientes te contacten</div>
                </div>
              </div>
              <div className="cn-section-body">
                <div className="cn-toggle-row">
                  <div className="cn-toggle-info">
                    <div className="cn-toggle-label">Mostrar boton flotante</div>
                    <div className="cn-toggle-hint">Aparece en la esquina inferior derecha con el mensaje &quot;Tienes alguna duda?&quot;</div>
                  </div>
                  <Toggle checked={settings.whatsappFloating} onChange={v => setSetting('whatsappFloating', v)} />
                </div>
                {settings.whatsappFloating && !storeWhatsapp && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 10, fontSize: 13, color: '#713F12' }}>
                    Debes configurar tu numero de WhatsApp en la seccion de perfil de la tienda para que el boton funcione.
                  </div>
                )}
                {settings.whatsappFloating && storeWhatsapp && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, fontSize: 13, color: '#166534' }}>
                    El boton enlazara a: wa.me/{storeWhatsapp.replace(/\D/g, '')}
                  </div>
                )}
              </div>
            </div>

            {settingsError && <div className="cn-error">{settingsError}</div>}
            {success && <div className="cn-success">Configuracion de checkout guardada.</div>}
            <div className="cn-actions">
              <button type="submit" className="cn-save-btn" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar checkout'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Live preview ── */}
        <div className="cn-checkout-preview-col" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vista previa</div>
            <button
              type="button"
              onClick={() => setPreviewKey(k => k + 1)}
              title="Actualizar vista previa"
              style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 002.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0112.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <CheckoutPreview storeSlug={storeSlug} previewKey={previewKey} />
        </div>

      </div>
    </div>
  )
}
