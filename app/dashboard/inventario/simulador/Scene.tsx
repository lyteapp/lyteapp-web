'use client'
/* eslint-disable react-hooks/immutability -- three.js objects (camera, meshes) are mutated every frame inside useFrame, as R3F intends */

import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// The warehouse as a little 3D world: one shelf per category, one stack of
// boxes per item (taller = more stock, red glow = below minimum), and the
// keeper — a low-poly character that walks where you tap (or WASD/arrows).
// Walking up to an item tells the page which one is in reach.

export type SimItem = { id: string; name: string; category: string; qty: number; unit: string; min: number }

type Slot = { item: SimItem; pos: THREE.Vector3; color: string }
type Shelf = { title: string; center: THREE.Vector3; width: number }

const SLOT_W = 1.2          // space per item along a shelf
const PER_SHELF = 4         // items per shelf unit before it wraps to another
const AISLE = 4.2           // distance between shelf rows
const PALETTE = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#6366F1']
const REACH = 1.7

function layout(items: SimItem[]) {
  const byCat = new Map<string, SimItem[]>()
  for (const it of [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    byCat.set(it.category, [...(byCat.get(it.category) ?? []), it])
  }
  const cats = [...byCat.keys()].sort((a, b) => a.localeCompare(b, 'es'))
  // one shelf unit per chunk of PER_SHELF items, laid out in rows of 3 units
  const units: { title: string; items: SimItem[]; color: string }[] = []
  cats.forEach((c, ci) => {
    const list = byCat.get(c)!
    for (let i = 0; i < list.length; i += PER_SHELF) {
      units.push({ title: c, items: list.slice(i, i + PER_SHELF), color: PALETTE[ci % PALETTE.length] })
    }
  })
  const perRow = 3
  const unitW = PER_SHELF * SLOT_W + 0.6
  const rows = Math.max(1, Math.ceil(units.length / perRow))
  const shelves: Shelf[] = []
  const slots: Slot[] = []
  units.forEach((u, i) => {
    const row = Math.floor(i / perRow), col = i % perRow
    const cx = (col - (perRow - 1) / 2) * (unitW + 1.2)
    const cz = -row * AISLE
    shelves.push({ title: u.title, center: new THREE.Vector3(cx, 0, cz), width: unitW })
    u.items.forEach((it, k) => {
      const x = cx - unitW / 2 + 0.3 + SLOT_W * (k + 0.5)
      slots.push({ item: it, pos: new THREE.Vector3(x, 0, cz), color: u.color })
    })
  })
  const depth = rows * AISLE + 4
  const width = perRow * (unitW + 1.2) + 4
  return { shelves, slots, bounds: { minX: -width / 2, maxX: width / 2, minZ: -depth + 3, maxZ: 5 } }
}

// How many boxes to stack for a quantity (grows slowly, max 5)
const boxesFor = (q: number) => (q <= 0 ? 0 : Math.min(5, Math.max(1, Math.round(Math.log2(q + 1)))))

const Boxes = memo(function Boxes({ slot, selected, onPick }: { slot: Slot; selected: boolean; onPick: (s: Slot) => void }) {
  const n = boxesFor(slot.item.qty)
  const low = slot.item.min > 0 && slot.item.qty < slot.item.min
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 4) * 0.25
  })
  return (
    <group position={slot.pos} onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onPick(slot) }}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[((i % 2) - 0.5) * 0.08, 0.62 + i * 0.36, 0]} castShadow>
          <boxGeometry args={[0.9, 0.34, 0.7]} />
          <meshStandardMaterial color={slot.color} roughness={0.7} />
        </mesh>
      ))}
      {n === 0 && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.9, 0.04, 0.7]} />
          <meshStandardMaterial color="#CBD5E1" />
        </mesh>
      )}
      {low && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.9]}>
          <ringGeometry args={[0.35, 0.55, 32]} />
          <meshBasicMaterial color="#EF4444" transparent opacity={0.5} />
        </mesh>
      )}
      <Html position={[0, 0.85 + Math.max(n, 1) * 0.36, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className={`sim-tag${low ? ' low' : ''}${selected ? ' sel' : ''}`}>
          <b>{slot.item.name}</b>
          <span>{Number(slot.item.qty.toFixed(2)).toLocaleString('es')} {slot.item.unit}</span>
        </div>
      </Html>
    </group>
  )
})

