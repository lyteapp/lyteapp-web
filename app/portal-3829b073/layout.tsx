import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LyteApp',
  manifest: '/portal-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LyteApp',
  },
  icons: {
    apple: [{ url: '/portal-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children
}
