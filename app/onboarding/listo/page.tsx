'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ListoPage() {
  const router = useRouter()
  const [slug, setSlug] = useState('')

  useEffect(() => {
    setSlug(localStorage.getItem('ob_slug') ?? '')
  }, [])

  return (
    <div className="ob-screen" style={{ justifyContent: 'center' }}>
      <div className="ob-brand" style={{ position: 'absolute', top: 48, left: 48 }}>
        Lyte<span style={{ color: '#7C3AED' }}>app</span>
      </div>

      <div className="ob-card" style={{ textAlign: 'center', maxWidth: 480 }}>
        <div className="ob-celebrate">
          <h1 className="ob-celebrate-title">Tu tienda está lista</h1>
          <p className="ob-celebrate-sub">
            Configuraste todo lo que necesitas para empezar a vender hoy mismo. Comparte tu link y los pedidos empiezan a llegar.
          </p>

          {slug && (
            <Link href={`/${slug}`} target="_blank" className="ob-celebrate-store">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
              lyte-app.com/{slug}
            </Link>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <button
              className="ob-btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: 15 }}
              onClick={() => router.push('/dashboard')}
            >
              Ir a mi dashboard →
            </button>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
              Agrega más productos, configura métodos de pago y ve tus pedidos desde ahí.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
