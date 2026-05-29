import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ storeId: string }> }
): Promise<Metadata> {
  const { storeId } = await params
  return {
    title: 'Caja',
    manifest: `/api/cajero-manifest/${storeId}`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Caja',
    },
    icons: {
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  }
}

export default function CajeroLayout({ children }: { children: React.ReactNode }) {
  return children
}
