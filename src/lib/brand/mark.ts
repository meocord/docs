import { Box, Path } from 'meo-canvas'
import { MARK_DARK, MARK_PATHS, MARK_TILE_RADIUS, MARK_VIEWBOX, type MarkColours } from '@/lib/brand/mark-paths'

/** The mark as a meo-canvas node, `size` pixels square; `radius` in grid units, 0 for a full bleed. */
export function markNode(size: number, colours: MarkColours = MARK_DARK, radius = MARK_TILE_RADIUS) {
  const layer = (d: string, fill: string, fillRule: 'nonzero' | 'evenodd') =>
    Path({
      positionType: 'absolute',
      position: { top: 0, left: 0 },
      width: size,
      height: size,
      viewBox: [...MARK_VIEWBOX],
      d,
      fill,
      fillRule,
    })
  return Box({
    width: size,
    height: size,
    positionType: 'relative',
    overflow: 'hidden',
    backgroundColor: colours.tile,
    borderRadius: (radius * size) / 16,
    children: [layer(MARK_PATHS.head, colours.ink, 'evenodd'), layer(MARK_PATHS.core, colours.accent, 'nonzero')],
  })
}
