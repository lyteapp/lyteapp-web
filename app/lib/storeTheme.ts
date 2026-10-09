// Color for the store's loading screens (initial load and the checkout
// hand-off): the store's own accent, then its price color, then the brand
// color picked at signup — never LyteApp's purple — with a neutral dark as
// the last resort.
export function storeLoaderColor(store: { brand_color?: string | null; template_config?: { accentColor?: string; priceColor?: string } | null }): string {
  const cfg = store.template_config ?? {}
  return cfg.accentColor || cfg.priceColor || store.brand_color || '#0F172A'
}
