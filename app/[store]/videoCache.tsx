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
export function CachedVideo({ src, onPlaying, ref, alwaysPlay, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & {
  src: string; ref?: React.Ref<HTMLVideoElement>
  /** Never left stopped: nudged, retried and started by the first touch
   *  (the welcome page's background). Not for videos paused on purpose. */
  alwaysPlay?: boolean
}) {
  // picked once per src, so a copy arriving mid-playback doesn't restart it
  const entry = useMemo(() => cache.get(src), [src])
  const played = useRef(false)
  const el = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (entry) use(src, 1)
    return () => {
      if (entry) use(src, -1)
      else if (played.current) warmVideo(src)
    }
  }, [src, entry])

  // An autoplaying video must start. The page arrives from the server
  // without the `muted` attribute (React only sets it as a property, after
  // the fact), so the browser tries to autoplay it WITH sound, refuses, and
  // never tries again: it's made muted for real here and told to play.
  // With alwaysPlay it's also nudged whenever it could play but isn't (data
  // arrived, stalled, the tab came back), reloaded a few times on a network
  // error, and if the device still won't autoplay (iPhone/iPad power
  // saving), the first touch anywhere on the screen starts it.
  const { autoPlay, muted } = props
  useEffect(() => {
    const v = el.current
    if (!v || !autoPlay) return
    if (muted) { v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '') }
    v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '')
    v.play().catch(() => {})
    if (!alwaysPlay) return
    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const kick = () => { if (v.paused && !v.ended && v.readyState >= 2) v.play().catch(() => {}) }
    const onError = () => {
      if (retries >= 3) return
      retries++
      retryTimer = setTimeout(() => { v.load(); v.play().catch(() => {}) }, 1000 * retries)
    }
    const onVisible = () => { if (!document.hidden) kick() }
    const onTouch = () => kick()
    const events = ['loadeddata', 'canplay', 'canplaythrough', 'stalled', 'suspend'] as const
    events.forEach(ev => v.addEventListener(ev, kick))
    v.addEventListener('error', onError)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', onTouch, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })
    return () => {
      clearTimeout(retryTimer)
      events.forEach(ev => v.removeEventListener(ev, kick))
      v.removeEventListener('error', onError)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', onTouch)
      window.removeEventListener('touchstart', onTouch)
    }
  }, [src, autoPlay, muted, alwaysPlay])

  return (
    <video
      ref={node => {
        el.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.RefObject<HTMLVideoElement | null>).current = node
      }}
      src={entry?.url ?? src}
      onPlaying={e => { played.current = true; onPlaying?.(e) }}
      {...props}
    />
  )
}
