'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Checkout → Métodos de pago: where a store keeps the credentials its own
// bank gives it for charging by API (BNC's Débito inmediato first). The
// secret goes straight to the server (/api/bank-credentials) and never comes
// back: once saved, this only shows "connected, ends in 1234". It doesn't
// turn anything on in the checkout yet — that comes with the bank's docs.

type Status = {
  connected: boolean
  environment?: 'sandbox' | 'production'
  clientId?: string | null
  terminal?: string | null
  keyEnding?: string | null
  updatedAt?: string
}

async function call(method: string, path: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'No se pudo completar')
  return j
}

export default function BankCredentials({ storeId }: { storeId: string | null }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [editing, setEditing] = useState(false)
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [clientId, setClientId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [terminal, setTerminal] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const apply = useCallback((s: Status | Error) => {
    if (s instanceof Error) {
      setStatus({ connected: false })
      setError(s.message === 'No autorizado' ? 'Solo el dueño de la tienda puede ver y cambiar estas credenciales.' : s.message)
      return
    }
    setStatus(s)
    setEnvironment(s.environment ?? 'sandbox')
    setTerminal(s.terminal ?? '')
  }, [])
  const fetchStatus = useCallback((): Promise<Status | Error> => (storeId
    ? call('GET', `/api/bank-credentials?storeId=${storeId}&provider=bnc`).then(s => s as Status, e => e as Error)
    : Promise.resolve({ connected: false })), [storeId])
  const load = useCallback(() => fetchStatus().then(apply), [fetchStatus, apply])
  useEffect(() => {
    let alive = true
    fetchStatus().then(s => { if (alive) apply(s) })
    return () => { alive = false }
  }, [fetchStatus, apply])

  async function save() {
    if (!storeId) return
    setBusy(true); setError(''); setSaved(false)
    try {
      await call('PUT', '/api/bank-credentials', { storeId, provider: 'bnc', environment, clientId, apiKey, terminal })
      setApiKey(''); setClientId(''); setEditing(false); setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await load()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  async function remove() {
    if (!storeId || !window.confirm('¿Quitar las credenciales de BNC de esta tienda?')) return
    setBusy(true); setError('')
    try {
      await call('DELETE', `/api/bank-credentials?storeId=${storeId}&provider=bnc`)
      setEditing(false); setApiKey(''); setClientId(''); setTerminal('')
      await load()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  const connected = !!status?.connected
  const showForm = !connected || editing
  const when = status?.updatedAt ? new Date(status.updatedAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="cn-bank">
      <div className="cn-bank-head">
        <div className="cn-bank-logo">BNC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cn-bank-title">Débito inmediato · BNC</div>
          <div className="cn-bank-sub">
            {connected
              ? <span className="cn-bank-ok">Conectado · {status?.environment === 'production' ? 'Cobros reales' : 'Pruebas (sandbox)'}</span>
              : 'Sin conectar'}
          </div>
        </div>
      </div>

      <div className="cn-toggle-hint" style={{ marginTop: 10 }}>
        Guarda aquí las credenciales que te dio el banco para cobrar por Débito inmediato. Quedan guardadas cifradas en el servidor: nunca se muestran ni se envían al navegador. El cobro en el checkout se activa cuando terminemos la conexión con el banco.
      </div>

      {connected && !editing && (
        <div className="cn-bank-summary">
          <div><span>Clave</span><strong>•••• {status?.keyEnding}</strong></div>
          {status?.clientId && <div><span>Identificador</span><strong>{status.clientId}</strong></div>}
          {status?.terminal && <div><span>Terminal</span><strong>{status.terminal}</strong></div>}
          {when && <div><span>Guardado</span><strong>{when}</strong></div>}
          <div className="cn-bank-actions">
            <button type="button" className="cn-pill-btn" onClick={() => { setEditing(true); setSaved(false) }}>Cambiar</button>
            <button type="button" className="cn-pill-btn cn-bank-remove" disabled={busy} onClick={remove}>Quitar</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="cn-bank-form">
          <div className="cn-label">Ambiente</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button type="button" className={`cn-pill-btn${environment === 'sandbox' ? ' selected' : ''}`} onClick={() => setEnvironment('sandbox')}>Pruebas (sandbox)</button>
            <button type="button" className={`cn-pill-btn${environment === 'production' ? ' selected' : ''}`} onClick={() => setEnvironment('production')}>Cobros reales</button>
          </div>
          <div className="cn-field">
            <div className="cn-label">Clave / API key</div>
            <input className="cn-input" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={connected ? 'Déjala vacía para mantener la actual' : 'La clave que te dio el banco'} />
          </div>
          <div className="cn-field">
            <div className="cn-label">Identificador de cliente <span style={{ fontWeight: 400, color: '#94A3B8' }}>(si el banco te dio uno)</span></div>
            <input className="cn-input" autoComplete="off" spellCheck={false} value={clientId} onChange={e => setClientId(e.target.value)}
              placeholder={connected && status?.clientId ? 'Déjalo vacío para quitarlo, o escríbelo de nuevo' : 'Ej: Client ID / ClientGUID'} />
          </div>
          <div className="cn-field">
            <div className="cn-label">Terminal o afiliación <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></div>
            <input className="cn-input" autoComplete="off" spellCheck={false} value={terminal} onChange={e => setTerminal(e.target.value)} placeholder="Si el banco te dio uno" />
          </div>
          <div className="cn-bank-actions">
            <button type="button" className="cn-save-btn" disabled={busy || (!connected && !apiKey.trim())} onClick={save}>
              {busy ? 'Guardando…' : 'Guardar credenciales'}
            </button>
            {connected && <button type="button" className="cn-pill-btn" onClick={() => { setEditing(false); setApiKey(''); setClientId(''); setError('') }}>Cancelar</button>}
          </div>
        </div>
      )}

      {error && <div className="cn-error" style={{ marginTop: 12 }}>{error}</div>}
      {saved && <div className="cn-success" style={{ marginTop: 12 }}>Credenciales guardadas.</div>}
    </div>
  )
}
