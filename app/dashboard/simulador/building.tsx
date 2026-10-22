'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import LyteLeafLoader from '../../components/LyteLeafLoader'
import {
  Bike, Bubble, ChartBoard, Counter, Desk, Easel, Frame, Lamp, Person, Plant, Safe, Shelf, Sofa, Stove, TicketRail, Walker, Window,
} from './art'

// The building view: street, neighbours, the store on the ground floor and
// one floor per department, plus the HUD, floor panel and build menu.
// Pure view — the page loads the data and saves the floors.

export type Stats = {
  ordersToday: number; salesToday: number; pending: number; inRoute: number; drivers: number
  lowStock: number; items: number; products: number; customers: number; week: number[]
  productImages: string[]
}
export type Dept = {
  id: string; name: string; sign: string; icon: string; route: string; desc: string
  stats: (s: Stats) => { label: string; value: string }[]
  alert?: (s: Stats) => string | null
}

const money = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export const DEPTS: Dept[] = [
  { id: 'pedidos', name: 'Cocina · Pedidos', sign: 'COCINA', icon: '🍳', route: '/dashboard/pedidos', desc: 'Donde se preparan los pedidos. Las comandas cuelgan del riel.',
    stats: s => [{ label: 'Pendientes', value: String(s.pending) }, { label: 'Pedidos hoy', value: String(s.ordersToday) }],
    alert: s => (s.pending > 0 ? `${s.pending} pedido${s.pending === 1 ? '' : 's'} esperando` : null) },
  { id: 'caja', name: 'Caja', sign: 'CAJA', icon: '🧾', route: '/dashboard/caja', desc: 'Cobros en el local y cierre de caja.',
    stats: s => [{ label: 'Ventas hoy', value: money(s.salesToday) }] },
  { id: 'delivery', name: 'Delivery', sign: 'DELIVERY', icon: '🛵', route: '/dashboard/delivery', desc: 'El garaje de tus despachadores.',
    stats: s => [{ label: 'En ruta', value: String(s.inRoute) }, { label: 'Despachadores', value: String(s.drivers) }] },
  { id: 'inventario', name: 'Almacén · Inventario', sign: 'ALMACÉN', icon: '📦', route: '/dashboard/inventario', desc: 'Estantes con tu mercancía e insumos.',
    stats: s => [{ label: 'Artículos', value: String(s.items) }, { label: 'Bajo mínimo', value: String(s.lowStock) }],
    alert: s => (s.lowStock > 0 ? `${s.lowStock} bajo mínimo` : null) },
  { id: 'productos', name: 'Productos', sign: 'PRODUCTOS', icon: '🏷️', route: '/dashboard/productos', desc: 'El catálogo de lo que vendes.',
    stats: s => [{ label: 'Productos', value: String(s.products) }] },
  { id: 'clientes', name: 'Clientes', sign: 'CLIENTES', icon: '🛋️', route: '/dashboard/clientes', desc: 'La sala de tus clientes frecuentes.',
    stats: s => [{ label: 'Clientes', value: String(s.customers) }] },
  { id: 'analiticas', name: 'Analíticas', sign: 'ANALÍTICAS', icon: '📈', route: '/dashboard/analitics', desc: 'La oficina donde se miran los números.',
    stats: s => [{ label: 'Ventas 7 días', value: money(s.week.reduce((a, b) => a + b, 0)) }] },
  { id: 'finanzas', name: 'Finanzas', sign: 'FINANZAS', icon: '🏦', route: '/finanzas', desc: 'Caja fuerte, cuentas y balance.',
    stats: s => [{ label: 'Ventas hoy', value: money(s.salesToday) }] },
  { id: 'vitrina', name: 'Diseño · Vitrina', sign: 'DISEÑO', icon: '🎨', route: '/dashboard/canal/vitrina', desc: 'El estudio donde se diseña tu tienda.',
    stats: () => [{ label: 'Editor', value: 'Vitrina' }] },
]

// Floor interiors (design units: room is ROOM_W × FLOOR_H)
const ROOM_W = 780
const FLOOR_H = 150

