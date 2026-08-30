'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import './registro.css'

type Step = 'email' | 'code' | 'password'

export default function Registro() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step === 'code') inputRefs.current[0]?.focus()
  }, [step])

  async function sendCode(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!email.trim()) return
    if (!termsAccepted) { setError('Debes aceptar los términos y condiciones para continuar.'); return }
    setError('')
    setTermsAcceptedAt(new Date().toISOString())
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) {
      setError(error.message)
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  async function resendCode() {
    setResending(true)
    await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setResending(false)
  }

  function handleOtpInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleOtpKey(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    const next = [...otp]
    digits.split('').forEach((d, i) => { if (i < 6) next[i] = d })
    setOtp(next)
    inputRefs.current[Math.min(digits.length, 5)]?.focus()
  }

  async function verifyCode(e: { preventDefault(): void }) {
    e.preventDefault()
    const token = otp.join('')
    if (token.length < 6) { setError('Ingresa el código completo.'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) {
      setError('Código incorrecto o expirado. Revisa tu correo.')
      setLoading(false)
      return
    }
    setStep('password')
    setLoading(false)
  }

  async function setUserPassword(e: { preventDefault(): void }) {
    e.preventDefault()
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden.'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({
      password,
      data: { terms_accepted_at: termsAcceptedAt ?? new Date().toISOString(), terms_version: 'v1' },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/onboarding/negocio')
  }

  return (
    <div className="reg-screen">
      <div className="reg-card">
        <Link href="/" className="reg-logo">
          <div className="reg-logo-text">Lyte<span>app</span></div>
        </Link>

        {/* ── STEP 1: EMAIL ── */}
        {step === 'email' && (
          <>
            <div className="reg-badge">Gratis para siempre, sin tarjeta</div>
            <h1 className="reg-title">Empieza gratis.<br />Hoy mismo.</h1>
            <p className="reg-sub">Solo tu correo. Te mandamos un código de verificación.</p>

            <form onSubmit={sendCode}>
              <div className="reg-field">
                <label>Tu correo electrónico</label>
                <input
                  type="email"
                  placeholder="tucorreo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <label className="reg-terms-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>
                  He leído y acepto los <Link href="/terminos" target="_blank">Términos y Condiciones</Link> de LyteApp.
                </span>
              </label>

              {error && <div className="reg-error">{error}</div>}

              <button type="submit" className="btn-reg" disabled={loading || !termsAccepted}>
                <span>{loading ? 'Enviando código...' : 'Continuar →'}</span>
              </button>
            </form>

            <p className="reg-login">¿Ya tienes cuenta? <Link href="/login">Ingresa aquí →</Link></p>
          </>
        )}

        {/* ── STEP 2: CODE ── */}
        {step === 'code' && (
          <>
            <div className="reg-code-sent">
              <div className="reg-check">✓</div>
              <p>Código enviado a <strong>{email}</strong></p>
            </div>

            <h1 className="reg-title" style={{ fontSize: 22 }}>Revisa tu correo</h1>
            <p className="reg-sub">Ingresa el código de 6 dígitos. Expira en 10 minutos.</p>

            <form onSubmit={verifyCode}>
              <div className="otp-boxes" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    className="otp-box"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                  />
                ))}
              </div>

              {error && <div className="reg-error">{error}</div>}

              <button type="submit" className="btn-reg" disabled={loading}>
                <span>{loading ? 'Verificando...' : 'Verificar código →'}</span>
              </button>
            </form>

            <div className="reg-otp-footer">
              <button className="reg-back" onClick={() => { setStep('email'); setOtp(['','','','','','']); setError('') }}>
                ← Cambiar correo
              </button>
              <button className="reg-resend" onClick={resendCode} disabled={resending}>
                {resending ? 'Enviando...' : '¿No llegó? Reenviar'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: PASSWORD ── */}
        {step === 'password' && (
          <>
            <div className="reg-code-sent" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <div className="reg-check" style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981' }}>✓</div>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>Correo verificado — <strong style={{ color: 'white' }}>{email}</strong></p>
            </div>

            <h1 className="reg-title" style={{ fontSize: 22 }}>Crea tu contraseña</h1>
            <p className="reg-sub">Úsala cada vez que entres a tu panel. Mínimo 6 caracteres.</p>

            <form onSubmit={setUserPassword}>
              <div className="reg-field">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="reg-field">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <div className="reg-error">{error}</div>}

              <button type="submit" className="btn-reg" disabled={loading}>
                <span>{loading ? 'Creando cuenta...' : 'Crear mi cuenta →'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
