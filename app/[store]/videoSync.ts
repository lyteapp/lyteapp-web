'use client'

// Keeps a looping video at the same moment on every screen showing it (the
// welcome video on several kiosks side by side). There's no talking between
// the tablets: they all follow one shared clock — the server's — and play
// the loop as if it had started at midnight 1970, so at any instant each one
// knows exactly where in the video it should be. Their own clocks can be off
// by seconds, so each measures its difference from the server's first.

let offset: number | null = null
let measuring: Promise<void> | null = null

/** "Now" on the shared clock, in ms */
export function sharedNow() { return Date.now() + (offset ?? 0) }
export function clockKnown() { return offset !== null }

/** Measures this device's difference from the server's clock: a few round
 *  trips, keeping the fastest (the one where the answer's travel time
 *  leaves the least doubt). */
export function measureClock(force = false): Promise<void> {
  if (measuring && !force) return measuring
  measuring = (async () => {
    let best = { rtt: Infinity, off: 0 }
    for (let i = 0; i < 5; i++) {
      try {
        const w0 = Date.now(), t0 = performance.now()
        const r = await fetch(`/api/time?_=${Math.random().toString(36).slice(2)}`, { cache: 'no-store' })
        const { now } = await r.json() as { now: number }
        const rtt = performance.now() - t0
        if (rtt < best.rtt) best = { rtt, off: now - (w0 + rtt / 2) }
      } catch { /* try the next one */ }
    }
    if (best.rtt < Infinity) offset = best.off
  })()
  return measuring
}

const RESYNC = 'lyte-video-resync'
/** Measure the clock again and put every synced video right on time now */
export async function resyncVideos() {
  await measureClock(true)
  window.dispatchEvent(new Event(RESYNC))
}

/** Holds `v` on the shared timeline. Small differences are made up by
 *  playing a touch faster or slower (no visible jump); big ones by jumping,
 *  aimed ahead by however long a jump takes on this device (learned from the
 *  quick ones; a first jump that has to wait for the video to load says
 *  nothing about that). How far off it is shows in the element's
 *  data-sync-drift (seconds), for checking on the spot. */
export function syncVideo(v: HTMLVideoElement): () => void {
  let stopped = false
  let lastSeek = 0
  let seekLead = 0.15   // how far ahead to aim a jump, learned
  let seeking = false

  const drift = () => {
    // The loop length every screen counts with: rounded, because browsers
    // refine a video's length while it loads (12.00 → 12.03 s) and differ a
    // hair between devices — and with "now" being billions of seconds, the
    // slightest difference there would put each screen somewhere else. The
    // few hundredths left over each loop are made up like any small drift.
    const d = Math.round(v.duration * 10) / 10
    if (!clockKnown() || !isFinite(d) || d <= 0) return null
    const target = (sharedNow() / 1000) % d
    let x = v.currentTime - target
    if (x > d / 2) x -= d
    if (x < -d / 2) x += d
    return { d, target, x }
  }
  const jump = () => {
    const w = drift()
    if (!w) return
    seeking = true
    lastSeek = performance.now()
    v.playbackRate = 1
    v.currentTime = (w.target + seekLead) % w.d
  }
  const check = (hard = false) => {
    if (stopped || seeking) return
    const w = drift()
    if (!w || v.readyState < 2) return
    v.dataset.syncDrift = w.x.toFixed(3)
    if (hard || (Math.abs(w.x) > 0.5 && performance.now() - lastSeek > 1000)) { jump(); return }
    if (v.paused) return
    // ahead → slow down a little, behind → speed up a little (a background
    // video a few % faster or slower for a moment isn't noticeable)
    v.playbackRate = Math.abs(w.x) < 0.02 ? 1 : Math.min(1.12, Math.max(0.88, 1 - w.x))
  }
  const onSeeked = () => {
    if (!seeking) return
    seeking = false
    const took = (performance.now() - lastSeek) / 1000
    if (took < 1) seekLead = Math.min(0.6, Math.max(0.03, seekLead * 0.6 + took * 0.4))
  }

  const onMeta = () => check(true)
  const onPlaying = () => check()
  const onResync = () => { seeking = false; check(true) }
  v.addEventListener('loadedmetadata', onMeta)
  v.addEventListener('playing', onPlaying)
  v.addEventListener('seeked', onSeeked)
  window.addEventListener(RESYNC, onResync)
  measureClock().then(() => check(true))
  // a tablet left on for days gets its own clock adjusted now and then: the
  // difference is measured again every 10 minutes
  const remeasure = setInterval(() => { measureClock(true) }, 10 * 60 * 1000)
  const timer = setInterval(() => {
    // a jump that never reported back doesn't block the checks for good
    if (seeking && performance.now() - lastSeek > 3000) seeking = false
    check()
  }, 500)
  return () => {
    stopped = true
    clearInterval(timer)
    clearInterval(remeasure)
    v.removeEventListener('loadedmetadata', onMeta)
    v.removeEventListener('playing', onPlaying)
    v.removeEventListener('seeked', onSeeked)
    window.removeEventListener(RESYNC, onResync)
  }
}
