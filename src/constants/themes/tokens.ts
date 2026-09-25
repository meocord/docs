/**
 * The design tokens `ThemeProvider` receives. Colours are `var(--mc-…)` references into the palettes in
 * globals.css, so the provider's stylesheet is the same bytes in either mode; scales that do not change
 * with the mode (type, space, radii, motion) are plain values. Call sites write `'theme.ink.primary'`.
 */

const v = <K extends string>(name: K) => `var(--mc-${name})` as const

export const themeTokens = {
  surface: {
    canvas: v('canvas'),
    sheet: v('sheet'),
    fill: v('fill'),
    fillHover: v('fill-hover'),
    scrim: v('scrim'),
  },
  /** Two text tiers. `quiet` is under 4.5:1 and is for glyphs, rules and disabled controls only. */
  ink: { primary: v('ink-primary'), secondary: v('ink-secondary'), quiet: v('ink-quiet') },
  line: { hairline: v('hairline'), strong: v('hairline-strong'), width: '0.5px' },
  accent: {
    default: v('accent'),
    hover: v('accent-hover'),
    content: v('accent-content'),
    tint: v('accent-tint'),
    band: v('accent-band'),
    halo: v('accent-halo'),
  },
  callout: {
    note: { glyph: v('accent'), fill: v('accent-band') },
    tip: { glyph: v('tip'), fill: v('tip-tint') },
    warning: { glyph: v('warning'), fill: v('warning-tint') },
    danger: { glyph: v('danger'), fill: v('danger-tint') },
  },
  material: {
    sidebar: { fill: v('material-sidebar'), solid: v('material-sidebar-solid'), blur: 'blur(40px) saturate(170%)' },
    chrome: { fill: v('material-chrome'), solid: v('material-chrome-solid'), blur: 'blur(24px) saturate(180%)' },
    popover: { fill: v('material-popover'), solid: v('material-popover-solid'), blur: 'blur(30px) saturate(180%)' },
  },
  elevation: { 1: v('shadow-1'), 2: v('shadow-2'), 3: v('shadow-3') },

  font: {
    sans: 'var(--font-sans), system-ui, sans-serif',
    mono: 'var(--font-mono), ui-monospace, monospace',
    weight: { regular: 400, medium: 500, semibold: 600 },
  },

  /** In rem, so the reader's font size scales the docs. Tracking stands in for optical sizes. */
  type: {
    caption: { size: '0.6875rem', line: 1.45, track: '0.01em' },
    control: { size: '0.8125rem', line: 1.4, track: '0.005em' },
    small: { size: '0.875rem', line: 1.55, track: '0em' },
    body: { size: '1.03125rem', line: 1.65, track: '-0.003em' },
    code: { size: '0.875rem', line: 1.6, track: '0em' },
    h4: { size: '1.25rem', line: 1.35, track: '-0.01em' },
    h3: { size: '1.5rem', line: 1.3, track: '-0.014em' },
    h2: { size: '1.875rem', line: 1.2, track: '-0.019em' },
    h1: { size: '2.25rem', line: 1.12, track: '-0.022em' },
  },

  /** A 4px base; the key is the step, so `theme.space.4` is 16px. */
  space: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  /**
   * By role, proportional to size, and nested: an inner radius is the outer one less the padding
   * between them. Nothing is pill-shaped and nothing is sharp.
   */
  radius: { chip: '4px', control: '6px', row: '8px', code: '10px', callout: '10px', popover: '12px', pane: '12px' },

  layout: {
    sidebar: '260px',
    inspector: '224px',
    prose: '72ch',
    gutter: '8px',
    toolbar: '52px',
    row: '32px',
    sheetPad: '40px',
    sheetPadCompact: '24px',
  },

  /** Media-query keys resolve `theme.` to these values, so they can be used there. */
  breakpoint: { compact: '768px', medium: '1024px', wide: '1280px' },

  motion: {
    duration: { state: '120ms', open: '220ms', move: '360ms' },
    ease: { enter: 'cubic-bezier(.32,.72,0,1)', exit: 'cubic-bezier(.4,0,1,1)' },
  },

  focus: { width: '2px', offset: '2px' },

  z: { sticky: 10, chrome: 20, popover: 40, sheet: 50, palette: 60 },
} as const

declare module '@meonode/ui' {
  interface MeoTheme {
    mode: 'light' | 'dark'
    system: typeof themeTokens
  }
}
