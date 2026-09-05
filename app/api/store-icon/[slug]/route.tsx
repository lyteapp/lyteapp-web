import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

// Node.js runtime — required for Supabase client compatibility
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: store } = await supabase
    .from('stores')
    .select('name, logo_url, brand_color, template_config')
    .eq('slug', slug)
    .maybeSingle()

  const bg = store?.brand_color ?? '#7C3AED'
  const name = store?.name ?? slug
  // A dedicated home-screen icon (set in "Mi tienda") takes priority over
  // the regular store logo, since the logo is often a transparent-background
  // mark that reads poorly as a solid app icon.
  const templateConfig = (store?.template_config ?? null) as { pwaIconUrl?: string } | null
  const iconUrl = templateConfig?.pwaIconUrl || store?.logo_url || null

  // Proxy the image directly from Supabase storage — same origin for Chrome
  if (iconUrl) {
    try {
      const res = await fetch(iconUrl)
      if (res.ok) {
        const bytes = await res.arrayBuffer()
        const ct    = res.headers.get('content-type') ?? 'image/png'
        return new Response(bytes, {
          headers: {
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    } catch {
      // fall through to initials fallback
    }
  }

  // Fallback: render initials on brand color as a 512×512 PNG
  const initials = name.slice(0, 2).toUpperCase()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          fontSize: 200,
          fontWeight: 700,
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        {initials}
      </div>
    ),
    { width: 512, height: 512 }
  )
}
