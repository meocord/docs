import { Node } from '@meonode/ui'
import { MARK_PATHS, MARK_VIEWBOX } from '@/lib/brand/mark-paths'

/** The mark as plain SVG, coloured by the surrounding CSS, so it adds no styled node. */
export function markSvgNode(size: number) {
  return Node('svg', {
    width: size,
    height: size,
    viewBox: MARK_VIEWBOX.join(' '),
    'aria-hidden': true,
    children: [
      Node('path', { key: 'crown', d: MARK_PATHS.crown, fill: 'var(--mc-ink-primary)' }),
      Node('path', { key: 'cord', d: MARK_PATHS.cord, fill: 'var(--mc-accent)' }),
    ],
  })
}
