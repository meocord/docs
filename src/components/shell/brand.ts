import { Span, Svg, SvgPath } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'
import { MARK_PATHS, MARK_VIEWBOX } from '@/lib/brand/mark'
import { Link } from '@/components/shell/links'

/** The mark, drawn in the current palette's ink and accent. */
export function Mark(size = 20) {
  return Svg({
    width: size,
    height: size,
    viewBox: MARK_VIEWBOX.join(' '),
    'aria-hidden': true,
    focusable: false,
    flexShrink: 0,
    children: [
      SvgPath({ key: 'head', d: MARK_PATHS.head, fillRule: 'evenodd', fill: 'theme.ink.primary' }),
      SvgPath({ key: 'core', d: MARK_PATHS.core, fill: 'theme.accent.default' }),
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
    css: { ...focusCss },
    children: [Mark(), Span('MeoCord')],
  })
}
