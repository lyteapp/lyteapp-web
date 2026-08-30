'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { supabase } from '../lib/supabase'
import './portal.css'

export default function PortalPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [supported, setSupported] = useState(true)
  const [canRegister, setCanRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSupported(browserSupportsWebAuthn()), 0)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCanRegister(!!session)
      setReady(true)
    })
    return () => clearTimeout(t)
  }, [])

  async function handleFaceIdLogin() {
    setBusy(true); setMsg('')
    try {
      const optionsRes = await fetch('/api/admin/passkey/auth-options', { method: 'POST' })
      const { options, error: optErr } = await optionsRes.json()
      if (!optionsRes.ok) throw new Error(optErr ?? 'No se pudo iniciar la verificacion')

      const authResponse = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/admin/passkey/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse }),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok || !result.verified) throw new Error(result.error ?? 'No se pudo verificar')

      router.push('/admin')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo iniciar sesion con Face ID')
    }
    setBusy(false)
  }

  async function handleRegister() {
    setBusy(true); setMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Inicia sesion primero en /login')

      const optionsRes = await fetch('/api/admin/passkey/register-options', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const optionsJson = await optionsRes.json()
      if (!optionsRes.ok) throw new Error(optionsJson.error ?? 'No autorizado')

      const regResponse = await startRegistration({ optionsJSON: optionsJson.options })

      const verifyRes = await fetch('/api/admin/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ response: regResponse, deviceName: navigator.userAgent.slice(0, 60) }),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok || !result.verified) throw new Error(result.error ?? 'No se pudo registrar')

      setMsg('Dispositivo registrado. Ya puedes entrar con Face ID desde aqui.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo registrar el dispositivo')
    }
    setBusy(false)
  }

  if (!ready) return <div className="pt-center">Cargando...</div>

  return (
    <div className="pt-page">
      <div className="pt-card">
        <div className="pt-logo">Lyte<span>app</span></div>
        <h1 className="pt-title">Acceso privado</h1>

        {!supported ? (
          <p className="pt-msg">Este navegador no soporta Face ID / llaves de acceso.</p>
        ) : (
          <>
            <button className="pt-btn pt-btn-primary" onClick={handleFaceIdLogin} disabled={busy}>
              {busy ? 'Verificando...' : 'Entrar con Face ID'}
            </button>

            {canRegister ? (
              <button className="pt-btn pt-btn-ghost" onClick={handleRegister} disabled={busy}>
                {busy ? 'Procesando...' : 'Registrar este dispositivo'}
              </button>
            ) : (
              <p className="pt-hint">
                ¿Primera vez en este dispositivo? Inicia sesion normal en{' '}
                <Link href="/login">/login</Link> y vuelve a esta pagina para registrar tu Face ID.
              </p>
            )}

            {msg && <p className="pt-msg">{msg}</p>}
          </>
        )}
      </div>
    </div>
  )
}
