'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import '../canal.css'

interface CheckoutSettings {
  requireName: boolean; requirePhone: boolean; requireAddress: boolean
  allowNotes: boolean; minOrder: string; deliveryEnabled: boolean; deliveryFee: string
}

const DEFAULTS: CheckoutSettings = {
  requireName: true, requirePhone: true, requireAddress: false,
  allowNotes: true, minOrder: '', deliveryEnabled: false, deliveryFee: '',
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cn-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cn-toggle-track" />
    </label>
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
    <div className="cn-page">
      <div className="cn-header">
        <div className="cn-title">Checkout</div>
        <div className="cn-desc">Configura el proceso de compra de tu tienda.</div>
      </div>

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
    </div>
  )
}
