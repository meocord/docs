import { Svg, SvgPath } from '@meonode/ui'
import { MARK_PATHS, MARK_VIEWBOX } from '@/lib/brand/mark-paths'

/** The mark as plain SVG, coloured by the surrounding CSS, so it adds no styled node. */
export function markSvgNode(size: number) {
  return Svg({
    width: size,
    height: size,
    viewBox: MARK_VIEWBOX.join(' '),
    'aria-hidden': true,
    children: [
      SvgPath({ key: 'crown', d: MARK_PATHS.crown, fill: 'var(--mc-ink-primary)' }),
      SvgPath({ key: 'cord', d: MARK_PATHS.cord, fill: 'var(--mc-accent)' }),
    ],
  })
}
