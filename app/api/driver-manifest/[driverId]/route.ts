import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  const { driverId } = await params

  const { data: driver } = await supa
    .from('delivery_drivers')
    .select('name, stores(name)')
    .eq('id', driverId)
    .maybeSingle()

  const driverName = driver?.name ?? 'Despachador'
  const storeName  = (driver?.stores as { name: string } | null)?.name ?? ''

  const manifest = {
    name:             `${driverName} · Despachos`,
    short_name:       driverName,
    description:      storeName ? `Dashboard de despacho · ${storeName}` : 'Dashboard de despacho',
    start_url:        `/driver/${driverId}`,
    scope:            `/driver/${driverId}`,
    display:          'standalone',
    orientation:      'portrait-primary',
    background_color: '#F1F5F9',
    theme_color:      '#7C3AED',
    categories:       ['productivity', 'business'],
    icons: [
      {
        src:     '/api/driver-icon?size=192',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/api/driver-icon?size=512',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
