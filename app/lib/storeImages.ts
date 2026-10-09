// Shared by the storefront's server page and client shell.

// Product "images" can also be short looping videos, uploaded like any
// other image and told apart purely by file extension (no separate DB field).
const PRODUCT_VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
export function isVideoUrl(url?: string | null): boolean {
  return !!url && PRODUCT_VIDEO_EXT_RE.test(url)
}
// Routes Supabase Storage images through its on-the-fly image transform
// endpoint instead of serving the original upload — product photos come in
// straight off customers' phones (often several MB each), which is both slow
// to download and, served with the storage bucket's default "no-cache"
// header, gets re-fetched over the network every time an image scrolls back
// into view instead of coming from the browser's disk cache. Requesting a
// resized render both shrinks the payload and gets a real max-age back.
// No-ops for anything that isn't a Supabase Storage URL (blob:, data:, local
// /path.png, videos), so it's safe to wrap any image src unconditionally.
const SUPABASE_PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/'
export function resizedImg(url: string | null | undefined, width: number): string {
  if (!url) return url ?? ''
  const i = url.indexOf(SUPABASE_PUBLIC_OBJECT_MARKER)
  // GIFs (would lose their animation) and SVGs (vector) are served as-is.
  if (i === -1 || isVideoUrl(url) || /\.(gif|svg)(\?|#|$)/i.test(url)) return url
  const rendered = `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + SUPABASE_PUBLIC_OBJECT_MARKER.length)}`
  const sep = rendered.includes('?') ? '&' : '?'
  // "resize=contain" is required here — without it, Supabase's default
  // resizing mode mishandles EXIF-rotated phone photos (portrait shots
  // saved with a rotated raw buffer) and returns a badly distorted aspect
  // ratio instead of a scaled-down version of the original.
  return `${rendered}${sep}width=${width}&quality=70&resize=contain`
}
