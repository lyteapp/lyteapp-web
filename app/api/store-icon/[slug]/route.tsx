import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

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

  if (logoUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFFFF',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            width={512}
            height={512}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      ),
      { width: 512, height: 512 }
    )
  }

  // Fallback: initials on brand color
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
