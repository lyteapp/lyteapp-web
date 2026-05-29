'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export default function CajaPage() {
  const { user } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [storeId, setStoreId]   = useState<string | null>(null)
  const [checkoutSettings, setCheckoutSettings] = useState<Record<string, unknown>>({})
  const [pinInput, setPinInput] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [showQr, setShowQr]     = useState(false)
  const [toast, setToast]       = useState<string | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  useEffect(() => {
    if (!user) return
    supabase.from('stores').select('id, checkout_settings').eq('owner_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setStoreId(data.id)
        const cs = (data.checkout_settings as Record<string, unknown>) ?? {}
        setCheckoutSettings(cs)
        setPinInput((cs.cajeroPIN as string) ?? '')
      }
      setLoading(false)
    })
  }, [user])

  async function savePin() {
    if (!storeId) return
    setPinSaving(true)
    const newCs = { ...checkoutSettings, cajeroPIN: pinInput.trim() }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setPinSaving(false)
    showToast(pinInput.trim() ? 'PIN guardado' : 'PIN eliminado')
  }

  function copyCajeroLink() {
    if (!cajeroUrl) return
    navigator.clipboard.writeText(cajeroUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
  }

  const cajeroUrl = storeId ? `https://lyte-app.com/cajero/${storeId}` : ''

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>App de cajero</div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
          Configura el acceso para tus cajeros. La app es independiente del dashboard.
        </div>
      </div>

      {/* ── LINK ── */}
      <div style={{ background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Link de acceso
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
          Comparte este link con tus cajeros o escanea el QR desde el dispositivo de caja.
        </div>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#475569', fontFamily: 'monospace', marginBottom: 10, wordBreak: 'break-all' }}>
          {cajeroUrl}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copyCajeroLink}
            style={{
              flex: 1, background: copied ? '#10B981' : '#7C3AED', color: 'white',
              border: 'none', borderRadius: 8, padding: '9px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
          >
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
          <button
            onClick={() => setShowQr(true)}
            title="Ver QR"
            style={{
              background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd"/>
              <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM15 13a1 1 0 10-2 0v3a1 1 0 102 0v-3zM11 19a1 1 0 110-2h2a1 1 0 110 2h-2z"/>
            </svg>
          </button>
          <a
            href={cajeroUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 500,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
            </svg>
            Abrir
          </a>
        </div>
      </div>

      {/* ── PIN ── */}
      <div style={{ background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          PIN de acceso
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
          Protege la app con un PIN numerico. Dejalo en blanco para acceso sin PIN.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            inputMode="numeric"
            placeholder="Sin PIN (acceso libre)"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && savePin()}
            style={{
              flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 8,
              padding: '9px 12px', fontSize: 14, outline: 'none',
              fontFamily: 'inherit', color: '#0F172A', background: '#F8FAFC',
            }}
          />
          <button
            onClick={savePin}
            disabled={pinSaving}
            style={{
              background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', opacity: pinSaving ? 0.6 : 1,
            }}
          >
            {pinSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── QR MODAL ── */}
      {showQr && cajeroUrl && (
        <div
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: '28px 28px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              maxWidth: 320, width: '100%',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>App de cajero</div>
            <QRCodeSVG value={cajeroUrl} size={220} bgColor="#ffffff" fgColor="#0F172A" />
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', wordBreak: 'break-all' }}>
              {cajeroUrl}
            </div>
            <button
              onClick={() => setShowQr(false)}
              style={{
                width: '100%', background: '#F1F5F9', color: '#0F172A', border: 'none',
                borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: 'white', padding: '10px 18px', borderRadius: 100,
          fontSize: 13, fontWeight: 500, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
          {toast}
        </div>
      )}
    </div>
  )
}