const ShelfUnit = memo(function ShelfUnit({ s }: { s: Shelf }) {
  return (
    <group position={s.center}>
      {/* base, two planks and posts */}
      {[0.4, 1.0].map(y => (
        <mesh key={y} position={[0, y, -0.15]} receiveShadow>
          <boxGeometry args={[s.width, 0.08, 1.1]} />
          <meshStandardMaterial color="#C8A27A" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (s.width / 2 - 0.05), 0.9, -0.15]}>
          <boxGeometry args={[0.1, 1.8, 1.1]} />
          <meshStandardMaterial color="#A47E58" />
        </mesh>
      ))}
      <mesh position={[0, 0.9, -0.7]}>
        <boxGeometry args={[s.width, 1.8, 0.06]} />
        <meshStandardMaterial color="#E7D3B8" />
      </mesh>
      <Html position={[0, 3.55, -0.6]} center distanceFactor={11} zIndexRange={[5, 0]}>
        <div className="sim-sign">{s.title}</div>
      </Html>
    </group>
  )
})

// The keeper: capsule body, round head, cap, swinging arms and legs
function Keeper({ target, keys, solids, bounds, onMove }: {
  target: React.MutableRefObject<THREE.Vector3 | null>
  keys: React.MutableRefObject<Set<string>>
  solids: { x1: number; x2: number; z1: number; z2: number }[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  onMove: (p: THREE.Vector3) => void
}) {
  const root = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const { camera, size } = useThree()
  const camGoal = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    const step = Math.min(dt, 0.05)
    const dir = new THREE.Vector3()
    const k = keys.current
    if (k.has('w') || k.has('arrowup')) dir.z -= 1
    if (k.has('s') || k.has('arrowdown')) dir.z += 1
    if (k.has('a') || k.has('arrowleft')) dir.x -= 1
    if (k.has('d') || k.has('arrowright')) dir.x += 1
    if (dir.lengthSq() > 0) target.current = null
    else if (target.current) {
      dir.subVectors(target.current, g.position).setY(0)
      if (dir.length() < 0.08) { target.current = null; dir.set(0, 0, 0) }
    }
    const moving = dir.lengthSq() > 0
    if (moving) {
      dir.normalize()
      const next = g.position.clone().addScaledVector(dir, 3.4 * step)
      // don't walk through shelves or out of the room
      const r = 0.35
      const blocked = (p: THREE.Vector3) => solids.some(b => p.x > b.x1 - r && p.x < b.x2 + r && p.z > b.z1 - r && p.z < b.z2 + r)
      const tryX = new THREE.Vector3(next.x, 0, g.position.z), tryZ = new THREE.Vector3(g.position.x, 0, next.z)
      if (!blocked(tryX)) g.position.x = THREE.MathUtils.clamp(next.x, bounds.minX, bounds.maxX)
      if (!blocked(tryZ)) g.position.z = THREE.MathUtils.clamp(next.z, bounds.minZ, bounds.maxZ)
      const ang = Math.atan2(dir.x, dir.z)
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, ang + (Math.abs(ang - g.rotation.y) > Math.PI ? Math.sign(g.rotation.y - ang) * Math.PI * 2 : 0), 0.25)
      phase.current += step * 11
      onMove(g.position)
    } else {
      phase.current *= 0.85
    }
    const sw = Math.sin(phase.current) * (moving ? 0.7 : 0)
    if (legL.current) legL.current.rotation.x = sw
    if (legR.current) legR.current.rotation.x = -sw
    if (armL.current) armL.current.rotation.x = -sw * 0.8
    if (armR.current) armR.current.rotation.x = sw * 0.8
    g.position.y = moving ? Math.abs(Math.sin(phase.current)) * 0.06 : 0

    // camera follows from above and behind
    // narrow (phone) screens pull further back so more shelves fit
    const far = size.width / size.height < 0.8 ? 1.45 : 1
    camGoal.set(g.position.x, 9.5 * far, g.position.z + 8.5 * far)
    camera.position.lerp(camGoal, 0.08)
    camera.lookAt(g.position.x, 0.6, g.position.z - 1)
  })

  const skin = '#F2C29B', shirt = '#1C1B3A', pants = '#334155', cap = '#9AB7FD'
  return (
    <group ref={root} position={[0, 0, 3]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} />
      </mesh>
      {[[-0.13, legL], [0.13, legR]].map(([x, ref], i) => (
        <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.55, 0]}>
          <mesh position={[0, -0.27, 0]}><capsuleGeometry args={[0.1, 0.32, 4, 8]} /><meshStandardMaterial color={pants} /></mesh>
          <mesh position={[0, -0.52, 0.05]}><boxGeometry args={[0.18, 0.08, 0.28]} /><meshStandardMaterial color="#111827" /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.9, 0]} castShadow><capsuleGeometry args={[0.27, 0.42, 6, 12]} /><meshStandardMaterial color={shirt} /></mesh>
      {[[-0.36, armL], [0.36, armR]].map(([x, ref], i) => (
        <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.1, 0]}>
          <mesh position={[0, -0.24, 0]}><capsuleGeometry args={[0.08, 0.32, 4, 8]} /><meshStandardMaterial color={shirt} /></mesh>
          <mesh position={[0, -0.48, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color={skin} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.3, 20, 20]} /><meshStandardMaterial color={skin} /></mesh>
      {[-0.1, 0.1].map(x => (
        <mesh key={x} position={[x, 1.58, 0.27]}><sphereGeometry args={[0.04, 10, 10]} /><meshBasicMaterial color="#111827" /></mesh>
      ))}
      <mesh position={[0, 1.74, 0]}><sphereGeometry args={[0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={cap} /></mesh>
      <mesh position={[0, 1.72, 0.25]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.36, 0.04, 0.22]} /><meshStandardMaterial color={cap} /></mesh>
    </group>
  )
}

