import { Span, Svg, SvgPath, type ThemedCSSObject } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'
import { earsPath, MARK_PATHS, MARK_VIEWBOX, NOTCH_MIN_SIZE } from '@/lib/brand/mark-paths'
import { Link } from '@/components/shell/links'

/**
 * The mark, drawn in the current palette's ink and accent, at the optical size for the device
 * pixels it covers: below NOTCH_MIN_SIZE the plain crown, swapped for the notched ears on a screen
 * dense enough to draw them.
 */
export function Mark(size = 20) {
  const ears = (d: string, key: string, css?: ThemedCSSObject) =>
    SvgPath({ key, d, fillRule: 'evenodd', fill: 'theme.ink.primary', css })
  const density = NOTCH_MIN_SIZE / size
  const layers =
    size >= NOTCH_MIN_SIZE
      ? [ears(earsPath(size), 'ears')]
      : [
          ears(MARK_PATHS.crown, 'crown', { [`@media (min-resolution: ${density}dppx)`]: { display: 'none' } }),
          ears(earsPath(NOTCH_MIN_SIZE), 'notched', {
            display: 'none',
            [`@media (min-resolution: ${density}dppx)`]: { display: 'inline' },
          }),
        ]
  return Svg({
    width: size,
    height: size,
    viewBox: MARK_VIEWBOX.join(' '),
    'aria-hidden': true,
    focusable: false,
    flexShrink: 0,
    children: [...layers, SvgPath({ key: 'cord', d: MARK_PATHS.cord, fill: 'theme.accent.default' })],
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
    css: { ...focusCss },
    children: [Mark(), Span('MeoCord')],
  })
}
