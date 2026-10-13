import { LYTE_LEAF_OUTLINE } from './lyteLeafPath'

// LyteApp's own logo (2026 rebrand). `tone` is the logo's color: navy for
// light backgrounds, white for dark ones; 'accent' paints it with the
// current --lyte-blue, so it follows the user's dashboard theme. `kind` picks the full "lyte app" +
// leaf wordmark or just the leaf icon.
export default function LyteLogo({ height = 24, tone = 'navy', kind = 'wordmark', className, traceLeaf = false }: {
  height?: number
  // Every 10s the leaf isotype disappears and draws itself back in, in the
  // logo's color (wordmark + 'accent' tone only — the dashboard's logo).
  traceLeaf?: boolean
  tone?: 'navy' | 'white' | 'blue' | 'accent'
  kind?: 'wordmark' | 'icon'
  className?: string
}) {
  const ratio = kind === 'wordmark' ? 534 / 254 : 293 / 261
  if (tone === 'accent') {
    const mask = `url(/brand/lyte-${kind}-white.png) center / contain no-repeat`
    const w = Math.round(height * ratio)
    const logo = (
      <span
        role="img"
        aria-label="Lyte app"
        className={traceLeaf ? undefined : className}
        style={{ display: 'block', height, width: w, background: 'var(--lyte-blue)', WebkitMask: mask, mask }}
      />
    )
    if (!traceLeaf || kind !== 'wordmark') return logo
    // The leaf is drawn separately so it can disappear and re-draw itself:
    // the base logo is clipped to just "lyte app" (the leaf starts at x≈300
    // of the 534px-wide artwork), and the leaf is a very thick stroke run
    // along its own outline and clipped to its own shape, so as the stroke
    // advances it fills the leaf in, in the logo's color.
    return (
      <span className={className} style={{ position: 'relative', display: 'block', height, width: w }}>
        <span style={{ display: 'block', clipPath: `inset(0 ${(100 * (534 - 292) / 534).toFixed(2)}% 0 0)` }}>{logo}</span>
        <svg className="lyte-leaf-draw" viewBox="0 0 534 254" width={w} height={height} aria-hidden="true">
          <defs><clipPath id="lyte-leaf-clip"><path d={LYTE_LEAF_OUTLINE} /></clipPath></defs>
          <path d={LYTE_LEAF_OUTLINE} pathLength={1} clipPath="url(#lyte-leaf-clip)" />
        </svg>
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/lyte-${kind}-${tone}.png`}
      alt="Lyte app"
      width={Math.round(height * ratio)}
      height={height}
      className={className}
      style={{ display: 'block', height, width: 'auto' }}
    />
  )
}
