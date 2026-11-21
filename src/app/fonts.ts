import localFont from 'next/font/local'

// Latin subsets of the variable faces, served from the site's own origin. Instrument Sans is its weight
// axis alone: with the width axis too the file is twice the size, and it paints the first text.
// Optional: with the styles inline, first paint can come before the font, and a swap then moves the text.
// A page that paints first keeps the Arial-sized fallback until the next full load, which has it cached.
export const sans = localFont({
  src: '../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'optional',
  variable: '--font-sans',
  adjustFontFallback: 'Arial',
})

// Optional, and not preloaded: code sits below the first heading. Its stand-ins while it loads are the
// system monospace faces matched to its metrics in globals.css, not Next's Arial-based fallback.
export const mono = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  style: 'normal',
  display: 'optional',
  variable: '--font-mono',
  preload: false,
  adjustFontFallback: false,
})
