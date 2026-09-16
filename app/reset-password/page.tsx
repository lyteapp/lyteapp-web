'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import '../login/login.css'

export default function ResetPassword() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    const timeout = setTimeout(() => setExpired(true), 5000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setDone(true)
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <Link href="/" className="login-logo">
          <div className="login-logo-text">Lyte<span>app</span></div>
        </Link>

        {done ? (
          <>
            <h1 className="login-title">Contraseña<br />actualizada.</h1>
            <p className="login-sub">Ya puedes entrar a tu panel con tu nueva contraseña.</p>
            <button type="button" className="btn-login" onClick={() => router.push('/dashboard')}>
              Ir al panel →
            </button>
          </>
        ) : !ready ? (
          expired ? (
            <>
              <h1 className="login-title">Link no<br />válido.</h1>
              <p className="login-sub">Este link para restablecer tu contraseña expiró o ya se usó. Solicita uno nuevo desde la pantalla de inicio de sesión.</p>
              <Link href="/login" className="btn-login" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                Volver a iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <h1 className="login-title">Cargando...</h1>
              <p className="login-sub">Verificando tu link de recuperación.</p>
            </>
          )
        ) : (
          <>
            <h1 className="login-title">Crea tu nueva<br />contraseña.</h1>
            <p className="login-sub">Elige una contraseña nueva para tu cuenta.</p>

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="login-field">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <div className="login-error">{error}</div>}

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
