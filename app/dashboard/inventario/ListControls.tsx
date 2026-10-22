'use client'

import { useEffect, useState } from 'react'

// Sort + view controls shared by the Inventario lists. The choice is
// remembered per list in this browser.

export type ListView = 'list' | 'photos' | 'grid'
export type SortOption = { id: string; label: string }

export function useListPrefs(key: string, defaultSort: string) {
  const [sort, setSort] = useState(defaultSort)
  const [view, setView] = useState<ListView>('photos')
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lyte:inv-list:${key}`)
      if (!raw) return
      const v = JSON.parse(raw) as { sort?: string; view?: ListView }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference
      if (v.sort) setSort(v.sort)
      if (v.view) setView(v.view)
    } catch { /* private mode */ }
  }, [key])
  const save = (next: { sort?: string; view?: ListView }) => {
    try { localStorage.setItem(`lyte:inv-list:${key}`, JSON.stringify({ sort, view, ...next })) } catch { /* private mode */ }
  }
  return {
    sort, view,
    setSort: (s: string) => { setSort(s); save({ sort: s }) },
    setView: (v: ListView) => { setView(v); save({ view: v }) },
  }
}

const VIEWS: { id: ListView; label: string; icon: React.ReactNode }[] = [
  { id: 'list', label: 'Lista', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3z" /></svg> },
  { id: 'photos', label: 'Con fotos', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 4h5v5H2zm7 1h9v2H9zM2 11h5v5H2zm7 1h9v2H9z" /></svg> },
  { id: 'grid', label: 'Cuadros', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z" /></svg> },
]

export default function ListControls({ sorts, sort, onSort, view, onView }: {
  sorts: SortOption[]
  sort: string
  onSort: (s: string) => void
  view: ListView
  onView: (v: ListView) => void
}) {
  return (
    <div className="inv-listctl">
      <label className="inv-listctl-sort">
        <span>Ordenar</span>
        <select className="inv-input" value={sort} onChange={e => onSort(e.target.value)}>
          {sorts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <div className="inv-viewseg" role="group" aria-label="Vista">
        {VIEWS.map(v => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => onView(v.id)} title={v.label} aria-pressed={view === v.id}>
            {v.icon}<span>{v.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Sorts rows and, for the 'category' sort, splits them into titled groups. */
export function sortAndGroup<T>(rows: T[], sort: string, opts: {
  name: (r: T) => string
  category: (r: T) => string | null | undefined
  keys?: Record<string, (r: T) => number>
}): { title: string | null; rows: T[] }[] {
  const byName = (a: T, b: T) => opts.name(a).localeCompare(opts.name(b), 'es', { sensitivity: 'base' })
  const list = [...rows]
  if (sort === 'name_desc') return [{ title: null, rows: list.sort((a, b) => -byName(a, b)) }]
  if (sort === 'category') {
    const groups = new Map<string, T[]>()
    for (const r of list.sort(byName)) {
      const c = opts.category(r)?.trim() || 'Sin categoría'
      groups.set(c, [...(groups.get(c) ?? []), r])
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === 'Sin categoría' ? 1 : b === 'Sin categoría' ? -1 : a.localeCompare(b, 'es')))
      .map(([title, rows]) => ({ title, rows }))
  }
  const [key, dir] = sort.split(':')
  const fn = opts.keys?.[key]
  if (fn) return [{ title: null, rows: list.sort((a, b) => (dir === 'desc' ? fn(b) - fn(a) : fn(a) - fn(b)) || byName(a, b)) }]
  return [{ title: null, rows: list.sort(byName) }]
}

/** Photo (or the name's initial) shown in the 'photos' and 'grid' views */
export function Thumb({ src, name }: { src?: string | null; name: string }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="inv-thumb" src={src} alt="" loading="lazy" />
    : <span className="inv-thumb inv-thumb-empty">{name.trim()[0]?.toUpperCase() ?? '?'}</span>
}
