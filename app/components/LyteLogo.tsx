// LyteApp's own logo (2026 rebrand). `tone` is the logo's color: navy for
// light backgrounds, white for dark ones. `kind` picks the full "lyte" +
// leaf wordmark or just the leaf icon.
export default function LyteLogo({ height = 24, tone = 'navy', kind = 'wordmark', className }: {
  height?: number
  tone?: 'navy' | 'white' | 'blue'
  kind?: 'wordmark' | 'icon'
  className?: string
}) {
  const ratio = kind === 'wordmark' ? 515 / 198 : 293 / 261
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/lyte-${kind}-${tone}.png`}
      alt="Lyte"
      width={Math.round(height * ratio)}
      height={height}
      className={className}
      style={{ display: 'block', height, width: 'auto' }}
    />
  )
}
