'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Kiosk payment proof: the tablet's front camera with a phone-shaped guide.
// The customer holds up the phone showing their payment confirmation and
// the photo takes itself once a lit screen has been held still inside the
// guide for a moment ("Tomar foto ahora" does it sooner, e.g. for a dark-mode
// receipt the brightness check can't see). Only the guide area is kept.

const SAMPLE_MS = 120
const STEADY_MS = 400      // held (about) still this long → the countdown starts
const COUNTDOWN_MS = 1500  // and through it → the photo is taken
const SAMPLE_W = 96        // width of the tiny frame copy used for detection
const SHARP_W = 360        // width of the copy used to judge how sharp a frame is

// How sharp a picture is: the variance of its edges (Laplacian) on a small
// grey copy — a shaky, out-of-focus frame scores low.
function sharpness(src: HTMLCanvasElement): number {
  const w = Math.min(SHARP_W, src.width), h = Math.max(1, Math.round(src.height * (w / src.width)))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  ctx.drawImage(src, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114
  let sum = 0, sum2 = 0, n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]
      sum += l; sum2 += l * l; n++
    }
  }
  return n ? sum2 / n - (sum / n) ** 2 : 0
}

// A phone screen too bright to read: the camera sees a big white area with
// (almost) no darker strokes in it — the letters got washed out. Looks for
// the bright area, then for anything clearly darker than its white inside it.
const WASH_W = 240
function screenWashedOut(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): boolean {
  const w = WASH_W, h = Math.max(1, Math.round(sh * (w / sw)))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const lum = new Uint8Array(w * h)
  let minx = w, miny = h, maxx = -1, maxy = -1
  const hist = new Uint32Array(256)
  let brightN = 0
  for (let i = 0; i < w * h; i++) {
    const l = Math.round(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114)
    lum[i] = l
    if (l >= 215) {
      const x = i % w, y = (i / w) | 0
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y
      hist[l]++; brightN++
    }
  }
  if (maxx < 0) return false
  const bw = maxx - minx + 1, bh = maxy - miny + 1
  if (bw * bh < 0.25 * w * h || brightN < 0.6 * bw * bh) return false // no big white screen there
  let acc = 0, white = 255
  for (let v = 255; v >= 215; v--) { acc += hist[v]; if (acc >= brightN / 2) { white = v; break } }
  // a 1-2px inset keeps the screen's own edge out of the count
  let ink = 0, n = 0
  for (let y = miny + 2; y <= maxy - 2; y++) {
    for (let x = minx + 2; x <= maxx - 2; x++) { n++; if (lum[y * w + x] < white - 45) ink++ }
  }
  return n > 0 && ink / n < 0.015
}

// Makes a phone screen's text stand out: stretches the contrast (a bright
// screen comes out greyish on camera) and sharpens the edges a little.
function enhance(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const { width: w, height: h } = c
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)]++
  const total = w * h
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.01) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.01) { hi = v; break } }
  const scale = hi - lo > 40 ? 255 / (hi - lo) : 1
  const src = new Uint8ClampedArray(d.length)
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) src[i + k] = scale === 1 ? d[i + k] : (d[i + k] - lo) * scale
    src[i + 3] = 255
  }
  // unsharp: pixel + 0.6 × (pixel − its 3×3 average); skipped on huge frames
  if (w * h <= 5_000_000) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4
        for (let k = 0; k < 3; k++) {
          let s = 0
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[i + (dy * w + dx) * 4 + k]
          d[i + k] = src[i + k] + 0.6 * (src[i + k] - s / 9)
        }
      }
    }
  } else d.set(src)
  ctx.putImageData(img, 0, 0)
}

type Shot = { url: string; file: File }

