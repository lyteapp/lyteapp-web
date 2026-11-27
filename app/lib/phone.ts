// A customer's phone as WhatsApp wants it (country code, digits only).
// Customers type theirs every way: 04141234567, 4141234567, +58 414 123 4567...
// Only the Venezuelan local formats get "58" added; anything else is left as
// it is, so a number from another country is never turned into a Venezuelan one.
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const international = raw.trim().startsWith('+') || raw.trim().startsWith('00')
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (!international) {
    if (d.length === 11 && /^0(4(12|14|16|24|26)|2\d\d)/.test(d)) d = '58' + d.slice(1)   // 0414 1234567
    else if (d.length === 10 && /^(4(12|14|16|24|26)|2\d\d)/.test(d)) d = '58' + d       // 414 1234567
  }
  return d.length >= 10 && d.length <= 15 ? d : null
}

export function whatsappLink(raw: string | null | undefined, text?: string): string | null {
  const n = whatsappNumber(raw)
  if (!n) return null
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
