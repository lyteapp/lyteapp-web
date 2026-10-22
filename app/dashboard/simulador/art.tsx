'use client'

// Hand-drawn (SVG) pieces for the building simulator: people that walk,
// furniture, and the rooms each department floor is decorated with.

import type { CSSProperties } from 'react'

type At = { left: number; bottom?: number; z?: number; flip?: boolean; scale?: number }
const at = ({ left, bottom = 0, z, flip, scale = 1 }: At): CSSProperties => ({
  position: 'absolute', left, bottom, zIndex: z,
  transform: `${flip ? 'scaleX(-1) ' : ''}scale(${scale})`, transformOrigin: 'bottom center',
})

/* ── People ── */
const SKINS = ['#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#FFDBAC']
const HAIR = ['#2B1B10', '#5A3825', '#111827', '#A0522D', '#D9A066']

/** A walking person: paces between `from` and `to` (px inside the room) */
export function Walker({ from, to, seed = 0, shirt = '#1C1B3A', dur = 9, carry, apron }: {
  from: number; to: number; seed?: number; shirt?: string; dur?: number; carry?: string; apron?: boolean
}) {
  const style = {
    '--from': `${from}px`, '--dist': `${to - from}px`,
    animationDuration: `${dur}s`, animationDelay: `${-seed * 1.7}s`,
  } as CSSProperties
  return (
    <div className="sim-walker" style={style}>
      <div className="sim-walker-flip" style={{ animationDuration: `${dur}s`, animationDelay: `${-seed * 1.7}s` }}>
        <Person seed={seed} shirt={shirt} carry={carry} apron={apron} walking />
      </div>
    </div>
  )
}

/** A person standing / sitting still (or typing) */
export function Person({ seed = 0, shirt = '#1C1B3A', carry, apron, walking, sitting, style }: {
  seed?: number; shirt?: string; carry?: string; apron?: boolean; walking?: boolean; sitting?: boolean; style?: CSSProperties
}) {
  const skin = SKINS[seed % SKINS.length], hair = HAIR[(seed * 3) % HAIR.length]
  return (
    <svg className={`sim-person${walking ? ' walking' : ''}`} width="22" height={sitting ? 34 : 46} viewBox={sitting ? '0 0 22 34' : '0 0 22 46'} style={style}>
      {!sitting && (
        <g className="legs">
          <rect className="leg l" x="6" y="30" width="4" height="15" rx="2" fill="#2F2A3A" />
          <rect className="leg r" x="12" y="30" width="4" height="15" rx="2" fill="#3A3448" />
        </g>
      )}
      <rect x="4" y="13" width="14" height="19" rx="5" fill={shirt} />
      {apron && <rect x="6" y="18" width="10" height="13" rx="2" fill="#F8FAFC" opacity="0.92" />}
      <rect className="arm" x="2" y="15" width="4" height="13" rx="2" fill={shirt} />
      <rect className="arm r" x="16" y="15" width="4" height="13" rx="2" fill={shirt} />
      <circle cx="11" cy="8" r="6.5" fill={skin} />
      <path d={`M4.5 7 Q11 -1 17.5 7 L17.5 5 Q11 -3 4.5 5 Z`} fill={hair} />
      <circle cx="13.5" cy="8.5" r="0.9" fill="#1F2937" />
      {carry && <rect x="12" y="19" width="10" height="8" rx="1" fill={carry} stroke="#00000033" />}
    </svg>
  )
}

/* ── Furniture ── */
export function Lamp({ left }: { left: number }) {
  return (
    <div className="sim-lamp" style={{ left }}>
      <svg width="26" height="22" viewBox="0 0 26 22"><line x1="13" y1="0" x2="13" y2="8" stroke="#1F1A17" strokeWidth="2" /><path d="M3 16 Q13 4 23 16 Z" fill="#2E2A26" /><ellipse cx="13" cy="16.5" rx="6" ry="2" fill="#FFE8A3" /></svg>
    </div>
  )
}

export function Window({ left, bottom = 52 }: { left: number; bottom?: number }) {
  return (
    <svg style={at({ left, bottom })} width="46" height="58" viewBox="0 0 46 58">
      <rect x="1" y="1" width="44" height="56" rx="2" fill="#3B2A22" />
      <rect x="5" y="5" width="16" height="22" fill="#1E293B" /><rect x="25" y="5" width="16" height="22" fill="#1E293B" />
      <rect x="5" y="31" width="16" height="22" fill="#1E293B" /><rect x="25" y="31" width="16" height="22" fill="#1E293B" />
      <rect x="5" y="5" width="36" height="48" fill="url(#simGlass)" opacity="0.5" />
    </svg>
  )
}

