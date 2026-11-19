'use client'

import { useEffect, useRef, useState } from 'react'

// Débito inmediato (BNC) for an order that was just created with it: the
// customer picks their bank, gives their cédula and phone (or account), their
// bank texts them a code, and they type it here to pay. Everything goes
// through /api/pay/debito — the amount comes from the order on the server.

export type BankDebitResult = { outcome: 'paid' | 'unknown' | 'cancelled'; reference?: string | null }

// Banks in Venezuela's national payment system (code → name)
const BANKS: [string, string][] = [
  ['0102', 'Banco de Venezuela'], ['0134', 'Banesco'], ['0105', 'Mercantil'], ['0108', 'BBVA Provincial'],
  ['0191', 'BNC'], ['0172', 'Bancamiga'], ['0114', 'Bancaribe'], ['0115', 'Banco Exterior'],
  ['0104', 'Venezolano de Crédito'], ['0151', 'BFC Fondo Común'], ['0174', 'Banplus'], ['0171', 'Banco Activo'],
  ['0138', 'Banco Plaza'], ['0163', 'Banco del Tesoro'], ['0175', 'Banco Digital de los Trabajadores'], ['0169', 'R4 Banco Microfinanciero'],
  ['0128', 'Banco Caroní'], ['0137', 'Sofitasa'], ['0156', '100% Banco'], ['0157', 'DelSur'],
  ['0166', 'Banco Agrícola de Venezuela'], ['0168', 'Bancrecer'], ['0177', 'Banfanb'], ['0146', 'Bangente'],
  ['0173', 'Banco Internacional de Desarrollo'], ['0178', 'N58 Banco Digital'],
]

