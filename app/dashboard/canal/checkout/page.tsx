'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

interface CheckoutSettings {
  requireName: boolean; requirePhone: boolean; requireAddress: boolean
  allowNotes: boolean; minOrder: string; deliveryEnabled: boolean; deliveryFee: string
  deliveryTypes: { delivery: boolean; pickup: boolean }
}

const DEFAULTS: CheckoutSettings = {
  requireName: true, requirePhone: true, requireAddress: false,
  allowNotes: true, minOrder: '', deliveryEnabled: false, deliveryFee: '',
  deliveryTypes: { delivery: true, pickup: false },
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
  { name: 'Hamburguesa clásica', price: 8.50, qty: 1, image: null },
  { name: 'Papas fritas',        price: 3.00, qty: 2, image: null },
]

function CheckoutPreview({ settings }: { settings: CheckoutSettings }) {
  const bothTypes    = settings.deliveryTypes.delivery && settings.deliveryTypes.pickup
  const onlyPickup   = !settings.deliveryTypes.delivery && settings.deliveryTypes.pickup
  const [previewType, setPreviewType] = useState<'delivery' | 'pickup'>(onlyPickup ? 'pickup' : 'delivery')
  const subtotal = MOCK_ITEMS.reduce((s, i) => s + i.price * i.qty, 0)
  const fee      = previewType === 'delivery' && settings.deliveryEnabled && settings.deliveryFee ? Number(settings.deliveryFee) : 0
  const total    = subtotal + fee

  return (
    <div style={{
      width: 300, flexShrink: 0,
      border: '10px solid #1E1E2E', borderRadius: 36,
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      overflow: 'hidden', background: '#F8F7F4',
      maxHeight: 620, display: 'flex', flexDirection: 'column',
    }}>
      {/* Phone status bar */}
      <div style={{ background: 'white', padding: '10px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0F172A' }}>9:41</span>
        <div style={{ width: 90, height: 10, borderRadius: 10, background: '#1E1E2E' }} />
        <span style={{ fontSize: 10, color: '#0F172A' }}>●●●</span>
      </div>

      {/* Nav bar */}
      <div style={{ background: 'white', padding: '8px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg viewBox="0 0 20 20" fill="#64748B" width="14" height="14"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', flex: 1, textAlign: 'center', marginRight: 14 }}>Tu pedido</span>
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary section */}
        <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>Resumen</span>
            <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>Vaciar</span>
          </div>
          {MOCK_ITEMS.map(item => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F1F5F9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>${(item.price * item.qty).toFixed(2)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F8FAFC', borderRadius: 6, padding: '2px 6px' }}>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>−</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0F172A', minWidth: 10, textAlign: 'center' }}>{item.qty}</span>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>+</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#64748B' }}>Subtotal</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#0F172A' }}>${subtotal.toFixed(2)}</span>
          </div>
          {fee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#64748B' }}>Envio</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#0F172A' }}>${fee.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Total</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0F172A' }}>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Delivery type selector */}
        {(bothTypes || settings.deliveryTypes.delivery || settings.deliveryTypes.pickup) && (
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Tipo de entrega</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {settings.deliveryTypes.delivery && (
                <button
                  type="button"
                  onClick={() => setPreviewType('delivery')}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: previewType === 'delivery' ? '#EDE9FE' : '#F8FAFC',
                    outline: `2px solid ${previewType === 'delivery' ? '#7C3AED' : '#E2E8F0'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg viewBox="0 0 20 20" fill={previewType === 'delivery' ? '#7C3AED' : '#94A3B8'} width="16" height="16">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5 10.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm10-1a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
                    <path d="M5.5 10.5L8 7h1.5L10 5.5h2.5L13 7.5l1.5-1.5h2v2L14.5 10.5H5.5z"/>
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: previewType === 'delivery' ? 700 : 500, color: previewType === 'delivery' ? '#7C3AED' : '#64748B' }}>Domicilio</span>
                </button>
              )}
              {settings.deliveryTypes.pickup && (
                <button
                  type="button"
                  onClick={() => setPreviewType('pickup')}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: previewType === 'pickup' ? '#EDE9FE' : '#F8FAFC',
                    outline: `2px solid ${previewType === 'pickup' ? '#7C3AED' : '#E2E8F0'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg viewBox="0 0 20 20" fill={previewType === 'pickup' ? '#7C3AED' : '#94A3B8'} width="16" height="16">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 4H2v7a2 2 0 002 2h12a2 2 0 002-2V8zm-8 3a1 1 0 011 1v2a1 1 0 01-2 0v-2a1 1 0 011-1z" clipRule="evenodd"/>
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: previewType === 'pickup' ? 700 : 500, color: previewType === 'pickup' ? '#7C3AED' : '#64748B' }}>Retiro en tienda</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Customer info section */}
        <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Tus datos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {settings.requireName && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 2 }}>Nombre completo</div>
                <div style={{ height: 8, width: '60%', background: '#E2E8F0', borderRadius: 3 }} />
              </div>
            )}
            {settings.requirePhone && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 2 }}>Telefono</div>
                <div style={{ height: 8, width: '40%', background: '#E2E8F0', borderRadius: 3 }} />
              </div>
            )}
            {settings.requireAddress && previewType === 'delivery' && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 2 }}>Direccion de entrega</div>
                <div style={{ height: 8, width: '70%', background: '#E2E8F0', borderRadius: 3 }} />
              </div>
            )}
            {settings.allowNotes && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 2 }}>Notas <span style={{ color: '#CBD5E1' }}>· Opcional</span></div>
                <div style={{ height: 18, width: '80%', background: '#E2E8F0', borderRadius: 3 }} />
              </div>
            )}
          </div>
        </div>

        {/* Submit button */}
        <div style={{ background: '#0F172A', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
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

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('checkout_settings')
          .eq('owner_id', user!.id)
          .maybeSingle()
        if (store?.checkout_settings) setSettings({ ...DEFAULTS, ...store.checkout_settings })
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

  return (
    <div className="cn-page" style={{ maxWidth: 'none' }}>
      <div className="cn-header">
        <div className="cn-title">Checkout</div>
        <div className="cn-desc">Configura el proceso de compra de tu tienda.</div>
      </div>

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>

        {/* ── Settings form ── */}
        <form onSubmit={saveSettings} style={{ flex: 1, minWidth: 0 }}>
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

          {settingsError && <div className="cn-error">{settingsError}</div>}
          {success && <div className="cn-success">Configuracion de checkout guardada.</div>}
          <div className="cn-actions">
            <button type="submit" className="cn-save-btn" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar checkout'}
            </button>
          </div>
        </form>

        {/* ── Live preview ── */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vista previa</div>
          <CheckoutPreview settings={settings} />
        </div>

      </div>
    </div>
  )
}
