'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Kiosk payment proof: the tablet's front camera with a phone-shaped guide.
// The customer holds up the phone showing their payment confirmation and
// the photo takes itself once a lit screen has been held still inside the
// guide for a moment ("Tomar foto ahora" does it sooner, e.g. for a dark-mode
// receipt the brightness check can't see). Only the guide area is kept.

const SAMPLE_MS = 120
const STEADY_MS = 700      // held still this long → the countdown starts
const COUNTDOWN_MS = 2000  // and still through it → the photo is taken
const SAMPLE_W = 96        // width of the tiny frame copy used for detection

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
  // (only ever rendered in the browser — no camera API means no camera)
  const [state, setState] = useState<'starting' | 'live' | 'shot' | 'error'>(
    () => (typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'starting' : 'error'))
  const [hint, setHint] = useState<'place' | 'hold' | 'shooting'>('place')
  const [progress, setProgress] = useState(0)
  const [shot, setShot] = useState<Shot | null>(null)

  // Camera on (front camera), and off again when this closes
  useEffect(() => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return
    let cancelled = false
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
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

  const capture = useCallback(() => {
    const v = videoRef.current
    const g = guideInVideo()
    if (!v || !g) return
    // a little room around the guide, so the receipt's edges aren't lost
    const mx = g.w * 0.12, my = g.h * 0.06
    const x = Math.max(0, g.x - mx), y = Math.max(0, g.y - my)
    const w = Math.min(g.vw - x, g.w + mx * 2), h = Math.min(g.vh - y, g.h + my * 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w); canvas.height = Math.round(h)
    canvas.getContext('2d')?.drawImage(v, x, y, w, h, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'comprobante.jpg', { type: 'image/jpeg' })
      setShot({ url: URL.createObjectURL(blob), file })
      setState('shot')
    }, 'image/jpeg', 0.92)
  }, [guideInVideo])

  // Watches the guide: a phone screen there is brighter than what's around
  // it and has detail (text) on it; held still, it gets its photo taken.
  useEffect(() => {
    if (state !== 'live') return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let prev: Float32Array | null = null
    let still = 0
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
      let outSum = 0, outN = 0
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          if (x >= x0 && x < x1 && y >= y0 && y < y1) inside.push(lum)
          else { outSum += lum; outN++ }
        }
      }
      if (!inside.length) return
      const cur = Float32Array.from(inside)
      const mean = inside.reduce((a, b) => a + b, 0) / inside.length
      const sd = Math.sqrt(inside.reduce((a, b) => a + (b - mean) ** 2, 0) / inside.length)
      const outMean = outN ? outSum / outN : 0
      let diff = 255
      if (prev && prev.length === cur.length) {
        let d = 0
        for (let i = 0; i < cur.length; i++) d += Math.abs(cur[i] - prev[i])
        diff = d / cur.length
      }
      prev = cur
      const present = mean - outMean > 12 && sd > 10
      const steady = diff < 6
      if (present && steady) still += SAMPLE_MS
      else still = 0
      const p = Math.min(1, Math.max(0, (still - STEADY_MS) / COUNTDOWN_MS))
      setProgress(p)
      seen = present ? Math.min(seen + 1, 4) : Math.max(seen - 1, 0)
      setHint(p > 0 ? 'shooting' : seen >= 3 ? 'hold' : 'place')
      if (still >= STEADY_MS + COUNTDOWN_MS) { clearInterval(id); capture() }
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [state, guideInVideo, capture])

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null); setProgress(0); setHint('place'); setState('live')
  }

  const hints = {
    place: 'Coloca tu teléfono dentro del recuadro',
    hold: 'Así, no lo muevas…',
    shooting: 'Tomando la foto…',
  }

  return (
    <div className="sf-cam" role="dialog" aria-modal="true" aria-label="Foto del comprobante">
      <div className="sf-cam-head">
        <div className="sf-cam-title">{state === 'shot' ? '¿Se lee bien?' : 'Muestra tu comprobante a la cámara'}</div>
        <div className="sf-cam-sub">
          {state === 'shot'
            ? 'Revisa que se vean el monto y la referencia del pago.'
            : 'Abre la confirmación del pago móvil en tu teléfono y ponlo frente a la cámara de la tablet.'}
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
              <div ref={guideRef} className={`sf-cam-guide${hint !== 'place' ? ' ok' : ''}`}>
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

      {state === 'live' && <div className={`sf-cam-hint${hint !== 'place' ? ' ok' : ''}`} aria-live="polite">{hints[hint]}</div>}

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
            <button type="button" className="sf-cam-btn light" disabled={state !== 'live'} onClick={capture}>Tomar foto ahora</button>
          </>
        )}
      </div>
    </div>
  )
}
