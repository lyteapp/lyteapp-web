'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import './admin.css'

interface StoreRow {
  id: string; name: string; slug: string; created_at: string
  owner_email: string | null
  orders_last_30d: number
  revenue_last_30d: number
}

interface LoginRow { email: string | null; last_sign_in_at: string | null }

interface Stats {
  totalUsers: number
  totalStores: number
  signupsByDay: Record<string, number>
  recentLogins: LoginRow[]
  stores: StoreRow[]
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const [status, setStatus] = useState<'loading' | 'no-session' | 'forbidden' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    // Always attempt the request — even without a Supabase session, the
    // browser may already carry a valid Face ID (passkey) session cookie.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        const json = await res.json()
        if (res.status === 401) { setStatus('no-session'); return }
        if (res.status === 403) { setSessionEmail(json.email ?? session?.user.email ?? ''); setStatus('forbidden'); return }
        if (!res.ok) { setErrorMsg(json.error ?? 'Error desconocido'); setStatus('error'); return }
        setStats(json)
        setStatus('ready')
      } catch (err) {
        setErrorMsg(String(err))
        setStatus('error')
      }
    })
  }, [])

  if (status === 'loading') return <div className="adm-center">Cargando...</div>

  if (status === 'no-session') {
    return (
      <div className="adm-center">
        <p>Debes iniciar sesion primero.</p>
        <Link href="/login" className="adm-btn">Ir a iniciar sesion</Link>
      </div>
    )
  }

  if (status === 'forbidden') {
    return (
      <div className="adm-center">
        <p>No tienes acceso a este panel.</p>
        <p style={{ fontSize: 13, color: '#94A3B8' }}>Sesion actual: {sessionEmail || 'desconocido'}</p>
      </div>
    )
  }

  if (status === 'error') {
    return <div className="adm-center">Error: {errorMsg}</div>
  }

  const s = stats!
  const days = Object.keys(s.signupsByDay).sort().slice(-14)
  const maxSignups = Math.max(1, ...days.map(d => s.signupsByDay[d]))
  const today = new Date().toISOString().slice(0, 10)
  const todaySignups = s.signupsByDay[today] ?? 0
  const last7Signups = days.slice(-7).reduce((sum, d) => sum + (s.signupsByDay[d] ?? 0), 0)

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div>
          <div className="adm-title">Panel de LyteApp</div>
          <div className="adm-sub">Vista de plataforma — todas las tiendas y usuarios</div>
        </div>
        <Link href="/dashboard" className="adm-btn adm-btn-ghost">Ir a mi dashboard</Link>
      </div>

      <div className="adm-cards">
        <div className="adm-card">
          <div className="adm-card-label">Tiendas registradas</div>
          <div className="adm-card-value">{s.totalStores}</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">Usuarios registrados</div>
          <div className="adm-card-value">{s.totalUsers}</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">Altas hoy</div>
          <div className="adm-card-value">{todaySignups}</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">Altas ultimos 7 dias</div>
          <div className="adm-card-value">{last7Signups}</div>
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section-title">Altas por dia (ultimos 14 dias)</div>
        <div className="adm-bars">
          {days.map(d => (
            <div key={d} className="adm-bar-col">
              <div
                className="adm-bar"
                style={{ height: `${Math.max(4, (s.signupsByDay[d] / maxSignups) * 100)}%` }}
                title={`${d}: ${s.signupsByDay[d]}`}
              />
              <div className="adm-bar-label">{d.slice(5)}</div>
            </div>
          ))}
          {days.length === 0 && <div className="adm-empty">Sin datos todavia</div>}
        </div>
      </div>

      <div className="adm-grid">
        <div className="adm-section">
          <div className="adm-section-title">Ultimos inicios de sesion</div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Correo</th><th>Fecha</th></tr></thead>
              <tbody>
                {s.recentLogins.map((l, i) => (
                  <tr key={i}><td>{l.email}</td><td>{fmtDate(l.last_sign_in_at)}</td></tr>
                ))}
                {s.recentLogins.length === 0 && <tr><td colSpan={2} className="adm-empty-row">Sin datos todavia</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="adm-section">
          <div className="adm-section-title">Tiendas ({s.stores.length})</div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Tienda</th><th>Dueño</th><th>Creada</th><th>Pedidos (30d)</th><th>Ingresos (30d)</th></tr></thead>
              <tbody>
                {s.stores.map(store => (
                  <tr key={store.id}>
                    <td><a href={`/${store.slug}`} target="_blank" rel="noreferrer">{store.name}</a></td>
                    <td>{store.owner_email ?? '—'}</td>
                    <td>{fmtDate(store.created_at)}</td>
                    <td>{store.orders_last_30d}</td>
                    <td>${store.revenue_last_30d.toFixed(2)}</td>
                  </tr>
                ))}
                {s.stores.length === 0 && <tr><td colSpan={5} className="adm-empty-row">Sin tiendas todavia</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
