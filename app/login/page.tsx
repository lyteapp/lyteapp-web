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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: store } = await supabase.from('stores').select('id').eq('owner_id', session.user.id).maybeSingle()
      router.replace(store ? '/dashboard' : '/onboarding/negocio')
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
        const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
        router.push(store ? '/dashboard' : '/onboarding/negocio')
      }
    }
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <Link href="/" className="login-logo">
          <div className="login-logo-text">Lyte<span>app</span></div>
        </Link>

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

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar al panel →'}
          </button>
        </form>

        <p className="login-signup" style={{ marginTop: 28 }}>
          ¿No tienes cuenta? <Link href="/registro">Créala acá, es gratis →</Link>
        </p>
      </div>
    </div>
  )
}