function Room({ id, s, accent }: { id: string; s: Stats; accent: string }) {
  switch (id) {
    case 'pedidos':
      return <>
        <Lamp left={120} /><Lamp left={420} /><Lamp left={660} />
        <Stove left={40} /><Stove left={110} />
        <TicketRail left={230} count={s.pending} />
        <Counter left={430} width={170} />
        <Walker from={190} to={400} seed={1} shirt="#F8FAFC" apron dur={7} />
        {s.pending > 1 && <Walker from={60} to={360} seed={4} shirt="#E5E7EB" apron dur={9} />}
        {s.pending > 3 && <Walker from={480} to={700} seed={6} shirt="#F8FAFC" apron dur={8} carry="#F59E0B" />}
        <Window left={690} /><Plant left={640} />
      </>
    case 'caja':
      return <>
        <Lamp left={200} /><Lamp left={560} />
        <Counter left={240} width={160} register />
        <Person seed={2} shirt="#0F766E" style={{ position: 'absolute', left: 330, bottom: 20, zIndex: 1 }} />
        {Array.from({ length: Math.min(3, Math.max(1, Math.ceil(s.ordersToday / 4))) }, (_, i) => (
          <Person key={i} seed={i + 5} shirt={['#9333EA', '#2563EB', '#DB2777'][i]} style={{ position: 'absolute', left: 440 + i * 34, bottom: 0, zIndex: 3 }} />
        ))}
        <Window left={60} /><Window left={680} /><Plant left={620} />
      </>
    case 'delivery': {
      const parked = Math.max(0, Math.min(4, s.drivers - s.inRoute))
      return <>
        <Lamp left={240} /><Lamp left={540} />
        <div className="sim-garage-door" />
        {Array.from({ length: Math.max(parked, s.drivers ? 0 : 2) }, (_, i) => <Bike key={i} left={180 + i * 90} color={accent} />)}
        <Walker from={160} to={560} seed={3} shirt="#DC2626" dur={10} carry="#F59E0B" />
        {s.inRoute > 0 && <Bubble left={600} bottom={100} text={`${s.inRoute} en ruta 🛵`} tone="info" />}
        <Window left={690} />
      </>
    }
    case 'inventario':
      return <>
        <Lamp left={150} /><Lamp left={400} /><Lamp left={650} />
        <Shelf left={30} boxes={Math.min(9, Math.ceil(s.items / 2) + 2)} lowBoxes={Math.min(2, s.lowStock)} />
        <Shelf left={140} boxes={Math.min(9, Math.max(3, s.items))} lowBoxes={s.lowStock > 2 ? 1 : 0} />
        <Shelf left={560} boxes={Math.min(9, Math.max(4, s.items - 3))} />
        <Shelf left={670} boxes={6} />
        <Walker from={250} to={520} seed={7} shirt="#B45309" carry="#C8935B" dur={8} />
      </>
    case 'productos':
      return <>
        <Lamp left={200} /><Lamp left={560} />
        {s.productImages.slice(0, 5).map((src, i) => <Frame key={i} left={60 + i * 140} src={src} />)}
        <Desk left={120} screen={false} /><Desk left={470} screen={false} />
        <Walker from={80} to={640} seed={8} shirt="#4338CA" dur={12} />
      </>
    case 'clientes':
      return <>
        <Lamp left={180} /><Lamp left={520} />
        <Sofa left={90} color={accent} /><Sofa left={420} color="#0F766E" />
        <Person seed={9} shirt="#DB2777" sitting style={{ position: 'absolute', left: 112, bottom: 18 }} />
        {s.customers > 3 && <Person seed={10} shirt="#2563EB" sitting style={{ position: 'absolute', left: 140, bottom: 18 }} />}
        {s.customers > 8 && <Person seed={11} shirt="#F59E0B" sitting style={{ position: 'absolute', left: 450, bottom: 18 }} />}
        <Walker from={240} to={680} seed={12} shirt="#9333EA" dur={11} />
        <Window left={300} /><Window left={680} /><Plant left={30} />
      </>
    case 'analiticas':
      return <>
        <Lamp left={160} /><Lamp left={540} />
        <ChartBoard left={60} bars={s.week} />
        <Desk left={260} /><Desk left={480} />
        <Person seed={13} shirt="#1E3A8A" sitting style={{ position: 'absolute', left: 292, bottom: 22 }} />
        <Walker from={380} to={700} seed={14} shirt="#065F46" dur={10} />
        <Window left={690} />
      </>
    case 'finanzas':
      return <>
        <Lamp left={200} /><Lamp left={540} />
        <Safe left={40} /><Desk left={200} /><Desk left={420} />
        <Person seed={15} shirt="#374151" sitting style={{ position: 'absolute', left: 230, bottom: 22 }} />
        <div className="sim-money" style={{ left: 600, bottom: 70 }}>{money(s.salesToday)}<small>hoy</small></div>
        <Walker from={120} to={560} seed={16} shirt="#7C2D12" dur={13} />
      </>
    case 'vitrina':
      return <>
        <Lamp left={220} /><Lamp left={580} />
        <Easel left={80} colors={[accent, '#1C1B3A', '#9AB7FD', '#FBBF24']} />
        <Desk left={300} /><Plant left={420} />
        <Person seed={17} shirt="#BE185D" sitting style={{ position: 'absolute', left: 332, bottom: 22 }} />
        <Walker from={460} to={700} seed={18} shirt="#0E7490" dur={8} />
      </>
  }
  return null
}


