'use client'

import { useEffect, useMemo, useRef } from 'react'

// Keeps storefront videos (welcome background, banner, content blocks) in
// memory once they've been seen, so coming back to the welcome page or to a
// category doesn't download them again. Phones — iOS Safari especially —
// don't reliably reuse the HTTP cache for <video> range requests, so a
// remounted element would otherwise re-fetch a multi-MB file from scratch.
//
// The first time a video plays it streams from the network as usual (fast
// start). When that element unmounts, the file is fetched once more in the
// background (usually from the browser's cache) and kept as a blob: URL;
// every later mount plays it instantly from memory.

const MAX_FILE = 40 * 1024 * 1024
const MAX_TOTAL = 160 * 1024 * 1024

type Entry = { url: string; size: number; users: number }
const cache = new Map<string, Entry>()
const pending = new Set<string>()
let total = 0

function evict(need: number) {
  // oldest first (Map keeps insertion order); never one that's on screen
  for (const [src, e] of cache) {
    if (total + need <= MAX_TOTAL) break
    if (e.users > 0) continue
    URL.revokeObjectURL(e.url)
    cache.delete(src)
    total -= e.size
  }
}

function use(src: string, d: number) {
  const e = cache.get(src)
  if (e) e.users += d
}

export function warmVideo(src?: string | null) {
  if (!src || src.startsWith('blob:') || src.startsWith('data:') || cache.has(src) || pending.has(src)) return
  pending.add(src)
  fetch(src)
    .then(r => {
      const len = Number(r.headers.get('content-length') || 0)
      if (!r.ok || len > MAX_FILE) { r.body?.cancel(); throw new Error('skip') }
      return r.blob()
    })
    .then(b => {
      if (b.size > MAX_FILE) return
      evict(b.size)
      if (total + b.size > MAX_TOTAL) return
      cache.set(src, { url: URL.createObjectURL(b), size: b.size, users: 0 })
      total += b.size
    })
    .catch(() => {})
    .finally(() => pending.delete(src))
}

/** A <video> that plays from the in-memory copy when there is one. Only a
 *  video that actually played gets kept (not a tap-to-play one left alone). */
export function CachedVideo({ src, onPlaying, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & { src: string; ref?: React.Ref<HTMLVideoElement> }) {
  // picked once per src, so a copy arriving mid-playback doesn't restart it
  const entry = useMemo(() => cache.get(src), [src])
  const played = useRef(false)
  useEffect(() => {
    if (entry) use(src, 1)
    return () => {
      if (entry) use(src, -1)
      else if (played.current) warmVideo(src)
    }
  }, [src, entry])
  return (
    <video
      src={entry?.url ?? src}
      onPlaying={e => { played.current = true; onPlaying?.(e) }}
      {...props}
    />
  )
}
