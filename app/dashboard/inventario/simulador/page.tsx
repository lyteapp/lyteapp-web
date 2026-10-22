'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useDashboardStore } from '../../../lib/DashboardStoreProvider'
import LyteLeafLoader from '../../../components/LyteLeafLoader'
import type { SimItem } from './Scene'
import './simulador.css'

// Inventario as a game: walk your warehouse in 3D and work the stock from the
// shelves. Every action is a real inventory movement (inv_apply_movement),
// so the kardex records it like any other. Coins and missions are just for
// fun and live in this browser.

const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => <div className="sim-loading"><LyteLeafLoader size={48} /><span>Construyendo tu almacén…</span></div>,
})

type Warehouse = { id: string; name: string; is_default: boolean; active: boolean }
type Item = { id: string; name: string; unit: string; category: string | null; min_stock: number; avg_cost: number; active: boolean }
type Action = 'in' | 'out' | 'count'

const num = (v: unknown) => Number(v) || 0
const parseNum = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : NaN }
const fmt = (n: number) => Number(n.toFixed(3)).toLocaleString('es')

export default function SimuladorPage() {
  const { storeId } = useDashboardStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [stock, setStock] = useState<Record<string, number>>({})   // `${wh}|${item}` → qty
  const [whId, setWhId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reach, setReach] = useState<string | null>(null)
  const [action, setAction] = useState<null | { kind: Action; qty: string; cost: string }>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [coins, setCoins] = useState(0)
  const [checked, setChecked] = useState<string[]>([])
  const [pop, setPop] = useState<null | { text: string; key: number }>(null)
  const [showMissions, setShowMissions] = useState(true)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only on the client
  useEffect(() => setMounted(true), [])

  const load = useCallback(async (sid: string) => {
    const [w, i, s] = await Promise.all([
      supabase.from('inv_warehouses').select('id, name, is_default, active').eq('store_id', sid).eq('active', true).order('created_at'),
      supabase.from('inv_items').select('id, name, unit, category, min_stock, avg_cost, active').eq('store_id', sid).eq('active', true),
      supabase.from('inv_stock').select('warehouse_id, item_id, qty').eq('store_id', sid),
    ])
    setWarehouses((w.data ?? []) as Warehouse[])
    setItems(((i.data ?? []) as Item[]).map(x => ({ ...x, min_stock: num(x.min_stock), avg_cost: num(x.avg_cost) })))
    const st: Record<string, number> = {}
    for (const r of (s.data ?? []) as { warehouse_id: string; item_id: string; qty: number }[]) st[`${r.warehouse_id}|${r.item_id}`] = num(r.qty)
    setStock(st)
    setLoading(false)
    const pre = new URL(window.location.href).searchParams.get('almacen')
    if (pre && (w.data ?? []).some(x => x.id === pre)) setWhId(pre)
  }, [])
  useEffect(() => { if (storeId) Promise.resolve().then(() => load(storeId)) }, [storeId, load])

  // coins & checked items survive reloads (per store, this browser)
  useEffect(() => {
    if (!storeId) return
    try {
      const raw = JSON.parse(localStorage.getItem(`lyte:sim:${storeId}`) ?? '{}')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved progress
      setCoins(num(raw.coins))
    } catch { /* private mode */ }
  }, [storeId])
  const saveCoins = (c: number) => { try { localStorage.setItem(`lyte:sim:${storeId}`, JSON.stringify({ coins: c })) } catch { /* ignore */ } }

  const qty = (itemId: string) => (whId ? stock[`${whId}|${itemId}`] ?? 0 : 0)
  const simItems: SimItem[] = useMemo(() => items.map(i => ({
    id: i.id, name: i.name, unit: i.unit, min: i.min_stock, category: i.category?.trim() || 'Sin categoría',
    qty: whId ? stock[`${whId}|${i.id}`] ?? 0 : 0,
  })), [items, stock, whId])
  const lowItems = simItems.filter(i => i.min > 0 && i.qty < i.min)
  const reachItem = items.find(i => i.id === reach) ?? null
  const wh = warehouses.find(w => w.id === whId)

  function reward(points: number, text: string) {
    const c = coins + points
    setCoins(c); saveCoins(c)
    setPop(prev => ({ text: `+${points} 🪙  ${text}`, key: (prev?.key ?? 0) + 1 + c }))
    setTimeout(() => setPop(null), 1600)
  }

  async function doAction() {
    if (!action || !reachItem || !whId || !storeId) return
    const n = parseNum(action.qty)
    if (!Number.isFinite(n) || n < 0 || (action.kind !== 'count' && n === 0)) { setError('Escribe una cantidad válida'); return }
    const current = qty(reachItem.id)
    const delta = action.kind === 'in' ? n : action.kind === 'out' ? -n : n - current
    if (delta === 0) {
      // the count matches: still a checked item
      setAction(null)
      if (!checked.includes(reachItem.id)) setChecked(c => [...c, reachItem.id])
      reward(5, 'Conteo correcto')
      return
    }
    setSaving(true); setError('')
    const cost = parseNum(action.cost)
    const { error: err } = await supabase.rpc('inv_apply_movement', {
      p_store: storeId, p_item: reachItem.id, p_warehouse: whId,
      p_type: action.kind === 'count' ? 'count' : 'adjust', p_qty: delta,
      p_unit_cost: delta > 0 && Number.isFinite(cost) ? cost : null,
      p_note: 'Simulador',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setStock(s => ({ ...s, [`${whId}|${reachItem.id}`]: current + delta }))
    setAction(null)
    if (action.kind === 'count' && !checked.includes(reachItem.id)) setChecked(c => [...c, reachItem.id])
    reward(action.kind === 'count' ? 15 : 10, action.kind === 'in' ? 'Mercancía guardada' : action.kind === 'out' ? 'Despachado' : 'Inventario contado')
  }

  if (!mounted) return null
  return createPortal(
    <div className="sim-root">
      {loading ? (
        <div className="sim-loading"><LyteLeafLoader size={48} /></div>
      ) : !wh ? (
        /* ── choose the warehouse ── */
        <div className="sim-pick">
          <button className="sim-exit" onClick={() => router.push('/dashboard/inventario')}>‹ Salir</button>
          <div className="sim-pick-title">
            <span>🎮</span>
            <h1>Modo simulador</h1>
            <p>Camina por tu almacén, revisa los estantes y trabaja tu inventario como en un juego.</p>
          </div>
          {warehouses.length === 0 ? (
            <p className="sim-pick-empty">Primero crea un almacén en Inventario.</p>
          ) : (
            <div className="sim-pick-grid">
              {warehouses.map(w => (
                <button key={w.id} className="sim-pick-card" onClick={() => { setWhId(w.id); setReach(null) }}>
                  <span className="sim-pick-icon">🏬</span>
                  <strong>{w.name}</strong>
                  <small>{items.filter(i => (stock[`${w.id}|${i.id}`] ?? 0) !== 0).length} artículos</small>
                  <span className="sim-pick-go">Jugar ▶</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <Scene items={simItems} selectedId={reach} onReach={id => { setReach(id); setAction(null); setError('') }} />

          {/* ── HUD ── */}
          <div className="sim-hud-top">
            <button className="sim-exit" onClick={() => { setWhId(null); setReach(null) }}>‹ Almacenes</button>
            <div className="sim-wh">{wh.name}</div>
            <div className="sim-coins">🪙 {coins}</div>
          </div>

          <div className={`sim-missions${showMissions ? '' : ' closed'}`}>
            <button className="sim-missions-head" onClick={() => setShowMissions(v => !v)}>
              🎯 Misión {showMissions ? '▾' : '▸'}
            </button>
            {showMissions && (
              lowItems.length === 0 ? (
                <div className="sim-mission-done">¡Todo en orden! No hay artículos bajo mínimo. ✨</div>
              ) : (
                <>
                  <div className="sim-mission-title">Revisa los artículos bajo mínimo ({lowItems.filter(i => checked.includes(i.id)).length}/{lowItems.length})</div>
                  {lowItems.slice(0, 6).map(i => (
                    <div key={i.id} className={`sim-mission-row${checked.includes(i.id) ? ' ok' : ''}`}>
                      <span>{checked.includes(i.id) ? '✅' : '⬜'}</span>{i.name}
                    </div>
                  ))}
                </>
              )
            )}
          </div>

          {pop && <div key={pop.key} className="sim-pop">{pop.text}</div>}

          {!reachItem && !action && (
            <div className="sim-hint">Toca el piso para caminar · acércate a un estante</div>
          )}

          {reachItem && (
            <div className="sim-card">
              <div className="sim-card-head">
                <div>
                  <small>{reachItem.category || 'Sin categoría'}</small>
                  <strong>{reachItem.name}</strong>
                </div>
                <div className={`sim-card-qty${reachItem.min_stock > 0 && qty(reachItem.id) < reachItem.min_stock ? ' low' : ''}`}>
                  {fmt(qty(reachItem.id))} <span>{reachItem.unit}</span>
                </div>
              </div>
              {!action ? (
                <div className="sim-actions">
                  <button onClick={() => setAction({ kind: 'in', qty: '', cost: reachItem.avg_cost ? String(Math.round(reachItem.avg_cost * 100) / 100) : '' })}>📦 Entrada</button>
                  <button onClick={() => setAction({ kind: 'out', qty: '', cost: '' })}>🛒 Sacar</button>
                  <button onClick={() => setAction({ kind: 'count', qty: String(qty(reachItem.id)), cost: '' })}>🔢 Contar</button>
                </div>
              ) : (
                <div className="sim-form">
                  <label>
                    <span>{action.kind === 'in' ? '¿Cuánto entra?' : action.kind === 'out' ? '¿Cuánto sacas?' : '¿Cuánto hay realmente?'} ({reachItem.unit})</span>
                    <input inputMode="decimal" autoFocus value={action.qty} onChange={e => setAction({ ...action, qty: e.target.value.replace(/[^0-9.,]/g, '') })} />
                  </label>
                  {action.kind === 'in' && (
                    <label>
                      <span>Costo por {reachItem.unit} ($)</span>
                      <input inputMode="decimal" value={action.cost} onChange={e => setAction({ ...action, cost: e.target.value.replace(/[^0-9.,]/g, '') })} />
                    </label>
                  )}
                  {error && <div className="sim-error">{error}</div>}
                  <div className="sim-form-actions">
                    <button className="ghost" onClick={() => { setAction(null); setError('') }}>Cancelar</button>
                    <button onClick={doAction} disabled={saving}>{saving ? '…' : 'Listo'}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
