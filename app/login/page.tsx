'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import './login.css'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login')
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: stores } = await supabase.from('stores').select('id').eq('owner_id', session.user.id).limit(1)
      router.replace(stores && stores.length > 0 ? '/dashboard' : '/onboarding/negocio')
    })
  }, [])

  async function handleLogin(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos. Verifica e intenta de nuevo.')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: stores } = await supabase.from('stores').select('id').eq('owner_id', user.id).limit(1)
        router.push(stores && stores.length > 0 ? '/dashboard' : '/onboarding/negocio')
      }
    }
    setLoading(false)
  }

  async function handleForgot(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else setMode('sent')
    setResetLoading(false)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <Link href="/" className="login-logo">
          <div className="login-logo-text">Lyte<span>app</span></div>
        </Link>

        {mode === 'login' && (
          <>
            <h1 className="login-title">Bienvenido<br />de vuelta.</h1>
            <p className="login-sub">Ingresa a tu panel para gestionar tu negocio.</p>

            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tucorreo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="login-field">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="button"
                className="login-forgot"
                onClick={() => { setError(''); setMode('forgot') }}
              >
                ¿Olvidaste tu contraseña?
              </button>

              {error && <div className="login-error">{error}</div>}

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar al panel →'}
              </button>
            </form>

            <p className="login-signup" style={{ marginTop: 28 }}>
              ¿No tienes cuenta? <Link href="/registro">Créala acá, es gratis →</Link>
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h1 className="login-title">Recupera tu<br />contraseña.</h1>
            <p className="login-sub">Te enviamos un link a tu correo para crear una nueva contraseña.</p>

            <form onSubmit={handleForgot}>
              <div className="login-field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tucorreo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {error && <div className="login-error">{error}</div>}

              <button type="submit" className="btn-login" disabled={resetLoading}>
                {resetLoading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </form>

            <p className="login-signup" style={{ marginTop: 28 }}>
              <button type="button" className="login-back" onClick={() => { setError(''); setMode('login') }}>
                ← Volver a iniciar sesión
              </button>
            </p>
          </>
        )}

        {mode === 'sent' && (
          <>
            <h1 className="login-title">Revisa tu<br />correo.</h1>
            <p className="login-sub">
              Si existe una cuenta con <strong>{email}</strong>, te enviamos un link para restablecer tu contraseña. Revisa también la carpeta de spam.
            </p>

            <p className="login-signup" style={{ marginTop: 8 }}>
              <button type="button" className="login-back" onClick={() => { setError(''); setMode('login') }}>
                ← Volver a iniciar sesión
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
