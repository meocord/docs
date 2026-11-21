import { Svg, SvgPath } from '@meonode/ui'
import { MARK_PATHS, MARK_VIEWBOX } from '@/lib/brand/mark-paths'

/** The mark as plain SVG, coloured by the surrounding CSS, so it adds no styled node. */
export function markSvgNode(size: number) {
  return Svg({
    viewBox: MARK_VIEWBOX.join(' '),
    'aria-hidden': true,
    // Under `props`, so they stay attributes: meonode reads a top-level width or height as CSS, and styles it.
    // After viewBox: a computed `props` ahead of it would stop @meonode/compiler from compiling this call
    props: { width: size, height: size },
    children: [
      SvgPath({ key: 'crown', d: MARK_PATHS.crown, fill: 'var(--mc-ink-primary)' }),
      SvgPath({ key: 'cord', d: MARK_PATHS.cord, fill: 'var(--mc-accent)' }),
    ],
  })
}
