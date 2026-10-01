export async function GET(
  _req: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params
  const manifest = {
    name: 'Casilleros',
    short_name: 'Casilleros',
    description: 'Display de casilleros para retiro de pedidos',
    start_url: `/casillero/${storeId}`,
    scope: `/casillero/${storeId}`,
    display: 'standalone',
    background_color: '#F1F5F9',
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
