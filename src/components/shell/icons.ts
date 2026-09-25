import { For, Svg, SvgPath } from '@meonode/ui'

/** Glyphs on a 16px grid with a 1.5px stroke. Decorative: their controls carry the label. */
const GLYPHS = {
  sidebar: ['M2.75 3.75h10.5v8.5H2.75z', 'M6.25 3.75v8.5'],
  chevronDown: ['M4.5 6.5 8 10l3.5-3.5'],
  check: ['M3.75 8.5 6.5 11.25l5.75-6.5'],
  close: ['M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5'],
  sun: [
    'M8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z',
    'M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05',
  ],
  moon: ['M12.75 9.9A5 5 0 0 1 6.1 3.25a5 5 0 1 0 6.65 6.65z'],
  monitor: ['M2.25 3.25h11.5v7.5H2.25z', 'M6 13.25h4M8 10.75v2.5'],
} as const

export type GlyphName = keyof typeof GLYPHS

export function Glyph(name: GlyphName, size = 16) {
  return Svg({
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    flexShrink: 0,
    children: For(GLYPHS[name], d => SvgPath({ d })),
  })
}