export default function Scene({ items, selectedId, onReach }: {
  items: SimItem[]
  selectedId: string | null
  /** The item within reach of the keeper (null when none) */
  onReach: (id: string | null) => void
}) {
  const { shelves, slots, bounds } = useMemo(() => layout(items), [items])
  const solids = useMemo(() => shelves.map(s => ({ x1: s.center.x - s.width / 2, x2: s.center.x + s.width / 2, z1: s.center.z - 0.7, z2: s.center.z + 0.4 })), [shelves])
  const target = useRef<THREE.Vector3 | null>(null)
  const keys = useRef<Set<string>>(new Set())
  const lastReach = useRef<string | null>(null)
  const walkTo = useMemo(() => (sl: Slot) => { target.current = new THREE.Vector3(sl.pos.x, 0, sl.pos.z + 1.0) }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      keys.current.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  function onMove(p: THREE.Vector3) {
    let best: Slot | null = null, bestD = REACH
    for (const s of slots) {
      const d = Math.hypot(s.pos.x - p.x, (s.pos.z + 0.9) - p.z)
      if (d < bestD) { bestD = d; best = s }
    }
    const id = best?.item.id ?? null
    if (id !== lastReach.current) { lastReach.current = id; onReach(id) }
  }

  // the floor reaches well past the walkable area toward the camera
  const floorW = bounds.maxX - bounds.minX + 14, floorD = bounds.maxZ - bounds.minZ + 22
  return (
    <Canvas shadows={false} dpr={[1, 2]} camera={{ position: [0, 9.5, 11.5], fov: 45 }}>
      <color attach="background" args={['#E9EAFF']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#C7D2FE', 1.1]} />
      <directionalLight position={[6, 12, 6]} intensity={1.3} />
      {/* floor: tap to walk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (bounds.minZ + bounds.maxZ) / 2]}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => { target.current = new THREE.Vector3(e.point.x, 0, e.point.z) }}>
        <planeGeometry args={[floorW, floorD]} />
        <meshStandardMaterial color="#FFFFFF" roughness={1} />
      </mesh>
      <gridHelper args={[Math.max(floorW, floorD), Math.round(Math.max(floorW, floorD) / 1.5), '#CBD5E1', '#E2E8F0']}
        position={[0, 0.005, (bounds.minZ + bounds.maxZ) / 2]} />
      {shelves.map((s, i) => <ShelfUnit key={i} s={s} />)}
      {slots.map(s => (
        <Boxes key={s.item.id} slot={s} selected={s.item.id === selectedId} onPick={walkTo} />
      ))}
      <Keeper target={target} keys={keys} solids={solids} bounds={bounds} onMove={onMove} />
    </Canvas>
  )
}
