'use client'

import { useEffect, useState } from 'react'

// The kitchen display's "Cobrado": when Caja falls behind, the kitchen can
// mark a counter payment (cash / point of sale) collected — but only with a
// cashier's own PIN, typed on this on-screen keypad. /api/caja checks it and
// records which cashier it was ("… · desde cocina").

export default function CajaPinPad({ storeId, order, onClose, onDone }: {
  storeId: string
  order: { id: string; order_number?: number | null; customer_name: string; total: number; payment_method: string | null }
  onClose: () => void
  onDone: (cashier: string | null) => void
}) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const press = (d: string) => { if (busy) return; setError(''); setPin(p => (p.length < 8 ? p + d : p)) }
  const back = () => { if (!busy) setPin(p => p.slice(0, -1)) }

  async function submit() {
    if (!pin || busy) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cajero-pin': pin },
        body: JSON.stringify({ orderId: order.id, storeId, status: 'approved', source: 'kitchen' }),
      })
      const j = await r.json().catch(() => ({})) as { ok?: boolean; by?: string | null; error?: string }
      if (r.ok && j.ok) { onDone(j.by ?? null); return }
      setError(r.status === 401 ? 'PIN incorrecto' : (j.error || 'No se pudo marcar como cobrado'))
      setPin(''); setShake(true); setTimeout(() => setShake(false), 450)
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    }
    setBusy(false)
  }

  // a hardware keyboard works too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
      else if (e.key === 'Enter') submit()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="pd-pin-overlay" onClick={onClose}>
      <div className={`pd-pin-card${shake ? ' shake' : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="PIN de caja">
        <div className="pd-pin-title">Marcar cobrado</div>
        <div className="pd-pin-sub">
          #{order.order_number ?? order.id.slice(0, 8).toUpperCase()} · {order.customer_name} · ${Number(order.total).toFixed(2)}
          {order.payment_method ? ` · ${order.payment_method}` : ''}
        </div>
        <div className="pd-pin-label">PIN de caja</div>
        <div className="pd-pin-dots" aria-live="polite">
          {pin.length === 0 ? <span className="pd-pin-hint">Escribe el PIN</span> : pin.split('').map((_, i) => <span key={i} className="pd-pin-dot" />)}
        </div>
        {error && <div className="pd-pin-error">{error}</div>}
        <div className="pd-pin-keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} type="button" className="pd-pin-key" onClick={() => press(d)}>{d}</button>
          ))}
          <button type="button" className="pd-pin-key fn" onClick={back} aria-label="Borrar">⌫</button>
          <button type="button" className="pd-pin-key" onClick={() => press('0')}>0</button>
          <button type="button" className="pd-pin-key ok" disabled={!pin || busy} onClick={submit}>{busy ? '…' : 'OK'}</button>
        </div>
        <button type="button" className="pd-pin-cancel" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
