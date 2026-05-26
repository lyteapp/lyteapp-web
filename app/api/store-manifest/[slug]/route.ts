import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: store } = await supabase
    .from('stores')
    .select('name, logo_url, brand_color')
    .eq('slug', slug)
    .maybeSingle()

  if (!store) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const themeColor = store.brand_color ?? '#7C3AED'

  // Always proxy the icon through our own server so Chrome accepts it as a PWA icon.
  // External URLs (Supabase storage) are blocked by Chrome when building the home screen shortcut.
  const iconSrc = `/api/store-icon/${slug}`

  const icons = [
    { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]

  const manifest = {
    name: store.name,
    short_name: store.name.slice(0, 15),
    description: `Ordena en ${store.name}`,
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: 'standalone',
    background_color: '#FAFAF7',
    theme_color: themeColor,
    orientation: 'portrait-primary',
    icons,
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
