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

  const icons = store.logo_url
    ? [
        { src: store.logo_url, sizes: 'any', type: 'image/png', purpose: 'any' },
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
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
