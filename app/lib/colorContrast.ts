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
