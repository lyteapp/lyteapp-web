'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import './login.css'

const LogoSVG = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="lc">
        <path d="M18 14Q14 14 14 18L14 82Q14 86 18 86L22 86Q26 86 30 84L84 54Q88 50 84 46L30 16Q26 14 22 14Z" />
      </clipPath>
    </defs>
    <rect x="0" y="0" width="100" height="100" fill="#4C1D95" clipPath="url(#lc)" />
    <polygon points="14,14 50,14 86,50 50,50" fill="#A78BFA" clipPath="url(#lc)" />
    <polygon points="50,14 86,50 50,86" fill="#7C3AED" clipPath="url(#lc)" opacity="0.92" />
  </svg>
)

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos.')
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="login-screen">
      <div className="login-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="login-card">
        <Link href="/" className="login-logo">
          <LogoSVG />
          <div className="login-logo-text">Lyte<span>app</span></div>
        </Link>

        <h1 className="login-title">Bienvenido<br />de vuelta</h1>
        <p className="login-sub">Entrá a tu panel de administración para gestionar tu negocio.</p>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="tucorreo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          <div className="login-row">
            <label className="remember">
              <input type="checkbox" defaultChecked /> Recordarme
            </label>
            <a href="#" className="forgot">¿Olvidaste tu contraseña?</a>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar al panel'}
            {!loading && (
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </form>

        <div className="login-divider">o</div>

        <p className="login-signup">
          ¿No tienes cuenta? <Link href="/registro">Registra tu negocio gratis →</Link>
        </p>
      </div>
    </div>
  )
}
