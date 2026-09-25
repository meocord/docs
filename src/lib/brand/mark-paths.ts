/**
 * The mark: a cat's two ears peeking over the cord, mid-glance. The near ear stands upright, the far
 * one is smaller and tipped outward, and both rise from behind the cord. Drawn on a 16-unit grid, so
 * 16, 32, 48, 64, 192 and 512 land on whole pixels.
 *
 * It has two optical sizes. From 48px up the inner ears are cut out, which is what makes the shapes
 * read as ears; below that the cut-outs would blur, so the crown's silhouette is drawn plain.
 *
 * Data only, so pages can draw it as inline SVG without loading meo-canvas; the meo-canvas node that
 * the icons and OG cards draw is in mark.ts.
 */
export const MARK_VIEWBOX = [0, 0, 16, 16] as const

/** The smallest size, in device pixels, that draws the inner ears. */
export const NOTCH_MIN_SIZE = 48

export const MARK_PATHS = {
  /** Both ears, joined by the curve of the head's crown between them. */
  crown:
    'M2.4 12Q1.9 7.2 3.4 4.1Q4.1 2.8 5 3.8Q6.4 5.6 7.3 8Q8.4 7.6 9.6 8.4Q11 6.9 12.9 6.1Q13.9 5.3 14.1 6.4Q14.3 9.3 13.4 12Z',
  /** The inner ears, cut out of the crown (even-odd) at the larger size. */
  inner: 'M3.7 9.6Q3.6 7 4.3 5.6Q5.6 7.4 6.2 9.6ZM10.8 9.8Q11.8 8.3 12.9 7.6Q13.1 8.8 12.8 9.8Z',
  /** The cord they peek over, drawn in front of them. */
  cord: 'M2.25 10.5H13.75Q15 10.5 15 11.75Q15 13 13.75 13H2.25Q1 13 1 11.75Q1 10.5 2.25 10.5Z',
} as const

/** The ears' path for a size in device pixels: notched from NOTCH_MIN_SIZE up, the plain crown below. */
export function earsPath(size: number): string {
  return size >= NOTCH_MIN_SIZE ? MARK_PATHS.crown + MARK_PATHS.inner : MARK_PATHS.crown
}

/** Tile corner radius, in grid units. */
export const MARK_TILE_RADIUS = 3.5

export interface MarkColours {
  tile: string
  ink: string
  accent: string
}

/** The graphite tile the favicon and app icons use: it holds on light and dark tab strips alike. */
export const MARK_DARK: MarkColours = { tile: '#1E1E21', ink: 'rgba(255,255,255,0.88)', accent: '#8C98FF' }

/**
 * The mark as SVG, following the reader's colour scheme, for the favicon: browsers draw it at tab
 * size, so it is the plain crown. The tile is left out so the tab's own colour shows around it.
 */
export function markSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX.join(' ')}">`,
    '<style>.e{fill:#161618;fill-opacity:.88}.c{fill:#4B5BD7}',
    '@media (prefers-color-scheme:dark){.e{fill:#fff}.c{fill:#8C98FF}}</style>',
    `<path class="e" d="${MARK_PATHS.crown}"/>`,
    `<path class="c" d="${MARK_PATHS.cord}"/>`,
    '</svg>',
  ].join('')
}
