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
  search: ['M7 2.75a4.25 4.25 0 1 1 0 8.5 4.25 4.25 0 0 1 0-8.5z', 'M10.25 10.25l3 3'],
  updown: ['M5.25 6.25 8 3.5l2.75 2.75', 'M5.25 9.75 8 12.5l2.75-2.75'],
  chevronRight: ['M6.5 4.5 10 8l-3.5 3.5'],
  // Section glyphs for the sidebar.
  start: ['M4.25 2.75v10.5', 'M4.25 3.25h7.5l-1.75 2.5 1.75 2.5h-7.5'],
  core: ['M8 2.25l5.25 3v5.5L8 13.75l-5.25-3v-5.5z', 'M2.75 5.25 8 8.25l5.25-3M8 8.25v5.5'],
  pipeline: ['M2.75 8h3M10.25 8h3', 'M6.25 5.75h3.5v4.5h-3.5z'],
  reply: ['M2.75 3.75h10.5v6.5H7.5l-3 2.5v-2.5H2.75z'],
  layers: ['M8 2.75 13.25 5.5 8 8.25 2.75 5.5z', 'M2.75 8.25 8 11l5.25-2.75', 'M2.75 10.75 8 13.5l5.25-2.75'],
  ship: ['M2.75 5.25 8 2.75l5.25 2.5v5.5L8 13.25l-5.25-2.5z', 'M2.75 5.25 8 7.75l5.25-2.5M8 7.75v5.5'],
  book: [
    'M3.25 3.25h4a1.25 1.25 0 0 1 1.25 1.25v8.25a1 1 0 0 0-1-1h-4.25z',
    'M12.75 3.25h-4a1.25 1.25 0 0 0-1.25 1.25',
  ],
  reference: ['M4.25 2.75h7.5v10.5h-7.5z', 'M6.25 5.5h3.5M6.25 8h3.5M6.25 10.5h2'],
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
