export async function GET(
  _req: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params
  const manifest = {
    name: 'Caja',
    short_name: 'Caja',
    description: 'App de caja para cajeros',
    start_url: `/cajero/${storeId}`,
    scope: `/cajero/${storeId}`,
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#7C3AED',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