export default function ProofCamera({ onCapture, onClose, onFallback }: {
  onCapture: (file: File) => void
  onClose: () => void
  /** Pick a photo the usual way instead (when the camera can't be used) */
  onFallback: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Android: the camera's exposure, lowered step by step while the screen washes out
  const exposure = useRef<{ track: MediaStreamTrack; value: number; min: number; step: number; last: number } | null>(null)
  const [shotWashed, setShotWashed] = useState(false)
  // (only ever rendered in the browser — no camera API means no camera)
  const [state, setState] = useState<'starting' | 'live' | 'shot' | 'error'>(
    () => (typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'starting' : 'error'))
  const [hint, setHint] = useState<'place' | 'hold' | 'shooting' | 'bright'>('place')
  const [progress, setProgress] = useState(0)
  const [shot, setShot] = useState<Shot | null>(null)

  // Camera on (front camera), and off again when this closes
  useEffect(() => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return
    let cancelled = false
    navigator.mediaDevices.getUserMedia({
      // as many pixels as the camera gives (up to 4K): the receipt's text is
      // only a part of the frame
      video: { facingMode: 'user', width: { ideal: 3840 }, height: { ideal: 2160 } },
      audio: false,
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      // Where the device allows it (Android): keep focusing, and expose a bit
      // darker so the phone's bright screen isn't washed out. iPads ignore it.
      try {
        const track = stream.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>
        const adv: Record<string, unknown>[] = []
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) adv.push({ focusMode: 'continuous' })
        const ec = caps.exposureCompensation as { min?: number; step?: number } | undefined
        if (ec && typeof ec.min === 'number') {
          const start = Math.max(ec.min, -1)
          adv.push({ exposureCompensation: start })
          exposure.current = { track, value: start, min: ec.min, step: ec.step || 0.33, last: 0 }
        }
        if (adv.length) track.applyConstraints({ advanced: adv as MediaTrackConstraintSet[] }).catch(() => {})
      } catch {}
      const v = videoRef.current
      if (v) { v.srcObject = stream; v.play().catch(() => {}) }
    }).catch(() => { if (!cancelled) setState('error') })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // The guide's area in the video's own pixels. The video fills the stage
  // like object-fit: cover and is shown mirrored (like a selfie, so moving
  // the phone feels natural), while the frames themselves aren't.
  const guideInVideo = useCallback(() => {
    const v = videoRef.current, stage = stageRef.current, guide = guideRef.current
    if (!v || !stage || !guide || !v.videoWidth) return null
    const sr = stage.getBoundingClientRect(), gr = guide.getBoundingClientRect()
    const s = Math.max(sr.width / v.videoWidth, sr.height / v.videoHeight)
    const ox = (sr.width - v.videoWidth * s) / 2, oy = (sr.height - v.videoHeight * s) / 2
    const gxMirrored = sr.width - (gr.left - sr.left) - gr.width
    return {
      x: (gxMirrored - ox) / s, y: (gr.top - sr.top - oy) / s,
      w: gr.width / s, h: gr.height / s,
      vw: v.videoWidth, vh: v.videoHeight,
    }
  }, [])

  // The guide's area of the current frame, at the camera's full resolution
  const crop = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current
    const g = guideInVideo()
    if (!v || !g) return null
    // a little room around the guide, so the receipt's edges aren't lost
    const mx = g.w * 0.12, my = g.h * 0.06
    const x = Math.max(0, g.x - mx), y = Math.max(0, g.y - my)
    const w = Math.min(g.vw - x, g.w + mx * 2), h = Math.min(g.vh - y, g.h + my * 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w); canvas.height = Math.round(h)
    canvas.getContext('2d')?.drawImage(v, x, y, w, h, 0, 0, canvas.width, canvas.height)
    return canvas
  }, [guideInVideo])

  const finish = useCallback((canvas: HTMLCanvasElement) => {
    setShotWashed(screenWashedOut(canvas, 0, 0, canvas.width, canvas.height))
    enhance(canvas)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'comprobante.jpg', { type: 'image/jpeg' })
      setShot({ url: URL.createObjectURL(blob), file })
      setState('shot')
    }, 'image/jpeg', 0.95)
  }, [])

  // "Tomar foto ahora": a short burst, keeping the sharpest frame
  const best = useRef<{ canvas: HTMLCanvasElement; score: number } | null>(null)
  const burst = useCallback(async () => {
    let top: { canvas: HTMLCanvasElement; score: number } | null = null
    for (let n = 0; n < 5; n++) {
      const c = crop()
      if (c) { const sc = sharpness(c); if (!top || sc > top.score) top = { canvas: c, score: sc } }
      await new Promise(r => setTimeout(r, 80))
    }
    if (top) finish(top.canvas)
  }, [crop, finish])

  // Watches the guide: a phone screen there is brighter than what's around
  // it and has detail (text) on it; held still, it gets its photo taken.
  useEffect(() => {
    if (state !== 'live') return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let prev: Float32Array | null = null
    let prevMean = -1, prevSd = -1
    let washed = 0 // how sure we are the screen is too bright (so the message doesn't flicker)
    let still = 0
    best.current = null
    let seen = 0 // how sure we are a phone is there (so the message doesn't flicker)
    const id = setInterval(() => {
      const v = videoRef.current
      const g = guideInVideo()
      if (!v || !g || !ctx) return
      const k = SAMPLE_W / g.vw
      canvas.width = SAMPLE_W; canvas.height = Math.max(1, Math.round(g.vh * k))
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const x0 = Math.max(0, Math.floor(g.x * k)), x1 = Math.min(canvas.width, Math.ceil((g.x + g.w) * k))
      const y0 = Math.max(0, Math.floor(g.y * k)), y1 = Math.min(canvas.height, Math.ceil((g.y + g.h) * k))
      const inside: number[] = []
      let outSum = 0, outSum2 = 0, outN = 0
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          if (x >= x0 && x < x1 && y >= y0 && y < y1) inside.push(lum)
          else { outSum += lum; outSum2 += lum * lum; outN++ }
        }
      }
      if (!inside.length) return
      const cur = Float32Array.from(inside)
      const mean = inside.reduce((a, b) => a + b, 0) / inside.length
      const sd = Math.sqrt(inside.reduce((a, b) => a + (b - mean) ** 2, 0) / inside.length)
      const outMean = outN ? outSum / outN : 0
      const outSd = outN ? Math.sqrt(Math.max(0, outSum2 / outN - outMean * outMean)) : 0
      let diff = 255
      if (prev && prev.length === cur.length) {
        let d = 0
        for (let i = 0; i < cur.length; i++) d += Math.abs(cur[i] - prev[i])
        diff = d / cur.length
      }
      prev = cur
      const dMean = prevMean < 0 ? 255 : Math.abs(mean - prevMean), dSd = prevSd < 0 ? 255 : Math.abs(sd - prevSd)
      prevMean = mean; prevSd = sd
      // Forgiving on purpose: a lit screen a bit brighter than the room, or
      // more detail (text) than around it even on a dark-mode receipt; a hand's normal
      // shake only slows the countdown down instead of restarting it
      // (the detail has to stand out from the room around it — so a busy
      // wall or poster alone doesn't take a photo)
      const present = (mean - outMean > 6 && sd > 7) || (sd > 22 && sd > outSd * 1.25)
      // still enough: the picture barely changed, or (a hand's shake moving it
      // a few pixels) its overall brightness and detail stayed the same
      const steady = diff < 14 || (dMean < 4 && dSd < 5)
      // A screen so bright its letters are washed out: no photo (it couldn't
      // be read) — ask to dim it, and darken the camera where possible
      const tooBright = present && screenWashedOut(v, g.x, g.y, g.w, g.h)
      washed = tooBright ? Math.min(washed + 1, 4) : Math.max(washed - 1, 0)
      const ex = exposure.current
      if (washed >= 2 && ex && ex.value > ex.min && Date.now() - ex.last > 800) {
        ex.value = Math.max(ex.min, ex.value - ex.step * 2); ex.last = Date.now()
        ex.track.applyConstraints({ advanced: [{ exposureCompensation: ex.value } as MediaTrackConstraintSet] }).catch(() => {})
      }
      if (washed >= 2) { still = 0; best.current = null }
      else if (present && steady) still += SAMPLE_MS
      else if (present) still = Math.max(0, still - SAMPLE_MS * 2)
      else still = Math.max(0, still - SAMPLE_MS * 4)
      const p = Math.min(1, Math.max(0, (still - STEADY_MS) / COUNTDOWN_MS))
      // during the countdown, keep the sharpest frame seen (least shaky)
      if (p > 0) {
        const c = crop()
        if (c) {
          const sc = sharpness(c)
          if (!best.current || sc > best.current.score) best.current = { canvas: c, score: sc }
        }
      }
      setProgress(p)
      seen = present ? Math.min(seen + 1, 4) : Math.max(seen - 1, 0)
      setHint(washed >= 2 ? 'bright' : p > 0 ? 'shooting' : seen >= 3 ? 'hold' : 'place')
      if (still >= STEADY_MS + COUNTDOWN_MS) {
        clearInterval(id)
        const c = best.current?.canvas ?? crop()
        if (c) finish(c)
      }
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [state, guideInVideo, crop, finish])

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null); setShotWashed(false); setProgress(0); setHint('place'); setState('live')
  }

  const hints = {
    place: 'Coloca tu teléfono dentro del recuadro',
    hold: 'Así, no lo muevas…',
    shooting: 'Tomando la foto…',
    bright: 'Tu pantalla está muy brillante: baja el brillo del teléfono',
  }

  return (
    <div className="sf-cam" role="dialog" aria-modal="true" aria-label="Foto del comprobante">
      <div className="sf-cam-head">
        <div className="sf-cam-title">{state === 'shot' ? '¿Se lee bien?' : 'Muestra tu comprobante a la cámara'}</div>
        <div className="sf-cam-sub">
          {state === 'shot'
            ? 'Revisa que se vean el monto y la referencia del pago.'
            : 'Abre la confirmación del pago móvil en tu teléfono y ponlo frente a la cámara de la tablet, a unos 25 cm.'}
        </div>
      </div>

      <div className="sf-cam-stage" ref={stageRef}>
        {state === 'error' ? (
          <div className="sf-cam-error">
            <div className="sf-cam-error-title">No pudimos abrir la cámara</div>
            <div>Revisa que esta pantalla tenga permiso para usar la cámara, o sube la foto del pago.</div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef} className="sf-cam-video" playsInline muted autoPlay
              onLoadedData={() => setState(s => (s === 'starting' ? 'live' : s))}
            />
            {state !== 'shot' && (
              <div ref={guideRef} className={`sf-cam-guide${hint === 'bright' ? ' warn' : hint !== 'place' ? ' ok' : ''}`}>
                <span className="sf-cam-guide-notch" />
                {progress > 0 && (
                  <span className="sf-cam-guide-bar"><span style={{ transform: `scaleX(${progress})` }} /></span>
                )}
              </div>
            )}
            {shot && <img src={shot.url} alt="Foto del comprobante" className="sf-cam-shot" />}
            {state === 'starting' && <div className="sf-cam-starting">Abriendo la cámara…</div>}
          </>
        )}
      </div>

      {state === 'live' && <div className={`sf-cam-hint${hint === 'bright' ? ' warn' : hint !== 'place' ? ' ok' : ''}`} aria-live="polite">{hints[hint]}</div>}
      {state === 'shot' && shotWashed && (
        <div className="sf-cam-hint warn" role="alert">La foto salió muy clara. Baja el brillo de tu teléfono y toma otra.</div>
      )}

      <div className="sf-cam-actions">
        {state === 'shot' && shot ? (
          <>
            <button type="button" className="sf-cam-btn" onClick={retake}>Tomar otra</button>
            <button type="button" className="sf-cam-btn primary" onClick={() => onCapture(shot.file)}>Usar esta foto</button>
          </>
        ) : state === 'error' ? (
          <>
            <button type="button" className="sf-cam-btn" onClick={onClose}>Cancelar</button>
            <button type="button" className="sf-cam-btn primary" onClick={onFallback}>Subir foto del pago</button>
          </>
        ) : (
          <>
            <button type="button" className="sf-cam-btn" onClick={onClose}>Cancelar</button>
            <button type="button" className="sf-cam-btn light" disabled={state !== 'live'} onClick={burst}>Tomar foto ahora</button>
          </>
        )}
      </div>
    </div>
  )
}
