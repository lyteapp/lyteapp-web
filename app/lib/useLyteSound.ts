'use client'

import { useCallback } from 'react'

export interface LyteSoundOptions {
  frequency?: number
  gapMs?: number
  detuneCents?: number
  duration?: number
  brightness?: number
  clickAmount?: number
  resonance?: number
  masterVolume?: number
  ringCount?: number
}

const DEFAULTS: Required<LyteSoundOptions> = {
  frequency:    2489,
  gapMs:        200,
  detuneCents:  -30,
  duration:     700,
  brightness:   0.80,
  clickAmount:  0.70,
  resonance:    0.40,
  masterVolume: 0.55,
  ringCount:    2,
}

const RATIOS        = [1.00, 2.00, 3.01, 4.13, 5.47]
const DECAY_FACTORS = [1.00, 0.75, 0.60, 0.45, 0.35]
const REL_GAINS     = [1.00, 0.55, 0.30, 0.18, 0.10]

function buildWav(opts: Required<LyteSoundOptions>): string {
  const { frequency, gapMs, detuneCents, duration, brightness,
          clickAmount, resonance, masterVolume, ringCount } = opts
  const sr   = 44100
  const dur  = duration / 1000
  const gap  = gapMs / 1000
  const freq2 = frequency * Math.pow(2, -detuneCents / 1200)
  const total = dur + (ringCount - 1) * gap + 0.08
  const n    = Math.floor(sr * total)
  const buf  = new Float32Array(n)

  const strike = (t0: number, freq: number, volScale: number) => {
    const i0          = Math.floor(t0 * sr)
    const clickLevel  = 0.20 * clickAmount * masterVolume * volScale
    const clickEnd    = Math.min(i0 + Math.floor(0.025 * sr), n)

    // Click: decaying white noise (approximates filtered highpass noise)
    for (let i = i0; i < clickEnd; i++) {
      const t = (i - i0) / sr
      buf[i] += clickLevel * Math.exp(-t / 0.007) * (Math.random() * 2 - 1)
    }

    // Sinusoidal partials
    for (let k = 0; k < RATIOS.length; k++) {
      const f          = freq * RATIOS[k]
      const partialDur = dur * DECAY_FACTORS[k] * (0.5 + resonance * 0.8)
      const relGain    = k === 0 ? REL_GAINS[0] : REL_GAINS[k] * brightness
      const level      = relGain * 0.4 * masterVolume * volScale
      const tau        = partialDur / 5
      const end        = Math.min(i0 + Math.floor(partialDur * sr), n)

      for (let i = i0; i < end; i++) {
        const t   = (i - i0) / sr
        const env = Math.min(t / 0.005, 1.0) * Math.exp(-t / tau)
        buf[i]   += level * env * Math.sin(2 * Math.PI * f * t)
      }
    }
  }

  for (let ring = 0; ring < ringCount; ring++) {
    const freq = ring === 0 ? frequency : freq2
    strike(ring * gap, freq, ring === 0 ? 1.0 : 0.92)
  }

  // Normalize to -1.2 dB
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]))
  const sc = peak > 0.87 ? 0.87 / peak : 1.0

  // WAV header
  const ab = new ArrayBuffer(44 + n * 2)
  const dv = new DataView(ab)
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE')
  ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  ws(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const x = buf[i] * sc
    dv.setInt16(44 + i * 2, Math.round(x * (x < 0 ? 0x8000 : 0x7FFF)), true)
  }

  // Base64 encode
  const bytes = new Uint8Array(ab)
  let b = ''
  for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i])
  return 'data:audio/wav;base64,' + btoa(b)
}

// Module-level singletons
let _audio: HTMLAudioElement | null = null
let _unlocked = false

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio(buildWav(DEFAULTS))
    _audio.preload = 'auto'
  }
  return _audio
}

export function useLyteSound() {
  // Call inside a user-gesture handler to unblock future programmatic play
  const unlock = useCallback(() => {
    if (_unlocked || typeof window === 'undefined') return
    const audio = getAudio()
    audio.play().then(() => {
      audio.pause()
      audio.currentTime = 0
      _unlocked = true
    }).catch(() => {})
  }, [])

  const play = useCallback((overrides?: LyteSoundOptions) => {
    if (typeof window === 'undefined') return
    const opts = { ...DEFAULTS, ...overrides } as Required<LyteSoundOptions>
    if (opts.masterVolume <= 0) return

    // Custom options: generate and play a one-shot element
    if (overrides && Object.keys(overrides).length > 0) {
      const audio = new Audio(buildWav(opts))
      audio.play().catch(() => {})
      return
    }

    const audio = getAudio()
    audio.currentTime = 0
    audio.play().catch(() => {})
  }, [])

  return { play, unlock }
}
