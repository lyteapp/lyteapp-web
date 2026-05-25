import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import StoreShell from './StoreShell'
import './store.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const { data } = await supabase
    .from('stores')
    .select('name, description, logo_url, brand_color')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return { title: 'Tienda no encontrada' }
  return {
    title: data.name,
    description: data.description ?? `Bienvenido a ${data.name}`,
    manifest: `/api/store-manifest/${slug}`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default' as const,
      title: data.name,
    },
    ...(data.logo_url && {
      icons: { apple: [{ url: data.logo_url, sizes: '180x180' }] },
    }),
  }
}

export default async function StorePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params

  const { data: store } = await supabase
    .from('stores').select('*').eq('slug', slug).maybeSingle()

  if (!store) notFound()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*')
      .eq('store_id', store.id).eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('*')
      .eq('store_id', store.id).order('position', { ascending: true }),
  ])

  return <StoreShell store={store} products={products ?? []} categories={categories ?? []} />
}
