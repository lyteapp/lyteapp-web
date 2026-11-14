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

/** Holds `v` on the shared timeline.
 *
 *  Small differences (under a second) are made up by playing a touch faster
 *  or slower — no visible jump. A big one is fixed with a jump, done so it
 *  can't miss: it aims a little AHEAD of where the others will be (by how
 *  long a jump takes on this device, learned from every jump, slow ones
 *  included — on a tablet that has to fetch and decode that part of the
 *  video that can be seconds), freezes on that frame, and starts playing
 *  the instant the others reach it. Never jumps while the video is still
 *  loading, and after a few jumps in a row it lets the speed do the work
 *  for a while instead of jumping over and over.
 *
 *  How far off it is shows in the element's data-sync-drift (seconds), and
 *  data-sync-hold is set while it's frozen on purpose (the always-play
 *  nudges in CachedVideo leave it alone then). */
export function syncVideo(v: HTMLVideoElement): () => void {
  let stopped = false
  let state: 'run' | 'seek' | 'hold' = 'run'
  let seekStart = 0
  let seekTime = 0.4          // how long a jump takes here, learned
  let burst = 0               // jumps in a row that landed late
  let jumps: number[] = []    // when the recent jumps were
  let lastJumpEnd = 0
  let holdTimer: ReturnType<typeof setTimeout> | undefined

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
  const release = () => {
    clearTimeout(holdTimer)
    delete v.dataset.syncHold
    state = 'run'
    lastJumpEnd = performance.now()
    v.playbackRate = 1
    v.play().catch(() => {})
  }
  const jump = () => {
    const w = drift()
    if (!w) return
    clearTimeout(holdTimer)
    state = 'seek'
    seekStart = performance.now()
    jumps = [...jumps.filter(t => seekStart - t < 60000), seekStart]
    v.dataset.syncHold = '1'
    v.pause()
    v.playbackRate = 1
    // aim ahead by how long a jump takes, plus a margin to wait out
    v.currentTime = (w.target + seekTime + 0.3) % w.d
  }
  // landed: wait until it can really play, then line up
  const landed = () => {
    if (state !== 'seek' || stopped) return
    if (v.readyState < 3) return // 'canplay' brings it back here
    const took = (performance.now() - seekStart) / 1000
    seekTime = Math.min(6, Math.max(0.05, took > seekTime ? took : seekTime * 0.7 + took * 0.3))
    const w = drift()
    if (!w) { release(); return }
    v.dataset.syncDrift = w.x.toFixed(3)
    if (w.x >= 0 && w.x < 8) {
      // ahead (as aimed): hold this frame until the others get here
      burst = 0
      state = 'hold'
      holdTimer = setTimeout(release, Math.max(0, w.x * 1000 - 40))
    } else if (burst < 2) {
      // it took even longer than learned: aim again, further ahead
      burst++
      jump()
    } else {
      burst = 0
      release() // the speed makes up the rest
    }
  }
  const check = (hard = false) => {
    if (stopped) return
    if (state === 'seek') {
      // a jump that can't load that part (slow connection) doesn't hang
      // it: it plays on, loading as it goes, and the speed catches up
      if (performance.now() - seekStart > 4000) { burst = 0; release() }
      return
    }
    if (state === 'hold') return
    const w = drift()
    if (!w) return
    if (hard) { burst = 0; jump(); return }
    if (v.readyState < 3 || v.paused) return // still loading / stopped: nothing to judge
    v.dataset.syncDrift = w.x.toFixed(3)
    const now = performance.now()
    // after several jumps in the last minute, wait longer before another
    const coolDown = jumps.filter(t => now - t < 60000).length >= 3 ? 20000 : 1500
    if (Math.abs(w.x) > 1 && now - lastJumpEnd > coolDown) { jump(); return }
    // ahead → slow down a little, behind → speed up a little (a background
    // video a few % faster or slower for a moment isn't noticeable)
    v.playbackRate = Math.abs(w.x) < 0.02 ? 1 : Math.min(1.12, Math.max(0.88, 1 - w.x * 0.6))
  }

  const onMeta = () => check(true)
  const onResync = () => { if (state === 'hold') release(); state = 'run'; check(true) }
  v.addEventListener('loadedmetadata', onMeta)
  v.addEventListener('seeked', landed)
  v.addEventListener('canplay', landed)
  v.addEventListener('canplaythrough', landed)
  window.addEventListener(RESYNC, onResync)
  measureClock().then(() => check(true))
  // a tablet left on for days gets its own clock adjusted now and then: the
  // difference is measured again every 10 minutes
  const remeasure = setInterval(() => { measureClock(true) }, 10 * 60 * 1000)
  const timer = setInterval(() => { if (state === 'seek') landed(); check() }, 500)
  return () => {
    stopped = true
    clearTimeout(holdTimer)
    clearInterval(timer)
    clearInterval(remeasure)
    delete v.dataset.syncHold
    v.removeEventListener('loadedmetadata', onMeta)
    v.removeEventListener('seeked', landed)
    v.removeEventListener('canplay', landed)
    v.removeEventListener('canplaythrough', landed)
    window.removeEventListener(RESYNC, onResync)
  }
}
