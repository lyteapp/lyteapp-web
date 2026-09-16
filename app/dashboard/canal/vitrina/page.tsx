'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useDashboardStore } from '../../../lib/DashboardStoreProvider'
import './vitrina.css'

/* ── STORE PREVIEW ─────────────────────────────────────── */

function StorePizza() {
  return (
    <div className="vt-store vt-store-pizza">
      <div className="sh"><div className="sh-logo">Forno Lento</div><div className="sh-cart">2</div></div>
      <div className="s-hero">
        <div><div className="ht">Pizza al horno<br/>de leña</div><div className="hs">Masa madre · 48h</div></div>
        <div className="hbtn">Pedir</div>
      </div>
      <div className="s-tabs">
        <span className="s-tab active">Todas</span><span className="s-tab">Clásicas</span>
        <span className="s-tab">Especiales</span><span className="s-tab">Bebidas</span>
      </div>
      <div className="s-grid">
        <div className="s-item p1"><div className="ph"/><div className="info"><div className="nm">Margherita</div><div className="pr">$11,99</div></div></div>
        <div className="s-item p2"><div className="ph"/><div className="info"><div className="nm">Pepperoni</div><div className="pr">$13,50</div></div></div>
        <div className="s-item p3"><div className="ph"/><div className="info"><div className="nm">4 Quesos</div><div className="pr">$14,00</div></div></div>
        <div className="s-item p4"><div className="ph"/><div className="info"><div className="nm">Prosciutto</div><div className="pr">$15,90</div></div></div>
      </div>
    </div>
  )
}

/* ── PAGE ─────────────────────────────────────────────── */

export default function PaginaPage() {
  const router = useRouter()
  const { storeId } = useDashboardStore()
  const [saving, setSaving] = useState(false)

  async function handlePersonalizar() {
    setSaving(true)
    try {
      if (storeId) {
        await supabase.from('stores').update({ template: 'clasico' }).eq('id', storeId)
      }
    } catch {
      // silently handle save errors
    } finally {
      setSaving(false)
    }
    router.push('/dashboard/canal/vitrina/editor')
  }

  return (
    <div className="vt-wrap">

      <div className="vt-header">
        <div className="vt-eyebrow">Diseño · Página</div>
        <h1 className="vt-title">Tu tienda,<br />tu <em>estilo</em>.</h1>
        <p className="vt-sub">Personaliza el diseño de tu tienda.</p>
      </div>

      <div className="vt-grid">
        <article className="vt-card">
          <div className="vt-phone">
            <div className="vt-phone-notch"/>
            <div className="vt-phone-screen">
              <StorePizza />
            </div>
          </div>
        </article>
      </div>

      <button
        className="vt-personalizar active"
        onClick={handlePersonalizar}
        disabled={saving}
      >
        {saving ? 'Guardando…' : 'Personalizar'}
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
        </svg>
      </button>

    </div>
  )
}
