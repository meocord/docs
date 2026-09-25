import { Box, Path } from 'meo-canvas'

/**
 * The mark: a cat's head whose face is a window, with the accent core inside. Drawn on a 16-unit grid
 * with whole-unit edges, so 16, 32, 48, 64, 192 and 512 land on whole pixels and the 16px favicon
 * keeps its ears, window and core apart.
 */
export const MARK_VIEWBOX = [0, 0, 16, 16] as const

/** The head with its window cut out (even-odd), and the core that sits in the window. */
export const MARK_PATHS = {
  head: 'M2 11V1L6 5H10L14 1V11Q14 14 11 14H5Q2 14 2 11ZM5 7H11Q12 7 12 8V11Q12 12 11 12H5Q4 12 4 11V8Q4 7 5 7Z',
  core: 'M7 8H9Q10 8 10 9V10Q10 11 9 11H7Q6 11 6 10V9Q6 8 7 8Z',
} as const

/** Tile corner radius, in grid units. */
export const MARK_TILE_RADIUS = 3.5

export interface MarkColours {
  tile: string
  ink: string
  accent: string
}

/** The dark tile every raster icon uses: it holds on light and dark tab strips alike. */
export const MARK_DARK: MarkColours = { tile: '#1E1E21', ink: 'rgba(255,255,255,0.88)', accent: '#8C98FF' }

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

/**
 * The mark as SVG, following the reader's colour scheme: ink and accent swap to the light palette,
 * and the tile is left out so the browser's own tab colour shows around the head.
 */
export function markSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX.join(' ')}">`,
    '<style>.h{fill:#161618;fill-opacity:.88}.c{fill:#4B5BD7}',
    '@media (prefers-color-scheme:dark){.h{fill:#fff}.c{fill:#8C98FF}}</style>',
    `<path class="h" fill-rule="evenodd" d="${MARK_PATHS.head}"/>`,
    `<path class="c" d="${MARK_PATHS.core}"/>`,
    '</svg>',
  ].join('')
}
