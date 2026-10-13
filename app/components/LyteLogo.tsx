import { LYTE_LEAF_OUTLINE } from './lyteLeafPath'

// LyteApp's own logo (2026 rebrand). `tone` is the logo's color: navy for
// light backgrounds, white for dark ones; 'accent' paints it with the
// current --lyte-blue, so it follows the user's dashboard theme. `kind` picks the full "lyte app" +
// leaf wordmark or just the leaf icon.
export default function LyteLogo({ height = 24, tone = 'navy', kind = 'wordmark', className, traceLeaf = false }: {
  height?: number
  // Every 10s a line traces around the leaf isotype's silhouette (wordmark
  // + 'accent' tone only — used on the dashboard's logo).
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
    return (
      <span className={className} style={{ position: 'relative', display: 'block', height, width: w }}>
        {logo}
        <svg className="lyte-leaf-trace" viewBox="0 0 534 254" width={w} height={height} aria-hidden="true">
          <path d={LYTE_LEAF_OUTLINE} pathLength={1} />
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
