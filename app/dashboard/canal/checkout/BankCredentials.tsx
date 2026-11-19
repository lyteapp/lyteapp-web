'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Checkout → Métodos de pago: where a store keeps the credentials its own
// bank gives it for charging by API (BNC's Débito inmediato first). The
// secret goes straight to the server (/api/bank-credentials) and never comes
// back: once saved, this only shows "connected, ends in 1234". The checkout
// charges with them when the "Débito inmediato (BNC)" method is on.

type Status = {
  connected: boolean
  environment?: 'sandbox' | 'production'
  clientId?: string | null
  childClientId?: string | null
  branchId?: string | null
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

export default function BankCredentials({ storeId, onConnected }: { storeId: string | null; onConnected?: (connected: boolean) => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [editing, setEditing] = useState(false)
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [clientId, setClientId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [childClientId, setChildClientId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const apply = useCallback((s: Status | Error) => {
    if (s instanceof Error) {
      setStatus({ connected: false })
      onConnected?.(false)
      setError(s.message === 'No autorizado' ? 'Solo el dueño de la tienda puede ver y cambiar estas credenciales.' : s.message)
      return
    }
    setStatus(s)
    onConnected?.(!!s.connected && !!s.clientId)
    setEnvironment(s.environment ?? 'sandbox')
    setChildClientId(s.childClientId ?? '')
    setBranchId(s.branchId ?? '')
  }, [onConnected])
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
      await call('PUT', '/api/bank-credentials', { storeId, provider: 'bnc', environment, clientId, apiKey, childClientId, branchId })
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
      setEditing(false); setApiKey(''); setClientId(''); setChildClientId(''); setBranchId('')
      await load()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  async function test() {
    if (!storeId) return
    setTesting(true); setError(''); setTestOk(false)
    try { await call('POST', '/api/bank-credentials', { storeId, action: 'test' }); setTestOk(true) }
    catch (e) { setError((e as Error).message) }
    setTesting(false)
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
        Cada tienda usa sus propias credenciales: las que BNC le dio a este comercio para cobrar a su propia cuenta por Débito inmediato. Quedan guardadas cifradas en el servidor: nunca se muestran ni se envían al navegador. Para cobrar, activa también el método &quot;Débito inmediato (BNC)&quot; arriba.
      </div>

      {connected && !editing && (
        <div className="cn-bank-summary">
          {status?.clientId && <div><span>ClientGUID</span><strong>{status.clientId}</strong></div>}
          <div><span>MasterKey</span><strong>•••• {status?.keyEnding}</strong></div>
          {status?.childClientId && <div><span>ChildClientID</span><strong>{status.childClientId}</strong></div>}
          {status?.branchId && <div><span>BranchID</span><strong>{status.branchId}</strong></div>}
          {when && <div><span>Guardado</span><strong>{when}</strong></div>}
          <div className="cn-bank-actions">
            <button type="button" className="cn-pill-btn" disabled={testing} onClick={test}>{testing ? 'Probando…' : 'Probar conexión'}</button>
            <button type="button" className="cn-pill-btn" onClick={() => { setEditing(true); setSaved(false); setTestOk(false) }}>Cambiar</button>
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
            <div className="cn-label">ClientGUID</div>
            <input className="cn-input" autoComplete="off" spellCheck={false} value={clientId} onChange={e => setClientId(e.target.value)}
              placeholder={connected ? 'Déjalo vacío para mantener el actual' : 'Ej: 4A074C46-DD4E-4E54-8010-B80A6A8758F4'} />
          </div>
          <div className="cn-field">
            <div className="cn-label">MasterKey</div>
            <input className="cn-input" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={connected ? 'Déjala vacía para mantener la actual' : 'La llave maestra que te dio el banco'} />
          </div>
          <div className="cn-field">
            <div className="cn-label">ChildClientID <span style={{ fontWeight: 400, color: '#94A3B8' }}>(solo si BNC te lo indicó)</span></div>
            <input className="cn-input" autoComplete="off" spellCheck={false} value={childClientId} onChange={e => setChildClientId(e.target.value)} placeholder="RIF del asociado, ej: J000000000" />
          </div>
          <div className="cn-field">
            <div className="cn-label">BranchID <span style={{ fontWeight: 400, color: '#94A3B8' }}>(solo si BNC te lo indicó)</span></div>
            <input className="cn-input" autoComplete="off" spellCheck={false} value={branchId} onChange={e => setBranchId(e.target.value)} placeholder="Código de sucursal, ej: CCS001" />
          </div>
          <div className="cn-bank-actions">
            <button type="button" className="cn-save-btn" disabled={busy || (!connected && (!apiKey.trim() || !clientId.trim()))} onClick={save}>
              {busy ? 'Guardando…' : 'Guardar credenciales'}
            </button>
            {connected && <button type="button" className="cn-pill-btn" onClick={() => { setEditing(false); setApiKey(''); setClientId(''); setError('') }}>Cancelar</button>}
          </div>
        </div>
      )}

      {error && <div className="cn-error" style={{ marginTop: 12 }}>{error}</div>}
      {saved && <div className="cn-success" style={{ marginTop: 12 }}>Credenciales guardadas. Usa &quot;Probar conexión&quot; para verificarlas.</div>}
      {testOk && <div className="cn-success" style={{ marginTop: 12 }}>BNC aceptó las credenciales. La conexión funciona.</div>}
    </div>
  )
}
