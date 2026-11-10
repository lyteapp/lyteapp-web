export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '').trim()
  const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return false
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

export function poweredByColors(isLight: boolean) {
  return isLight
    ? { text: 'rgba(0,0,0,0.75)', strong: 'rgba(0,0,0,0.95)' }
    : { text: 'rgba(255,255,255,0.85)', strong: 'rgba(255,255,255,1)' }
}

// Colors for what sits inside a colored box (the kiosk's new-customer
// steps, Pagina de inicio): dark text and a dark main button on a light
// box, white text and a white button (in the box's own color) on a dark one.
export function boxTheme(bg: string) {
  return isLightColor(bg)
    ? { text: '#0F172A', nextBg: '#0F172A', nextText: '#FFFFFF', line: 'rgba(15,23,42,0.28)' }
    : { text: '#FFFFFF', nextBg: '#FFFFFF', nextText: bg, line: 'rgba(255,255,255,0.4)' }
}
