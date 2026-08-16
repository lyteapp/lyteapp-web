export interface RevealFontOption {
  id: string
  name: string
  stack?: string
  googleFamily?: string
}

export const REVEAL_FONTS: RevealFontOption[] = [
  { id: 'default', name: 'Predeterminada (Fraunces + Geist)' },
  { id: 'inter', name: 'Inter', stack: "'Inter', system-ui, sans-serif", googleFamily: 'Inter:wght@400;500;600;700' },
  { id: 'roboto', name: 'Roboto', stack: "'Roboto', system-ui, sans-serif", googleFamily: 'Roboto:wght@400;500;700' },
  { id: 'poppins', name: 'Poppins', stack: "'Poppins', system-ui, sans-serif", googleFamily: 'Poppins:wght@400;500;600;700' },
  { id: 'montserrat', name: 'Montserrat', stack: "'Montserrat', system-ui, sans-serif", googleFamily: 'Montserrat:wght@400;500;600;700' },
  { id: 'lato', name: 'Lato', stack: "'Lato', system-ui, sans-serif", googleFamily: 'Lato:wght@400;700' },
  { id: 'dm-sans', name: 'DM Sans', stack: "'DM Sans', system-ui, sans-serif", googleFamily: 'DM+Sans:wght@400;500;700' },
  { id: 'nunito', name: 'Nunito', stack: "'Nunito', system-ui, sans-serif", googleFamily: 'Nunito:wght@400;600;700' },
  { id: 'raleway', name: 'Raleway', stack: "'Raleway', system-ui, sans-serif", googleFamily: 'Raleway:wght@400;500;600;700' },
  { id: 'oswald', name: 'Oswald', stack: "'Oswald', system-ui, sans-serif", googleFamily: 'Oswald:wght@400;500;600;700' },
  { id: 'playfair', name: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", googleFamily: 'Playfair+Display:wght@400;600;700' },
  { id: 'ubuntu', name: 'Ubuntu', stack: "'Ubuntu', system-ui, sans-serif", googleFamily: 'Ubuntu:wght@400;500;700' },
  { id: 'merriweather', name: 'Merriweather', stack: "'Merriweather', Georgia, serif", googleFamily: 'Merriweather:wght@400;700' },
  { id: 'cormorant', name: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif", googleFamily: 'Cormorant+Garamond:wght@400;500;600;700' },
  { id: 'josefin', name: 'Josefin Sans', stack: "'Josefin Sans', system-ui, sans-serif", googleFamily: 'Josefin+Sans:wght@400;500;600;700' },
  { id: 'quicksand', name: 'Quicksand', stack: "'Quicksand', system-ui, sans-serif", googleFamily: 'Quicksand:wght@400;500;600;700' },
  { id: 'work-sans', name: 'Work Sans', stack: "'Work Sans', system-ui, sans-serif", googleFamily: 'Work+Sans:wght@400;500;600;700' },
  { id: 'libre-baskerville', name: 'Libre Baskerville', stack: "'Libre Baskerville', Georgia, serif", googleFamily: 'Libre+Baskerville:wght@400;700' },
  { id: 'crimson', name: 'Crimson Text', stack: "'Crimson Text', Georgia, serif", googleFamily: 'Crimson+Text:wght@400;600;700' },
  { id: 'eb-garamond', name: 'EB Garamond', stack: "'EB Garamond', Georgia, serif", googleFamily: 'EB+Garamond:wght@400;500;600;700' },
  { id: 'space-grotesk', name: 'Space Grotesk', stack: "'Space Grotesk', system-ui, sans-serif", googleFamily: 'Space+Grotesk:wght@400;500;600;700' },
  { id: 'outfit', name: 'Outfit', stack: "'Outfit', system-ui, sans-serif", googleFamily: 'Outfit:wght@400;500;600;700' },
  { id: 'manrope', name: 'Manrope', stack: "'Manrope', system-ui, sans-serif", googleFamily: 'Manrope:wght@400;500;600;700' },
  { id: 'bebas-neue', name: 'Bebas Neue', stack: "'Bebas Neue', system-ui, sans-serif", googleFamily: 'Bebas+Neue' },
  { id: 'dancing-script', name: 'Dancing Script', stack: "'Dancing Script', cursive", googleFamily: 'Dancing+Script:wght@400;600;700' },
  { id: 'pacifico', name: 'Pacifico', stack: "'Pacifico', cursive", googleFamily: 'Pacifico' },
]

export function revealFontStack(id: string | undefined): string | undefined {
  if (!id || id === 'default') return undefined
  return REVEAL_FONTS.find(f => f.id === id)?.stack
}

export function loadRevealFont(id: string | undefined) {
  if (!id || id === 'default') return
  const font = REVEAL_FONTS.find(f => f.id === id)
  if (!font?.googleFamily) return
  const url = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`
  if (document.querySelector(`link[href="${url}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}
