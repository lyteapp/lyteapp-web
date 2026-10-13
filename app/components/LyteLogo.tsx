// LyteApp's own logo (2026 rebrand). `tone` is the logo's color: navy for
// light backgrounds, white for dark ones; 'accent' paints it with the
// current --lyte-blue, so it follows the user's dashboard theme. `kind` picks the full "lyte app" +
// leaf wordmark or just the leaf icon.
export default function LyteLogo({ height = 24, tone = 'navy', kind = 'wordmark', className }: {
  height?: number
  tone?: 'navy' | 'white' | 'blue' | 'accent'
  kind?: 'wordmark' | 'icon'
  className?: string
}) {
  const ratio = kind === 'wordmark' ? 534 / 254 : 293 / 261
  if (tone === 'accent') {
    const mask = `url(/brand/lyte-${kind}-white.png) center / contain no-repeat`
    return (
      <span
        role="img"
        aria-label="Lyte app"
        className={className}
        style={{ display: 'block', height, width: Math.round(height * ratio), background: 'var(--lyte-blue)', WebkitMask: mask, mask }}
      />
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
