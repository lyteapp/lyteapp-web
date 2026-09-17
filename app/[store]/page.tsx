import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import StoreShell from './StoreShell'
import './store.css'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const getStore = cache(async (slug: string) => {
  const { data } = await supabase.from('stores').select('*').eq('slug', slug).maybeSingle()
  return data
})

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const data = await getStore(slug)
  if (!data) return { title: 'Tienda no encontrada' }
  return {
    title: data.name,
    description: data.description ?? `Bienvenido a ${data.name}`,
    manifest: `/api/store-manifest/${slug}`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent' as const,
      title: data.name,
    },
    // This fork's appleWebApp.capable only emits the generic
    // mobile-web-app-capable tag, not apple-mobile-web-app-capable — iOS
    // still keys some of its standalone/full-screen safe-area behavior off
    // the Apple-specific one, so it's added explicitly here.
    other: {
      'apple-mobile-web-app-capable': 'yes',
    },
    ...((data.template_config?.pwaIconUrl || data.logo_url) && {
      icons: { apple: [{ url: data.template_config?.pwaIconUrl || data.logo_url, sizes: '180x180' }] },
    }),
  }
}

export default async function StorePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params

  const store = await getStore(slug)

  if (!store) notFound()

  const currency = (store.store_currency ?? 'USD') as string
  const [{ data: products }, { data: categories }, { data: rateRow }, { data: zones }] = await Promise.all([
    supabase.from('products').select('*')
      .eq('store_id', store.id).eq('is_active', true)
      .order('position', { ascending: true, nullsFirst: false }),
    supabase.from('categories').select('*')
      .eq('store_id', store.id).order('position', { ascending: true }),
    supabaseService.from('exchange_rates').select('rate').eq('currency', currency).maybeSingle(),
    supabaseService.from('delivery_zones').select('*').eq('store_id', store.id),
  ])

  const initialBcvRate       = rateRow?.rate ? Number(rateRow.rate) : null
  const initialDeliveryZones = zones ?? []
  const mapboxToken          = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  // A product can belong to more than one category via product_categories;
  // category_id stays as a fallback (and as the primary category for older
  // readers) so this degrades to the old single-category behavior if that
  // table's migration hasn't landed yet, instead of breaking the storefront.
  const productIds = (products ?? []).map(p => p.id)
  const categoryIdsByProduct: Record<string, string[]> = {}
  if (productIds.length > 0) {
    const { data: pcRows } = await supabase
      .from('product_categories')
      .select('product_id, category_id')
      .in('product_id', productIds)
    for (const row of pcRows ?? []) {
      (categoryIdsByProduct[row.product_id] ??= []).push(row.category_id)
    }
  }
  const productsWithCategories = (products ?? []).map(p => ({
    ...p,
    category_ids: categoryIdsByProduct[p.id] ?? (p.category_id ? [p.category_id] : []),
  }))

  return <StoreShell store={store} products={productsWithCategories} categories={categories ?? []} initialBcvRate={initialBcvRate} initialDeliveryZones={initialDeliveryZones} mapboxToken={mapboxToken} />
}
