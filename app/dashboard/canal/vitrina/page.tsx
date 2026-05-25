'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import './vitrina.css'

type TemplateId = 'clasico' | 'escaparate' | 'vitrina' | 'catalogo'

const TEMPLATES = [
  { id: 'clasico'   as TemplateId, namePrefix: 'El ', nameAccent: 'clásico',  tag: 'Hero + grid de productos'     },
  { id: 'escaparate'as TemplateId, namePrefix: 'El ', nameAccent: 'ligero',   tag: 'Destacado + lista compacta'   },
  { id: 'vitrina'   as TemplateId, namePrefix: 'El ', nameAccent: 'rápido',   tag: 'Producto estrella + grid'     },
  { id: 'catalogo'  as TemplateId, namePrefix: 'El ', nameAccent: 'catálogo', tag: 'Búsqueda + filtros + cards'   },
]

/* ── WIREFRAMES (reposo) ──────────────────────────────── */

function WfA() {
  return (
    <div className="vt-wf vt-wf-a">
      <div className="vt-wf-head"><div className="vt-wf-logo"/><div className="vt-wf-cart"/></div>
      <div className="vt-wf-hero"/>
      <div className="vt-wf-tabs">
        <span className="vt-wf-tab active"/><span className="vt-wf-tab"/><span className="vt-wf-tab"/><span className="vt-wf-tab"/>
      </div>
      <div className="vt-wf-grid">
        <div className="vt-wf-card"><span className="img"/><span className="p"/></div>
        <div className="vt-wf-card"><span className="img"/><span className="p"/></div>
        <div className="vt-wf-card"><span className="img"/><span className="p"/></div>
        <div className="vt-wf-card"><span className="img"/><span className="p"/></div>
      </div>
    </div>
  )
}

function WfB() {
  return (
    <div className="vt-wf vt-wf-b">
      <div className="vt-wf-head"><div className="vt-wf-logo"/><div className="vt-wf-cart"/></div>
      <div className="vt-wf-feat"><div className="vt-wf-feat-text"/></div>
      <div className="vt-wf-pair"><div className="vt-wf-mini"/><div className="vt-wf-mini"/></div>
      <div className="vt-wf-list">
        {[0,1,2].map(i => (
          <div key={i} className="vt-wf-row"><span className="i"/><div className="b"><span/><span/></div></div>
        ))}
      </div>
    </div>
  )
}

function WfC() {
  return (
    <div className="vt-wf vt-wf-c">
      <div className="vt-wf-head"><div className="vt-wf-logo"/><div className="vt-wf-cart"/></div>
      <div className="vt-wf-spot">
        <div className="vt-wf-spot-info"><span className="t"/><span className="b"/></div>
      </div>
      <div className="vt-wf-asym"><div className="big"/><div className="sm"/><div className="sm"/></div>
    </div>
  )
}

function WfD() {
  return (
    <div className="vt-wf vt-wf-d">
      <div className="vt-wf-head"><div className="vt-wf-logo"/><div className="vt-wf-cart"/></div>
      <div className="vt-wf-search"/>
      <div className="vt-wf-chips">
        <span className="vt-wf-chip"/><span className="vt-wf-chip"/><span className="vt-wf-chip"/><span className="vt-wf-chip"/>
      </div>
      <div className="vt-wf-cards">
        {[0,1,2].map(i => (
          <div key={i} className="vt-wf-cc"><span className="i"/><div className="b"><span className="t"/><span className="d"/><span className="p"/></div></div>
        ))}
      </div>
    </div>
  )
}

/* ── STORE PREVIEWS (hover) ───────────────────────────── */

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

function StoreSushi() {
  return (
    <div className="vt-store vt-store-sushi">
      <div className="sh"><div className="sh-logo">Niwa<span className="acc">.</span></div><div className="sh-cart">1</div></div>
      <div className="s-feat">
        <div className="feat-text">
          <div className="eb">Especial del chef</div>
          <div className="ft">Omakase<br/>de temporada</div>
        </div>
        <div className="fp">$32</div>
      </div>
      <div className="s-pair">
        <div className="s-mini m1"><div className="lbl">Nigiri</div></div>
        <div className="s-mini m2"><div className="lbl">Ramen</div></div>
      </div>
      <div className="s-list">
        <div className="s-row r1"><div className="i"/><div className="b"><div className="nm">Sashimi Salmón</div><div className="dc">8 piezas</div></div><div className="pr">$14</div></div>
        <div className="s-row r2"><div className="i"/><div className="b"><div className="nm">Roll Cangrejo</div><div className="dc">Aguacate, pepino</div></div><div className="pr">$12</div></div>
        <div className="s-row r3"><div className="i"/><div className="b"><div className="nm">Gyoza vapor</div><div className="dc">6 unidades</div></div><div className="pr">$9</div></div>
      </div>
    </div>
  )
}

