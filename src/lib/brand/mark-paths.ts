/**
 * The mark: a cat's two ears peeking over the cord, mid-glance. The near ear stands upright, the far
 * one is smaller and tipped outward, and both rise from behind the cord. Drawn on a 16-unit grid, so
 * 16, 32, 48, 64, 192 and 512 land on whole pixels.
 *
 * It has two optical sizes. From 48px up the inner ears are cut out, which is what makes the shapes
 * read as ears; below that the cut-outs would blur, so the crown's silhouette is drawn plain.
 *
 * Data only, so pages can draw it as inline SVG without loading meo-canvas; the meo-canvas node that
 * the icons and OG cards draw is in mark.ts. It is all read from mark.json, a verbatim copy of the
 * meocord repository's tools/brand/mark.json that `bun run brand:check` holds to meocord main; update it
 * with `bun run brand:sync`, never by hand.
 */

import mark from './mark.json'

export const MARK_VIEWBOX = mark.viewBox as [number, number, number, number]

/** The smallest size, in device pixels, that draws the inner ears. */
export const NOTCH_MIN_SIZE = mark.notchMinSize

/** The crown (both ears, joined by the head between them), the inner ears cut out of it, and the cord. */
export const MARK_PATHS = { crown: mark.paths.crown, inner: mark.paths.inner, cord: mark.paths.cord }

/**
 * The crown split at the valley between the ears, where they turn when they flick: each ear with its
 * share of the head, the two overlapping only in the solid crown below the valley.
 */
export const MARK_EARS = mark.paths.ears

/** The ears' path for a size in device pixels: notched from NOTCH_MIN_SIZE up, the plain crown below. */
export function earsPath(size: number): string {
  return size >= NOTCH_MIN_SIZE ? MARK_PATHS.crown + MARK_PATHS.inner : MARK_PATHS.crown
}

/** Tile corner radius, in grid units. */
export const MARK_TILE_RADIUS = mark.tileRadius

export interface MarkColours {
  tile: string
  ink: string
  accent: string
}

/** The graphite tile the favicon and app icons use: it holds on light and dark tab strips alike. */
export const MARK_DARK: MarkColours = mark.colours.dark

/**
 * The mark as SVG, following the reader's colour scheme, for the favicon: browsers draw it at tab
 * size, so it is the plain crown. The tile is left out so the tab's own colour shows around it.
 */
export function markSvg(): string {
  const { light, dark } = mark.colours.scheme
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX.join(' ')}">`,
    `<style>.e{fill:${light.ink};fill-opacity:${light.inkOpacity}}.c{fill:${light.accent}}`,
    `@media (prefers-color-scheme:dark){.e{fill:${dark.ink};fill-opacity:${dark.inkOpacity}}.c{fill:${dark.accent}}}</style>`,
    `<path class="e" d="${MARK_PATHS.crown}"/>`,
    `<path class="c" d="${MARK_PATHS.cord}"/>`,
    '</svg>',
  ].join('')
}
