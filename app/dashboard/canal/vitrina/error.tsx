'use client'

import { useEffect } from 'react'

export default function VitrinaError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[Vitrina Error]', error)
  }, [error])

  return (
    <div style={{
      padding: '32px 24px',
      fontFamily: 'var(--font-geist-sans), sans-serif',
    }}>
      <div style={{
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '16px',
      }}>
        <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
          Error al cargar la página
        </div>
        <div style={{ fontSize: 13, color: '#7F1D1D', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {error.message}
        </div>
        {error.digest && (
          <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 8 }}>
            digest: {error.digest}
          </div>
        )}
      </div>
      <button
        onClick={unstable_retry}
        style={{
          background: '#0F172A',
          color: 'white',
          border: 'none',
          borderRadius: '100px',
          padding: '10px 20px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'var(--font-geist-sans), sans-serif',
        }}
      >
        Intentar de nuevo
      </button>
    </div>
  )
}
