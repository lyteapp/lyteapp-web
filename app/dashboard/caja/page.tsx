'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import './caja.css'

export default function CajaPage() {
  const { user } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [storeId, setStoreId]     = useState<string | null>(null)
  const [checkoutSettings, setCheckoutSettings] = useState<Record<string, unknown>>({})
  const [cajeras, setCajeras]     = useState<{ id: string; name: string; pin: string }[]>([])
  const [newName, setNewName]     = useState('')
  const [newPin, setNewPin]       = useState('')
  const [cajerasSaving, setCajerasSaving] = useState(false)
  const [copied, setCopied]       = useState(false)
  const [showQr, setShowQr]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)
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
        setCajeras((cs.cajeros as { id: string; name: string; pin: string }[]) ?? [])
      }
      setLoading(false)
    })
  }, [user])

  async function addCajera() {
    if (!storeId || !newName.trim() || !newPin.trim()) return
    setCajerasSaving(true)
    const next = [...cajeras, { id: crypto.randomUUID(), name: newName.trim(), pin: newPin.trim() }]
    const newCs = { ...checkoutSettings, cajeros: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setCajeras(next)
    setNewName('')
    setNewPin('')
    setCajerasSaving(false)
    showToast('Cajera agregada')
  }

  async function removeCajera(id: string) {
    if (!storeId) return
    const next = cajeras.filter(c => c.id !== id)
    const newCs = { ...checkoutSettings, cajeros: next }
    await supabase.from('stores').update({ checkout_settings: newCs }).eq('id', storeId)
    setCheckoutSettings(newCs)
    setCajeras(next)
    showToast('Cajera eliminada')
  }

  function copyCajeroLink() {
    if (!cajeroUrl) return
    navigator.clipboard.writeText(cajeroUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado')
  }

  const cajeroUrl = storeId ? `https://lyte-app.com/cajero/${storeId}` : ''

  if (loading) return <div className="cx-spinner-wrap"><div className="cx-spinner" /></div>

  return (
    <div className="cx-root">
      <div className="cx-view cx-cierre-view">

        {/* Link */}
        <div className="cx-breakdown-section">
          <div className="cx-breakdown-title">Link de acceso para cajeros</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>
            Comparte este link con tus cajeros o escanea el QR desde el dispositivo de caja.
          </div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>
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

        {/* Cajeras */}
        <div className="cx-breakdown-section">
          <div className="cx-breakdown-title">Cajeras</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>
            Cada cajera tiene su propio PIN. Al ingresar, la app muestra su nombre en el encabezado.
          </div>

          {cajeras.length > 0 && (
            <table className="cx-breakdown-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>PIN</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cajeras.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ fontFamily: 'monospace', letterSpacing: '0.1em', color: '#64748B' }}>{'•'.repeat(c.pin.length)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => removeCajera(c.id)}
                        style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: '2px 6px' }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>NOMBRE</div>
              <input
                type="text"
                placeholder="Ej: Maria"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>PIN</div>
              <input
                type="password"
                inputMode="numeric"
                placeholder="1234"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCajera()}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }}
              />
            </div>
            <button
              onClick={addCajera}
              disabled={cajerasSaving || !newName.trim() || !newPin.trim()}
              style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: cajerasSaving ? 0.6 : 1, flexShrink: 0 }}
            >
              Agregar
            </button>
          </div>
        </div>

      </div>

      {/* ── QR MODAL ── */}
      {showQr && cajeroUrl && (
        <div onClick={() => setShowQr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>App de cajero</div>
            <QRCodeSVG value={cajeroUrl} size={220} bgColor="#ffffff" fgColor="#0F172A" />
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', wordBreak: 'break-all' }}>{cajeroUrl}</div>
            <button onClick={() => setShowQr(false)} style={{ width: '100%', background: '#F1F5F9', color: '#0F172A', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="cx-toast">
          <span className="cx-toast-check">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </span>
          {toast}
        </div>
      )}
    </div>
  )
}