export function Plant({ left }: { left: number }) {
  return (
    <svg style={at({ left })} width="22" height="34" viewBox="0 0 22 34">
      <path d="M11 20 C2 16 2 6 9 4 C9 12 11 16 11 20 Z" fill="#3F7D4E" /><path d="M11 20 C20 15 20 5 13 3 C13 11 11 15 11 20 Z" fill="#4E9A61" />
      <path d="M5 21 H17 L15 33 H7 Z" fill="#B45C3A" />
    </svg>
  )
}

export function Desk({ left, screen = true }: { left: number; screen?: boolean }) {
  return (
    <svg style={at({ left })} width="70" height="44" viewBox="0 0 70 44">
      <rect x="2" y="20" width="66" height="5" rx="1" fill="#8B5A3C" />
      <rect x="6" y="25" width="5" height="19" fill="#6E4630" /><rect x="59" y="25" width="5" height="19" fill="#6E4630" />
      <rect x="40" y="25" width="20" height="14" fill="#7A4E35" />
      {screen && <><rect x="12" y="2" width="24" height="16" rx="1.5" fill="#1F2937" /><rect x="14" y="4" width="20" height="12" fill="#7DD3FC" className="sim-screen" /><rect x="22" y="18" width="4" height="3" fill="#374151" /></>}
    </svg>
  )
}

export function Shelf({ left, boxes, lowBoxes = 0 }: { left: number; boxes: number; lowBoxes?: number }) {
  const slots = Array.from({ length: 9 }, (_, i) => i)
  return (
    <svg style={at({ left })} width="92" height="104" viewBox="0 0 92 104">
      <rect x="2" y="0" width="5" height="104" fill="#4B3A2F" /><rect x="85" y="0" width="5" height="104" fill="#4B3A2F" />
      {[30, 64, 98].map(y => <rect key={y} x="2" y={y} width="88" height="5" fill="#5E4A3B" />)}
      {slots.map(i => {
        if (i >= boxes) return null
        const row = Math.floor(i / 3), col = i % 3
        const low = i >= boxes - lowBoxes
        return (
          <g key={i}>
            <rect x={10 + col * 25} y={8 + row * 34} width="22" height="22" rx="1" fill={low ? '#C2410C' : ['#C8935B', '#B98249', '#D3A26A'][(i + row) % 3]} />
            <rect x={10 + col * 25} y={17 + row * 34} width="22" height="3" fill="#00000022" />
          </g>
        )
      })}
    </svg>
  )
}

export function Counter({ left, width = 120, register }: { left: number; width?: number; register?: boolean }) {
  return (
    <svg style={at({ left, z: 2 })} width={width} height="50" viewBox={`0 0 ${width} 50`}>
      {register && <><rect x={width - 44} y="2" width="30" height="16" rx="2" fill="#374151" /><rect x={width - 40} y="5" width="22" height="6" fill="#A7F3D0" /></>}
      <rect x="0" y="18" width={width} height="6" rx="1" fill="#8B5A3C" />
      <rect x="4" y="24" width={width - 8} height="26" fill="#6E4630" />
      <rect x="4" y="34" width={width - 8} height="2" fill="#00000022" />
    </svg>
  )
}

export function Stove({ left }: { left: number }) {
  return (
    <svg style={at({ left })} width="64" height="56" viewBox="0 0 64 56">
      <rect x="2" y="10" width="60" height="46" rx="2" fill="#4B5563" />
      <rect x="6" y="22" width="52" height="28" rx="2" fill="#1F2937" />
      <rect x="10" y="26" width="44" height="18" fill="#F97316" opacity="0.45" className="sim-oven" />
      <ellipse cx="18" cy="9" rx="10" ry="3" fill="#111827" /><ellipse cx="46" cy="9" rx="10" ry="3" fill="#111827" />
      <path d="M14 2 q4 -4 0 -8 M46 2 q4 -4 0 -8" stroke="#E5E7EB" strokeWidth="1.5" fill="none" className="sim-steam" />
    </svg>
  )
}