// 0414 1234567 / 414… / 58414… → 584141234567, as BNC wants it
const phone12 = (d: string) => (d.startsWith('58') ? d : d.startsWith('0') ? `58${d.slice(1)}` : `58${d}`)
const fmtBs = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function api(body: Record<string, unknown>) {
  // (a dropped connection is an answer too, so no step is left hanging)
  const r = await fetch('/api/pay/debito', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
    .catch(() => null)
  if (!r) return { status: 0, ok: false, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' } as { status: number; ok: boolean; error?: string; amount?: number; paid?: boolean; reference?: string | null; unknown?: boolean; sent?: boolean; confirming?: boolean }
  const j = await r.json().catch(() => ({})) as Record<string, unknown>
  return { status: r.status, ok: r.ok, ...j } as { status: number; ok: boolean; error?: string; amount?: number; paid?: boolean; reference?: string | null; unknown?: boolean; sent?: boolean; confirming?: boolean }
}

type Step = 'form' | 'code' | 'charging' | 'confirming' | 'paid' | 'unknown'

// after the bank starts the debit, how long to keep asking for its final status
const CONFIRM_EVERY_MS = 4000
const CONFIRM_TRIES = 40

export default function BankDebit({ orderId, phone, kiosk, onDone }: {
  orderId: string; phone: string; kiosk: boolean; onDone: (r: BankDebitResult) => void
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [bank, setBank] = useState('')
  const [idType, setIdType] = useState('V')
  const [idNumber, setIdNumber] = useState('')
  const [accType, setAccType] = useState<'CELE' | 'CNTA'>('CELE')
  const [account, setAccount] = useState(phone.replace(/\D/g, ''))
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [reference, setReference] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(onDone)
  useEffect(() => { doneRef.current = onDone }, [onDone])

  useEffect(() => {
    let alive = true
    api({ action: 'quote', orderId }).then(r => {
      if (!alive) return
      if (r.paid) { setStep('paid'); return }
      if (r.ok && typeof r.amount === 'number') setAmount(r.amount)
      else setError(r.error || 'No se pudo preparar el pago')
    })
    return () => { alive = false }
  }, [orderId])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
    if (step !== 'paid') return
    const t = setTimeout(() => doneRef.current({ outcome: 'paid', reference }), 1600)
    return () => clearTimeout(t)
  }, [step, reference])

  async function sendToken() {
    setBusy(true); setError('')
    const r = await api({ action: 'token', orderId, bank, idType, idNumber, accType, account })
    setBusy(false)
    if (r.paid) { setStep('paid'); return }
    if (!r.ok) { setError(r.error || 'No se pudo pedir el código'); return }
    if (typeof r.amount === 'number') setAmount(r.amount)
    setCode(''); setStep('code'); setResendIn(30)
  }

  async function pay() {
    setBusy(true); setError(''); setStep('charging')
    const r = await api({ action: 'charge', orderId, code })
    setBusy(false)
    if (r.paid) { setReference(r.reference ?? null); setStep('paid'); return }
    if (r.confirming) { setReference(r.reference ?? null); setStep('confirming'); return }
    if (r.unknown) { setError(r.error || ''); setStep('unknown'); return }
    setError(r.error || 'El banco no aprobó el pago'); setStep('code')
  }

  // the debit was started: ask for its final status until the bank decides
  useEffect(() => {
    if (step !== 'confirming') return
    let alive = true
    let tries = 0
    const tick = async () => {
      if (!alive) return
      tries++
      const r = await api({ action: 'status', orderId })
      if (!alive) return
      if (r.paid) { setReference(r.reference ?? null); setStep('paid'); return }
      if (r.status === 422) { setError(r.error || 'El banco no aprobó el pago'); setCode(''); setStep('code'); return }
      if (r.status === 0 && tries < CONFIRM_TRIES) { setTimeout(tick, CONFIRM_EVERY_MS); return }
      if (r.unknown || tries >= CONFIRM_TRIES) { setError(r.unknown ? (r.error || '') : ''); setStep('unknown'); return }
      setTimeout(tick, CONFIRM_EVERY_MS)
    }
    const t = setTimeout(tick, CONFIRM_EVERY_MS)
    return () => { alive = false; clearTimeout(t) }
  }, [step, orderId])

  async function cancel() {
    if (!window.confirm('¿Cancelar el pago? Tu pedido no se enviará.')) return
    setBusy(true)
    const r = await api({ action: 'cancel', orderId })
    setBusy(false)
    if (r.paid) { setStep('paid'); return }
    if (!r.ok && r.status === 409 && /procesando/i.test(r.error ?? '')) { setError(r.error!); return }
    onDone({ outcome: 'cancelled' })
  }

  const accDigits = account.replace(/\D/g, '')
  const formOk = bank.length === 4 && idNumber.replace(/\D/g, '').length >= 5 &&
    (accType === 'CELE' ? phone12(accDigits).length === 12 : accDigits.length === 20)

  return (
    <div className={`sf-debit-overlay${kiosk ? ' kiosk' : ''}`} role="dialog" aria-modal="true" aria-label="Pagar con Débito inmediato">
      <div className="sf-debit-sheet">
        <div className="sf-debit-head">
          <div className="sf-debit-title">Débito inmediato</div>
          <div className="sf-debit-amount">{amount !== null ? `Bs ${fmtBs(amount)}` : '…'}</div>
        </div>

        {step === 'form' && (
          <>
            <div className="sf-debit-sub">Te llegará un código de tu banco por SMS para autorizar el pago.</div>
            <label className="sf-debit-field">
              <span>Tu banco</span>
              <select value={bank} onChange={e => setBank(e.target.value)}>
                <option value="">Elige tu banco</option>
                {BANKS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="sf-debit-field">
              <span>Cédula del titular</span>
              <div className="sf-debit-row">
                <select value={idType} onChange={e => setIdType(e.target.value)} className="sf-debit-idtype">
                  {['V', 'E', 'J', 'P', 'G'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input inputMode="numeric" autoComplete="off" placeholder="12345678" value={idNumber} onChange={e => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} />
              </div>
            </label>
            <div className="sf-debit-tabs">
              <button type="button" className={accType === 'CELE' ? 'on' : ''} onClick={() => { setAccType('CELE'); setAccount(phone.replace(/\D/g, '')) }}>Con mi teléfono</button>
              <button type="button" className={accType === 'CNTA' ? 'on' : ''} onClick={() => { setAccType('CNTA'); setAccount('') }}>Con mi cuenta</button>
            </div>
            <label className="sf-debit-field">
              <span>{accType === 'CELE' ? 'Teléfono afiliado a tu banco' : 'Número de cuenta (20 dígitos)'}</span>
              <input inputMode="numeric" autoComplete="off" placeholder={accType === 'CELE' ? '0414 1234567' : '0102…'}
                value={account} onChange={e => setAccount(e.target.value.replace(/[^\d ]/g, '').slice(0, accType === 'CELE' ? 14 : 24))} />
            </label>
            {error && <div className="sf-debit-error">{error}</div>}
            <button type="button" className="sf-debit-main" disabled={!formOk || busy || amount === null} onClick={sendToken}>
              {busy ? 'Pidiendo código…' : 'Enviarme el código'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="sf-debit-sub">Escribe el código que te envió tu banco.</div>
            <input ref={codeRef} className="sf-debit-code" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••••"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={e => { if (e.key === 'Enter' && code.length >= 4 && !busy) pay() }} />
            {error && <div className="sf-debit-error">{error}</div>}
            <button type="button" className="sf-debit-main" disabled={code.length < 4 || busy} onClick={pay}>
              {amount !== null ? `Pagar Bs ${fmtBs(amount)}` : 'Pagar'}
            </button>
            <div className="sf-debit-links">
              <button type="button" disabled={resendIn > 0 || busy} onClick={sendToken}>{resendIn > 0 ? `Reenviar código (${resendIn})` : 'Reenviar código'}</button>
              <button type="button" disabled={busy} onClick={() => { setStep('form'); setError('') }}>Cambiar datos</button>
            </div>
          </>
        )}

        {step === 'charging' && (
          <div className="sf-debit-wait">
            <div className="sf-debit-spinner" />
            <div>Procesando el pago con tu banco…</div>
            <div className="sf-debit-sub">Puede tardar hasta 2 minutos. No cierres esta pantalla.</div>
          </div>
        )}

        {step === 'confirming' && (
          <div className="sf-debit-wait">
            <div className="sf-debit-spinner" />
            <div>Confirmando el pago con tu banco…</div>
            <div className="sf-debit-sub">Tu banco ya recibió la orden. Esperamos su confirmación final, no cierres esta pantalla.</div>
          </div>
        )}

        {step === 'paid' && (
          <div className="sf-debit-wait">
            <div className="sf-debit-check">✓</div>
            <div className="sf-debit-ok">¡Pago aprobado!</div>
            {reference && <div className="sf-debit-sub">Referencia {reference}</div>}
          </div>
        )}

        {step === 'unknown' && (
          <div className="sf-debit-wait">
            <div className="sf-debit-ok">Pago en verificación</div>
            <div className="sf-debit-sub">{error || 'No pagues otra vez: la tienda confirmará cuando llegue el pago.'}</div>
            <button type="button" className="sf-debit-main" onClick={() => onDone({ outcome: 'unknown' })}>Entendido</button>
          </div>
        )}

        {(step === 'form' || step === 'code') && (
          <button type="button" className="sf-debit-cancel" disabled={busy} onClick={cancel}>Cancelar pago</button>
        )}
      </div>
    </div>
  )
}