function StoreFashion() {
  return (
    <div className="vt-store vt-store-fashion">
      <div className="sh"><div className="sh-logo">Cuarta Capa</div><div className="sh-cart">3</div></div>
      <div className="s-spot">
        <div className="tag">Drop 04</div>
        <div className="spot-info">
          <div className="ft">Cápsula<br/>otoño</div>
          <div className="pr">desde $89</div>
        </div>
        <div className="btn">Comprar →</div>
      </div>
      <div className="s-sec"><div className="l">Nuevos drops</div><div className="m">Ver todo</div></div>
      <div className="s-asym">
        <div className="big"/><div className="sm1"/><div className="sm2"/>
      </div>
    </div>
  )
}

function StoreMarket() {
  return (
    <div className="vt-store vt-store-market">
      <div className="sh"><div className="sh-logo">Vereda Fresca</div><div className="sh-cart">5</div></div>
      <div className="s-search"><div className="ph">Buscar productos...</div></div>
      <div className="s-chips">
        <span className="s-chip active">Todo</span><span className="s-chip">Frutas</span>
        <span className="s-chip">Panadería</span><span className="s-chip">Lácteos</span>
      </div>
      <div className="s-cards">
        <div className="s-cc c1"><div className="ph"/><div className="b"><div className="nm">Aguacate Hass</div><div className="dc">Maduro · unidad</div><div className="pr">$1,20</div></div><div className="add">+</div></div>
        <div className="s-cc c2"><div className="ph"/><div className="b"><div className="nm">Pan campesino</div><div className="dc">Recién horneado</div><div className="pr">$2,50</div></div><div className="add">+</div></div>
        <div className="s-cc c3"><div className="ph"/><div className="b"><div className="nm">Frutos rojos</div><div className="dc">Premium · 250g</div><div className="pr">$4,80</div></div><div className="add">+</div></div>
      </div>
    </div>
  )
}

function TemplateWireframe({ id }: { id: TemplateId }) {
  if (id === 'clasico')    return <WfA />
  if (id === 'escaparate') return <WfB />
  if (id === 'vitrina')    return <WfC />
  return <WfD />
}

function TemplateStore({ id }: { id: TemplateId }) {
  if (id === 'clasico')    return <StorePizza />
  if (id === 'escaparate') return <StoreSushi />
  if (id === 'vitrina')    return <StoreFashion />
  return <StoreMarket />
}

/* ── PAGE ─────────────────────────────────────────────── */

export default function PaginaPage() {
  const router = useRouter()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [selected, setSelected] = useState<TemplateId | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (cancelled || !authData.user) return
        const { data } = await supabase
          .from('stores')
          .select('id,template')
          .eq('owner_id', authData.user.id)
          .maybeSingle()
        if (cancelled || !data) return
        setStoreId(data.id)
        if ((data as any).template) {
          setSelected((data as any).template as TemplateId)
        }
      } catch {
        // silently handle network or auth errors
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handlePersonalizar() {
    if (selected !== 'clasico') return
    setSaving(true)
    try {
      if (storeId) {
        await supabase.from('stores').update({ template: selected }).eq('id', storeId)
      }
    } catch {
      // silently handle save errors
    } finally {
      setSaving(false)
    }
    router.push('/dashboard/canal/vitrina/editor')
  }

  const canPersonalizar = selected === 'clasico'

  return (
    <>
    <div className="vt-wrap">

      <div className="vt-header">
        <div className="vt-eyebrow">Diseño · Página</div>
        <h1 className="vt-title">Tu tienda,<br />tu <em>estilo</em>.</h1>
        <p className="vt-sub">Elige un template.</p>
      </div>

      <div className="vt-grid">
        {TEMPLATES.map(tpl => {
          const isSelected = selected === tpl.id
          return (
            <article
              key={tpl.id}
              className={`vt-card${isSelected ? ' selected' : ''}`}
              onClick={() => setSelected(isSelected ? null : tpl.id)}
            >
              {isSelected && (
                <div className="vt-check-badge">
                  <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3 3L13 4.5" />
                  </svg>
                </div>
              )}
              <div className="vt-phone">
                <div className="vt-phone-notch"/>
                <div className="vt-phone-screen">
                  <TemplateWireframe id={tpl.id} />
                  <TemplateStore id={tpl.id} />
                </div>
              </div>
              <div className="vt-card-label">
                <div className="vt-card-name">{tpl.namePrefix}<em>{tpl.nameAccent}</em></div>
                <div className="vt-card-desc">{tpl.tag}</div>
              </div>
            </article>
          )
        })}
      </div>

      <button
        className={`vt-personalizar${canPersonalizar ? ' active' : ''}`}
        onClick={handlePersonalizar}
        disabled={saving || !canPersonalizar}
      >
        {saving ? 'Guardando…' : 'Personalizar'}
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
        </svg>
      </button>

    </div>
    </>
  )
}
