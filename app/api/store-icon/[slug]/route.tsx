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
    .select('name, logo_url, brand_color')
    .eq('slug', slug)
    .maybeSingle()

  const bg      = store?.brand_color ?? '#7C3AED'
  const logoUrl = store?.logo_url ?? null
  const name    = store?.name ?? slug

  // Proxy the logo directly from Supabase storage — same origin for Chrome
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl)
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
