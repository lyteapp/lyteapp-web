import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ storeId: string }> }
): Promise<Metadata> {
  const { storeId } = await params
  return {
    title: 'Casilleros',
    manifest: `/api/casillero-manifest/${storeId}`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Casilleros',
    },
    icons: {
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  }
}

export default function CasilleroLayout({ children }: { children: React.ReactNode }) {
  return children
}
