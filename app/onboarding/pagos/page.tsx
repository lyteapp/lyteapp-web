'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const STEPS = 6

const METHODS = [
  { id: 'pago_movil',      icon: 'PM', name: 'Pago Móvil',         sub: 'Banco, cédula y teléfono' },
  { id: 'zelle',           icon: 'ZL', name: 'Zelle',              sub: 'Transferencia en USD' },
  { id: 'efectivo_usd',    icon: 'EF', name: 'Efectivo USD',        sub: 'Al momento de entrega' },
  { id: 'efectivo_bs',     icon: 'Bs', name: 'Efectivo Bs',         sub: 'Bolívares en mano' },
  { id: 'usdt',            icon: 'CR', name: 'USDT / Cripto',       sub: 'TRC20, BEP20' },
  { id: 'binance',         icon: 'BN', name: 'Binance Pay',         sub: 'Pago por QR' },
  { id: 'transferencia',   icon: 'TB', name: 'Transferencia Bs',   sub: 'Banco a banco' },
  { id: 'punto_venta',     icon: 'PV', name: 'Punto de venta',      sub: 'Tarjeta débito / crédito' },
]

export default function PagosOnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleNext() {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const { data: store } = await supabase
        .from('stores').select('id').eq('owner_id', user.id).maybeSingle()
      if (store && selected.length > 0) {
        const pm: Record<string, { enabled: boolean; values: Record<string, string> }> = {}
        for (const id of selected) pm[id] = { enabled: true, values: {} }
        await supabase.from('stores').update({ payment_methods: pm }).eq('id', store.id)
      }
      router.push('/onboarding/listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
    setSaving(false)
  }

  return (
    <div className="ob-screen">
      <div className="ob-brand">Lyte<span>app</span></div>

      <div className="ob-progress">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className={`ob-dot ${i === 4 ? 'active' : i < 4 ? 'done' : ''}`} />
        ))}
      </div>

      <div className="ob-card">
        <div className="ob-step-label">Paso 5 de {STEPS}</div>
        <h1 className="ob-title">¿Cómo cobras?</h1>
        <p className="ob-sub">Selecciona los métodos de pago que aceptas. Puedes activar y configurar cada uno desde la sección de Configuración más tarde.</p>

        <div className="ob-payment-grid">
          {METHODS.map(m => (
            <button
              key={m.id}
              className={`ob-payment-chip${selected.includes(m.id) ? ' selected' : ''}`}
              onClick={() => toggle(m.id)}
            >
              <div>
                <div className="ob-pay-name">{m.name}</div>
                <div className="ob-pay-sub">{m.sub}</div>
              </div>
              <div className="ob-payment-check">
                {selected.includes(m.id) && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path strokeLinecap="round" strokeLinejoin="round" d="M2 8l4 4 8-8"/></svg>}
              </div>
            </button>
          ))}
        </div>

        {error && <div className="ob-error">{error}</div>}

        <div className="ob-actions">
          <button className="ob-btn-skip" onClick={handleNext} disabled={saving}>
            Omitir por ahora
          </button>
          <button
            className="ob-btn-primary"
            onClick={handleNext}
            disabled={saving || selected.length === 0}
          >
            {saving ? 'Guardando...' : 'Continuar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
