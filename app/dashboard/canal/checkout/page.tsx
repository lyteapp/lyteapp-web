'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

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
  deliveryTypes: { delivery: boolean; pickup: boolean }
  requirePaymentMethod: boolean; requirePaymentProof: boolean
  whatsappFloating: boolean
}

const DEFAULTS: CheckoutSettings = {
  requireName: true, requirePhone: true, requireAddress: false,
  allowNotes: true, minOrder: '', deliveryEnabled: false, deliveryFee: '',
  deliveryTypes: { delivery: true, pickup: false },
  requirePaymentMethod: false, requirePaymentProof: false,
  whatsappFloating: false,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cn-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cn-toggle-track" />
    </label>
  )
}

const MOCK_ITEMS = [
  { name: 'Hamburguesa clasica', price: 8.50, qty: 1, image: null },
  { name: 'Papas fritas',        price: 3.00, qty: 2, image: null },
]

const MOCK_PAYMENTS = ['Pago Movil', 'Zelle']

function PvField({ label, width = '65%' }: { label: string; width?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ background: '#F8F7F4', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, padding: '9px 10px' }}>
        <div style={{ height: 8, width, background: '#E2E8F0', borderRadius: 3 }} />
      </div>
    </div>
  )
}

function CheckoutPreview({ settings }: { settings: CheckoutSettings }) {
  const bothTypes  = settings.deliveryTypes.delivery && settings.deliveryTypes.pickup
  const onlyPickup = !settings.deliveryTypes.delivery && settings.deliveryTypes.pickup
  const [previewType, setPreviewType] = useState<'delivery' | 'pickup'>(onlyPickup ? 'pickup' : 'delivery')
  const [selPayment, setSelPayment]   = useState(MOCK_PAYMENTS[0])
  const subtotal = MOCK_ITEMS.reduce((s, i) => s + i.price * i.qty, 0)
  const fee      = previewType === 'delivery' && settings.deliveryEnabled && settings.deliveryFee ? Number(settings.deliveryFee) : 0
  const total    = subtotal + fee

  const sec: React.CSSProperties = {
    background: 'white', border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: 14, padding: '13px 14px',
  }
  const secTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#0F172A',
    letterSpacing: '-0.02em', marginBottom: 10,
  }

  return (
    <div style={{
      width: 300, flexShrink: 0,
      border: '10px solid #1E1E2E', borderRadius: 36,
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      overflow: 'hidden', background: '#F8F7F4',
      maxHeight: 640, display: 'flex', flexDirection: 'column',
    }}>
      {/* Status bar */}
      <div style={{ background: 'white', padding: '10px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0F172A' }}>9:41</span>
        <div style={{ width: 80, height: 10, borderRadius: 10, background: '#1E1E2E' }} />
        <span style={{ fontSize: 10, color: '#0F172A' }}>●●●</span>
      </div>

      {/* Nav */}
      <div style={{ background: 'white', padding: '9px 16px', borderBottom: '1px solid rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg viewBox="0 0 20 20" fill="#64748B" width="14" height="14"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', flex: 1, textAlign: 'center', marginRight: 14 }}>Tu pedido</span>
      </div>

      {/* Content */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Resumen ── */}
        <div style={sec}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={secTitle}>Resumen</span>
            <span style={{ fontSize: 9, color: '#EF4444', fontWeight: 600, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '3px 7px' }}>Vaciar</span>
          </div>
          {MOCK_ITEMS.map((item, idx) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: idx < MOCK_ITEMS.length - 1 ? 8 : 0, borderBottom: idx < MOCK_ITEMS.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none', marginBottom: idx < MOCK_ITEMS.length - 1 ? 8 : 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F1F5F9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginTop: 2 }}>${(item.price * item.qty).toFixed(2)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F8FAFC', borderRadius: 8, padding: '4px 8px' }}>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>−</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0F172A', minWidth: 10, textAlign: 'center' }}>{item.qty}</span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>+</span>
              </div>
            </div>
          ))}
          {fee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', marginTop: 8 }}>
              <span>Envio</span><span>${fee.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 6, borderTop: '2px solid #F1F5F9' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* ── Tipo de entrega ── */}
        {bothTypes && (
          <div style={sec}>
            <div style={secTitle}>Tipo de entrega</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['delivery', 'pickup'] as const).map(t => (
                <button key={t} type="button" onClick={() => setPreviewType(t)} style={{
                  flex: 1, padding: '9px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: previewType === t ? '#EDE9FE' : '#F8FAFC',
                  outline: `2px solid ${previewType === t ? '#7C3AED' : '#E2E8F0'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                }}>
                  {t === 'delivery'
                    ? <svg viewBox="0 0 20 20" fill={previewType === t ? '#7C3AED' : '#94A3B8'} width="16" height="16"><path fillRule="evenodd" clipRule="evenodd" d="M5 10.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10-1a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/><path d="M5.5 10.5L8 7h1.5L10 5.5h2.5L13 7.5l1.5-1.5h2v2L14.5 10.5H5.5z"/></svg>
                    : <svg viewBox="0 0 20 20" fill={previewType === t ? '#7C3AED' : '#94A3B8'} width="16" height="16"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 4H2v7a2 2 0 002 2h12a2 2 0 002-2V8zm-8 3a1 1 0 011 1v2a1 1 0 01-2 0v-2a1 1 0 011-1z" clipRule="evenodd"/></svg>
                  }
                  <span style={{ fontSize: 9, fontWeight: previewType === t ? 700 : 500, color: previewType === t ? '#7C3AED' : '#64748B' }}>
                    {t === 'delivery' ? 'Domicilio' : 'Retiro en tienda'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Ubicacion de entrega ── */}
        {previewType === 'delivery' && (
          <div style={sec}>
            <div style={secTitle}>Ubicacion de entrega <span style={{ color: '#EF4444' }}>*</span></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#7C3AED', color: 'white', borderRadius: 8, padding: '9px 12px', marginBottom: 8, fontSize: 10, fontWeight: 600 }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
              Compartir mi ubicacion GPS
            </div>
            <PvField label="Direccion de entrega" width="70%" />
          </div>
        )}

        {/* ── Tus datos ── */}
        <div style={sec}>
          <div style={secTitle}>Tus datos</div>
          {settings.requireName && <PvField label="Nombre completo" width="60%" />}
          {settings.requirePhone && <PvField label="Telefono" width="45%" />}
          {settings.allowNotes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notas <span style={{ fontWeight: 500, textTransform: 'none', color: '#94A3B8' }}>· Opcional</span></div>
              <div style={{ background: '#F8F7F4', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, padding: '9px 10px' }}>
                <div style={{ height: 8, width: '80%', background: '#E2E8F0', borderRadius: 3, marginBottom: 5 }} />
                <div style={{ height: 8, width: '50%', background: '#E2E8F0', borderRadius: 3 }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Metodo de pago ── */}
        <div style={sec}>
          <div style={secTitle}>Metodo de pago</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {MOCK_PAYMENTS.map(pm => (
              <div key={pm} onClick={() => setSelPayment(pm)} style={{
                border: `1.5px solid ${selPayment === pm ? '#7C3AED' : 'rgba(15,23,42,0.1)'}`,
                borderRadius: 11, padding: '10px 12px', cursor: 'pointer',
                background: selPayment === pm ? 'rgba(124,58,237,0.06)' : 'white',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 13, height: 13, borderRadius: '50%', flexShrink: 0, position: 'relative',
                  border: `2px solid ${selPayment === pm ? '#7C3AED' : '#CBD5E1'}`,
                  background: selPayment === pm ? '#7C3AED' : 'white',
                }}>
                  {selPayment === pm && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#0F172A' }}>{pm}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Confirmar ── */}
        <div style={{ background: '#7C3AED', borderRadius: 11, padding: '13px 14px', textAlign: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>Confirmar pedido · ${total.toFixed(2)}</span>
        </div>

      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const { user } = useAuth()
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
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeWhatsapp, setStoreWhatsapp] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('id,checkout_settings,payment_methods,whatsapp')
          .eq('owner_id', user!.id)
          .maybeSingle()
        if (!store) return
        setStoreId(store.id)
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
  }, [user])

  function setSetting<K extends keyof CheckoutSettings>(key: K, value: CheckoutSettings[K]) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  async function saveSettings(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    setSettingsError(''); setSuccess(false); setSaving(true)
    const { data: existing } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
    const { error: err } = existing
      ? await supabase.from('stores').update({ checkout_settings: settings }).eq('id', existing.id)
      : await supabase.from('stores').insert({ owner_id: user.id, checkout_settings: settings })
    if (err) setSettingsError(err.message)
    else setSuccess(true)
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
    setTimeout(() => setSuccessPagos(false), 3000)
  }

  return (
    <div className="cn-page" style={{ maxWidth: 'none' }}>
      <div className="cn-header">
        <div className="cn-title">Checkout</div>
        <div className="cn-desc">Configura el proceso de compra de tu tienda.</div>
      </div>

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>

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
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vista previa</div>
          <CheckoutPreview settings={settings} />
        </div>

      </div>
    </div>
  )
}