export function TicketRail({ left, count }: { left: number; count: number }) {
  const n = Math.min(count, 8)
  return (
    <svg style={at({ left, bottom: 92 })} width="150" height="34" viewBox="0 0 150 34">
      <rect x="0" y="2" width="150" height="3" fill="#9CA3AF" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} className="sim-ticket" style={{ animationDelay: `${i * 0.3}s` }}>
          <rect x={6 + i * 18} y="5" width="14" height="24" fill="#FFFBEB" stroke="#D6D3D1" />
          <line x1={9 + i * 18} y1="11" x2={17 + i * 18} y2="11" stroke="#9CA3AF" /><line x1={9 + i * 18} y1="16" x2={17 + i * 18} y2="16" stroke="#9CA3AF" /><line x1={9 + i * 18} y1="21" x2={15 + i * 18} y2="21" stroke="#9CA3AF" />
        </g>
      ))}
    </svg>
  )
}

export function Bike({ left, color = '#DC2626', flip }: { left: number; color?: string; flip?: boolean }) {
  return (
    <svg style={at({ left, flip })} width="64" height="40" viewBox="0 0 64 40">
      <circle cx="12" cy="30" r="9" fill="#111827" /><circle cx="12" cy="30" r="4" fill="#6B7280" />
      <circle cx="52" cy="30" r="9" fill="#111827" /><circle cx="52" cy="30" r="4" fill="#6B7280" />
      <path d="M12 30 L26 18 H44 L52 30" stroke="#374151" strokeWidth="4" fill="none" />
      <rect x="22" y="12" width="22" height="8" rx="3" fill={color} />
      <rect x="2" y="8" width="16" height="14" rx="2" fill="#F59E0B" />
      <path d="M44 18 L48 6 H54" stroke="#374151" strokeWidth="3" fill="none" />
    </svg>
  )
}

export function Safe({ left }: { left: number }) {
  return (
    <svg style={at({ left })} width="56" height="62" viewBox="0 0 56 62">
      <rect x="2" y="2" width="52" height="56" rx="4" fill="#475569" /><rect x="7" y="7" width="42" height="46" rx="3" fill="#64748B" />
      <circle cx="28" cy="30" r="10" fill="#334155" /><circle cx="28" cy="30" r="3" fill="#CBD5E1" />
      <rect x="6" y="58" width="8" height="4" fill="#1F2937" /><rect x="42" y="58" width="8" height="4" fill="#1F2937" />
    </svg>
  )
}

export function Sofa({ left, color = '#7C3AED' }: { left: number; color?: string }) {
  return (
    <svg style={at({ left })} width="84" height="40" viewBox="0 0 84 40">
      <rect x="4" y="4" width="76" height="20" rx="6" fill={color} opacity="0.85" />
      <rect x="0" y="16" width="84" height="16" rx="6" fill={color} />
      <rect x="6" y="32" width="5" height="8" fill="#3B2A22" /><rect x="73" y="32" width="5" height="8" fill="#3B2A22" />
    </svg>
  )
}

export function ChartBoard({ left, bars }: { left: number; bars: number[] }) {
  const max = Math.max(...bars, 1)
  return (
    <svg style={at({ left, bottom: 50 })} width="120" height="72" viewBox="0 0 120 72">
      <rect x="0" y="0" width="120" height="72" rx="3" fill="#1F3B2E" stroke="#6E4630" strokeWidth="4" />
      {bars.map((b, i) => {
        const h = 6 + (b / max) * 46
        return <rect key={i} x={10 + i * 15} y={62 - h} width="10" height={h} fill={i === bars.length - 1 ? '#FBBF24' : '#86EFAC'} className="sim-bar" style={{ animationDelay: `${i * 0.08}s` }} />
      })}
    </svg>
  )
}

export function Frame({ left, bottom = 60, src }: { left: number; bottom?: number; src?: string | null }) {
  return (
    <div className="sim-frame" style={{ left, bottom }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : <span />}
    </div>
  )
}

export function Easel({ left, colors }: { left: number; colors: string[] }) {
  return (
    <svg style={at({ left })} width="70" height="92" viewBox="0 0 70 92">
      <path d="M14 92 L30 20 M56 92 L40 20 M35 92 L35 20" stroke="#6E4630" strokeWidth="4" />
      <rect x="6" y="6" width="58" height="46" rx="2" fill="#F8FAFC" stroke="#8B5A3C" strokeWidth="3" />
      {colors.slice(0, 4).map((c, i) => <rect key={i} x={12 + i * 13} y="14" width="10" height="30" fill={c} />)}
    </svg>
  )
}

/** Speech bubble with an alert above someone / something */
export function Bubble({ left, bottom, text, tone = 'warn' }: { left: number; bottom: number; text: string; tone?: 'warn' | 'ok' | 'info' }) {
  return <div className={`sim-bubble ${tone}`} style={{ left, bottom }}>{text}</div>
}