export type StoreLook = { name: string; logo: string | null; accent: string }

export function BuildingView({ loading, store, floors, stats, hour, vw, vh, onExit, onSaveFloors, onNavigate }: {
  loading: boolean
  store: StoreLook | null
  floors: string[]
  stats: Stats
  hour: number
  vw: number
  vh: number
  onExit: () => void
  onSaveFloors: (next: string[]) => void
  onNavigate: (route: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const saveFloors = onSaveFloors
  const router = { push: onNavigate }
  // Scene in design units, scaled to fit the screen's height-ish / width
  const SCENE_W = 1500
  const BUILD_W = ROOM_W + 40
  const GROUND_H = 210
  const roofH = 46
  const buildingH = GROUND_H + floors.length * (FLOOR_H + 12) + roofH
  // sky above the roof so the top floor clears the HUD
  const sceneH = Math.max(buildingH + 230, 640)
  const scale = Math.min(vw / SCENE_W, 1.2)
  const night = hour >= 19 || hour < 6
  const dusk = hour >= 17 && hour < 19

  // open at street level
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && !loading) el.scrollTop = el.scrollHeight
  }, [loading, floors.length])

  const accent = store?.accent ?? '#9AB7FD'
  const available = DEPTS.filter(d => !floors.includes(d.id))
  const sel = DEPTS.find(d => d.id === selected) ?? (selected === 'tienda' ? null : null)
  const portrait = vh > vw && vw < 760

  return (
    <div className={`simb-root${night ? ' night' : dusk ? ' dusk' : ''}`}>
      {loading ? (
        <div className="simb-loading"><LyteLeafLoader size={48} /><span>Construyendo tu edificio…</span></div>
      ) : (
        <>
          <div className="simb-scroll" ref={scroller}>
            <div className="simb-scene" style={{ width: SCENE_W * scale, height: sceneH * scale }}>
              <div className="simb-world" style={{ width: SCENE_W, height: sceneH, transform: `scale(${scale})` }}>
                <div className="simb-sky" />
                {/* neighbours */}
                <div className="simb-neighbor left" style={{ height: 420 }}>{Array.from({ length: 18 }, (_, i) => <i key={i} className={(i * 7) % 5 === 0 ? 'lit' : ''} />)}</div>
                <div className="simb-neighbor right" style={{ height: 340 }}>{Array.from({ length: 12 }, (_, i) => <i key={i} className={(i * 3) % 4 === 0 ? 'lit' : ''} />)}</div>

                {/* the building */}
                <div className="simb-building" style={{ width: BUILD_W, height: buildingH, left: (SCENE_W - BUILD_W) / 2 }}>
                  <div className="simb-roof" style={{ height: roofH }}>
                    <span className="simb-roof-sign">{store?.name}</span>
                    <button className="simb-add-floor" onClick={() => setBuilding(true)} disabled={available.length === 0}>+ Construir piso</button>
                  </div>
                  {[...floors].reverse().map((id, i) => {
                    const d = DEPTS.find(x => x.id === id)!
                    const alert = d.alert?.(stats)
                    return (
                      <button key={id} className={`simb-floor${selected === id ? ' sel' : ''}`} style={{ height: FLOOR_H }} onClick={() => setSelected(id)}>
                        <div className="simb-room">
                          <Room id={id} s={stats} accent={accent} />
                          {alert && <Bubble left={ROOM_W / 2 - 40} bottom={96} text={`!!! ${alert}`} />}
                        </div>
                        <span className="simb-plate">{floors.length - i}° · {d.sign}</span>
                      </button>
                    )
                  })}
                  {/* ground floor: the store */}
                  <button className={`simb-shop${selected === 'tienda' ? ' sel' : ''}`} style={{ height: GROUND_H }} onClick={() => setSelected('tienda')}>
                    <div className="simb-awning" style={{ ['--accent' as string]: accent }} />
                    <div className="simb-shop-sign">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {store?.logo && <img src={store.logo} alt="" />}
                      <span>{store?.name}</span>
                    </div>
                    <div className="simb-shopwindow">
                      {(stats.productImages.length ? stats.productImages : [null, null, null]).slice(0, 4).map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <div key={i} className="simb-display">{src ? <img src={src} alt="" /> : null}</div>
                      ))}
                    </div>
                    <div className="simb-door"><span>ABIERTO</span></div>
                    <div className="simb-shopwindow right">
                      <div className="simb-sales">{money(stats.salesToday)}<small>vendido hoy</small></div>
                    </div>
                  </button>
                </div>

                {/* street */}
                <div className="simb-sidewalk" />
                <div className="simb-street">
                  <div className="simb-car" />
                </div>
                {[260, 520, 980, 1240].map(x => <div key={x} className="simb-streetlamp" style={{ left: x }} />)}
                <div className="simb-passerby a"><Walker from={0} to={1300} seed={20} shirt="#6D28D9" dur={26} /></div>
                <div className="simb-passerby b"><Walker from={1300} to={0} seed={22} shirt="#B91C1C" dur={31} /></div>
                {stats.ordersToday > 0 && <div className="simb-passerby c"><Walker from={420} to={720} seed={24} shirt="#0369A1" dur={9} /></div>}
              </div>
            </div>
          </div>

          {/* ── HUD ── */}
          <div className="simb-hud">
            <button className="simb-btn" onClick={onExit}>‹ Salir</button>
            <div className="simb-hud-stats">
              <span>🕒 {String(hour).padStart(2, '0')}:00</span>
              <span>🧾 {stats.ordersToday} pedidos</span>
              <span>💵 {money(stats.salesToday)}</span>
            </div>
            <button className="simb-btn primary" onClick={() => setBuilding(true)} disabled={available.length === 0}>🏗️ Construir</button>
          </div>

          {portrait && <div className="simb-rotate">↻ Gira tu teléfono para ver mejor tu edificio</div>}

          {/* ── floor panel ── */}
          {selected && (
            <div className="simb-panel" onClick={() => setSelected(null)}>
              <div className="simb-panel-card" onClick={e => e.stopPropagation()}>
                {selected === 'tienda' ? (
                  <>
                    <div className="simb-panel-head"><span>🏪</span><div><small>Planta baja</small><strong>{store?.name}</strong></div></div>
                    <div className="simb-panel-stats">
                      <div><b>{stats.ordersToday}</b><span>Pedidos hoy</span></div>
                      <div><b>{money(stats.salesToday)}</b><span>Vendido hoy</span></div>
                      <div><b>{stats.products}</b><span>Productos</span></div>
                    </div>
                    <div className="simb-panel-actions">
                      <button className="simb-btn" onClick={() => setSelected(null)}>Cerrar</button>
                      <button className="simb-btn primary" onClick={() => router.push('/dashboard')}>Ir al dashboard</button>
                    </div>
                  </>
                ) : sel && (
                  <>
                    <div className="simb-panel-head"><span>{sel.icon}</span><div><small>Piso {floors.indexOf(sel.id) + 1}</small><strong>{sel.name}</strong></div></div>
                    <p className="simb-panel-desc">{sel.desc}</p>
                    <div className="simb-panel-stats">
                      {sel.stats(stats).map(x => <div key={x.label}><b>{x.value}</b><span>{x.label}</span></div>)}
                    </div>
                    <div className="simb-panel-actions">
                      <button className="simb-btn danger" onClick={() => { if (confirm(`¿Quitar el piso ${sel.name}? (La sección sigue en el panel)`)) { saveFloors(floors.filter(f => f !== sel.id)); setSelected(null) } }}>Quitar piso</button>
                      <button className="simb-btn primary" onClick={() => router.push(sel.route)}>Entrar a {sel.name.split(' · ')[0]} →</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── build menu ── */}
          {building && (
            <div className="simb-panel" onClick={() => setBuilding(false)}>
              <div className="simb-panel-card wide" onClick={e => e.stopPropagation()}>
                <div className="simb-panel-head"><span>🏗️</span><div><small>Construir</small><strong>Agrega un piso a tu edificio</strong></div></div>
                <div className="simb-build-grid">
                  {available.map(d => (
                    <button key={d.id} className="simb-build-card" onClick={() => { saveFloors([...floors, d.id]); setBuilding(false); setSelected(null) }}>
                      <span className="simb-build-icon">{d.icon}</span>
                      <strong>{d.name}</strong>
                      <small>{d.desc}</small>
                    </button>
                  ))}
                </div>
                <div className="simb-panel-actions"><button className="simb-btn" onClick={() => setBuilding(false)}>Cerrar</button></div>
              </div>
            </div>
          )}

          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs><linearGradient id="simGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#93C5FD" /><stop offset="1" stopColor="#1E293B" /></linearGradient></defs>
          </svg>
        </>
      )}
    </div>
  )
}
