import { Node, Span, Svg, SvgPath } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'
import { earFlickCss } from '@/lib/brand/ear-flick'
import { MARK_EARS, MARK_PATHS, MARK_VIEWBOX, NOTCH_MIN_SIZE } from '@/lib/brand/mark-paths'
import { Link } from '@/components/shell/links'

/**
 * The mark, drawn in the current palette's ink and accent, at the optical size for the device
 * pixels it covers: below NOTCH_MIN_SIZE the plain crown, swapped for the notched ears on a screen
 * dense enough to draw them. Each ear is its own group, `data-ear`, so it can flick (earFlickCss).
 */
export function Mark(size = 20) {
  const shape = (side: 'near' | 'far', notched: boolean) => {
    const { crown, inner } = MARK_EARS[side]
    return notched ? crown + inner : crown
  }
  const ear = (side: 'near' | 'far') =>
    Node('g', {
      key: side,
      'data-ear': side,
      children:
        size >= NOTCH_MIN_SIZE
          ? SvgPath({ d: shape(side, true), fillRule: 'evenodd' })
          : [
              SvgPath({
                key: 'plain',
                d: shape(side, false),
                css: { [`@media (min-resolution: ${NOTCH_MIN_SIZE / size}dppx)`]: { display: 'none' } },
              }),
              SvgPath({
                key: 'notched',
                d: shape(side, true),
                fillRule: 'evenodd',
                css: {
                  display: 'none',
                  [`@media (min-resolution: ${NOTCH_MIN_SIZE / size}dppx)`]: { display: 'inline' },
                },
              }),
            ],
    })
  return Svg({
    width: size,
    height: size,
    viewBox: MARK_VIEWBOX.join(' '),
    'aria-hidden': true,
    focusable: false,
    flexShrink: 0,
    css: {
      '& [data-ears]': { fill: 'theme.ink.primary' },
      // Opaque ink under the group's opacity, so where the ears overlap reads as one shape.
      '@supports (color: rgb(from red r g b))': {
        '& [data-ears]': { fill: 'rgb(from var(--mc-ink-primary) r g b)', opacity: 0.88 },
      },
    },
    children: [
      Node('g', { key: 'ears', 'data-ears': true, children: [ear('near'), ear('far')] }),
      SvgPath({ key: 'cord', d: MARK_PATHS.cord, fill: 'theme.accent.default' }),
    ],
  })
}

/** The mark and the name, linking home. */
export function BrandLink() {
  return Link({
    href: '/',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'theme.space.2',
    padding: 'theme.space.1',
    borderRadius: 'theme.radius.control',
    color: 'theme.ink.primary',
    textDecoration: 'none',
    fontWeight: 'theme.font.weight.semibold',
    css: { ...focusCss, ...earFlickCss(['&:hover', '&:focus-visible']) },
    children: [Mark(), Span('MeoCord')],
  })
}
