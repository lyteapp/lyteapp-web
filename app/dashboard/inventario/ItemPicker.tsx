'use client'

import { useEffect, useRef, useState } from 'react'

// Type-to-search item field: shows the matching items as you type (by name,
// SKU, barcode or category; accents and case don't matter). Arrow keys +
// Enter, or tap, to pick.

type PickItem = { id: string; name: string; unit: string; sku?: string | null; barcode?: string | null; category?: string | null }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ItemPicker<T extends PickItem>({ items, value, onPick, onCreate, placeholder = 'Escribe para buscar…' }: {
  items: T[]
  value: string
  onPick: (item: T) => void
  /** Offers '+ Crear "…"' with what was typed (e.g. a new ingredient) */
  onCreate?: (name: string) => void
  placeholder?: string
}) {
  const selected = items.find(i => i.id === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // Close when tapping outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const q = fold(query.trim())
  const matches = (q
    ? items.filter(i => [i.name, i.sku, i.barcode, i.category].some(v => v && fold(v).includes(q)))
        // names that start with the text first
        .sort((a, b) => Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)) || a.name.localeCompare(b.name))
    : items
  ).slice(0, 30)

  function pick(i: T) {
    onPick(i)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="inv-picker" ref={boxRef}>
      <input
        className="inv-input"
        value={open ? query : selected?.name ?? ''}
        placeholder={selected ? selected.name : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0) }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onKeyDown={e => {
          if (!open) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) pick(matches[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <div className="inv-picker-list" role="listbox">
          {onCreate && (
            <button
              type="button"
              className="inv-picker-opt inv-picker-create"
              onPointerDown={e => e.preventDefault()}
              onClick={() => { onCreate(query.trim()); setQuery(''); setOpen(false) }}
            >
              <span>+ {query.trim() ? `Crear “${query.trim()}”` : 'Crear un artículo nuevo'}</span>
              <small>Se agrega a tus artículos</small>
            </button>
          )}
          {matches.length === 0 ? (
            !onCreate && <div className="inv-picker-empty">Ningún artículo coincide con “{query}”. Créalo en la pestaña Artículos.</div>
          ) : matches.map((i, idx) => (
            <button
              key={i.id}
              type="button"
              role="option"
              aria-selected={i.id === value}
              className={`inv-picker-opt${idx === active ? ' active' : ''}${i.id === value ? ' sel' : ''}`}
              onPointerDown={e => e.preventDefault()}
              onClick={() => pick(i)}
              onMouseEnter={() => setActive(idx)}
            >
              <span>{i.name}</span>
              <small>{[i.category, i.sku, i.unit].filter(Boolean).join(' · ')}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
