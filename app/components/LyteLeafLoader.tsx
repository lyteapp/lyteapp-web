import { LYTE_LEAF_OUTLINE } from './lyteLeafPath'
import './LyteLeafLoader.css'

// LyteApp's loading indicator: the leaf isotype drawing itself in, over and
// over, in the theme accent color (see LyteLeafLoader.css).
// Same draw technique as the dashboard logo: a thick stroke along the
// leaf's outline, clipped to the leaf's own shape, so it fills as it goes.
export default function LyteLeafLoader({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={`lyte-leaf-loader${className ? ` ${className}` : ''}`}
      viewBox="292 0 248 224"
      width={Math.round(size * 248 / 224)}
      height={size}
      role="img"
      aria-label="Cargando"
    >
      <defs><clipPath id="lyte-leaf-loader-clip"><path d={LYTE_LEAF_OUTLINE} /></clipPath></defs>
      <path d={LYTE_LEAF_OUTLINE} className="lyte-leaf-loader-ghost" />
      <path d={LYTE_LEAF_OUTLINE} pathLength={1} clipPath="url(#lyte-leaf-loader-clip)" className="lyte-leaf-loader-ink" />
    </svg>
  )
}
