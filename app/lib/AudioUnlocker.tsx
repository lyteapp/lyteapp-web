'use client'

import { useState, useEffect } from 'react'
import { useLyteSound } from './useLyteSound'

const STORAGE_KEY = 'lyte-audio-unlocked'

export function AudioUnlocker() {
  const [visible, setVisible] = useState(false)
  const { unlock } = useLyteSound()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  async function handleStart() {
    try { await unlock() } catch { /* ignore */ }
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoLyte}>Lyte</span>
          <span style={styles.logoApp}>app</span>
        </div>
        <p style={styles.tagline}>Lighter. Faster.</p>
        <button style={styles.btn} onClick={handleStart}>
          Iniciar jornada
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position:        'fixed',
    inset:           0,
    zIndex:          9999,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      'rgba(245, 243, 239, 0.92)',
    backdropFilter:  'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  card: {
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    gap:             20,
    padding:         '48px 56px',
    background:      '#FFFFFF',
    borderRadius:    24,
    boxShadow:       '0 12px 40px rgba(124, 58, 237, 0.12)',
    border:          '1px solid rgba(124, 58, 237, 0.10)',
  },
  logo: {
    fontSize:        32,
    fontWeight:      700,
    letterSpacing:   '-0.5px',
    lineHeight:      1,
  },
  logoLyte: {
    color: '#7C3AED',
  },
  logoApp: {
    color: '#1E1B4B',
  },
  tagline: {
    margin:          0,
    fontSize:        13,
    color:           '#94A3B8',
    letterSpacing:   '0.08em',
    textTransform:   'uppercase' as const,
    fontWeight:      500,
  },
  btn: {
    marginTop:       8,
    padding:         '14px 36px',
    background:      '#7C3AED',
    color:           '#FFFFFF',
    border:          'none',
    borderRadius:    12,
    fontSize:        15,
    fontWeight:      600,
    cursor:          'pointer',
    letterSpacing:   '-0.1px',
    transition:      'background 0.15s',
  },
}
