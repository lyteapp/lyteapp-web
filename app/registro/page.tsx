'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import './registro.css'

const LogoSVG = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="rc">
        <path d="M18 14Q14 14 14 18L14 82Q14 86 18 86L22 86Q26 86 30 84L84 54Q88 50 84 46L30 16Q26 14 22 14Z" />
      </clipPath>
    </defs>
    <rect x="0" y="0" width="100" height="100" fill="#4C1D95" clipPath="url(#rc)" />
    <polygon points="14,14 50,14 86,50 50,50" fill="#A78BFA" clipPath="url(#rc)" />
    <polygon points="50,14 86,50 50,86" fill="#7C3AED" clipPath="url(#rc)" opacity="0.92" />
  </svg>
)

export default function Registro() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegistro(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  return (
    <div className="reg-screen">
      <div className="reg-bg">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
      </div>

      {/* LEFT — pitch */}
      <div className="reg-left">
        <div className="reg-left-badge">
          <span className="dot" /> En vivo ahora
        </div>

        <h1 className="reg-left-title">
          Tu negocio.<br />
          <em>Listo en minutos.</em>
        </h1>

        <p className="reg-left-sub">
          Crea tu tienda en línea, recibe pedidos y cobra con los métodos que ya usan tus clientes — Pago Móvil, Zelle, USDT y más.
        </p>

        <div className="reg-features">
          <div className="reg-feature">
            <div className="reg-feature-icon">0%</div>
            Sin comisión por venta, para siempre
          </div>
          <div className="reg-feature">
            <div className="reg-feature-icon">⚡</div>
            Tu tienda lista en menos de 3 minutos
          </div>
          <div className="reg-feature">
            <div className="reg-feature-icon">📱</div>
            Pagos locales con verificación automática
          </div>
          <div className="reg-feature">
            <div className="reg-feature-icon">🛵</div>
            Gestión de repartidores con GPS incluida
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="reg-right">
        <div className="reg-card">
          <Link href="/" className="reg-logo">
            <LogoSVG />
            <div className="reg-logo-text">Lyte<span>app</span></div>
          </Link>

          {success ? (
            <div className="reg-success">
              <span className="reg-success-icon">✉️</span>
              <div className="reg-success-title">¡Ya casi estás!</div>
              <p className="reg-success-sub">
                Te enviamos un email de confirmación a <strong style={{ color: 'white' }}>{email}</strong>. Ábrelo y haz clic en el link para activar tu cuenta.
              </p>
              <Link href="/login" style={{ display: 'inline-block', marginTop: '24px', color: '#C4B5FD', fontSize: '14px', fontWeight: 500 }}>
                Ir al inicio de sesión →
              </Link>
            </div>
          ) : (
            <>
              <h1 className="reg-title">Crea tu cuenta gratis</h1>
              <p className="reg-sub">Sin tarjeta de crédito. Sin compromisos.</p>

              <form onSubmit={handleRegistro}>
                <div className="reg-field">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="tucorreo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                {error && <div className="reg-error">{error}</div>}

                <button type="submit" className="btn-reg" disabled={loading}>
                  <span>{loading ? 'Creando tu cuenta...' : 'Crear cuenta gratis →'}</span>
                </button>

                <p className="reg-terms">
                  Al registrarte aceptas nuestros términos de servicio y política de privacidad.
                </p>
              </form>

              <div className="reg-divider">o</div>

              <p className="reg-login">
                ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
