/**
 * Every colour as a `var()` reference; the values live in globals.css under `:root` (dark) and
 * `:root[data-theme='light']`. The provider's stylesheet is then the same bytes in either mode.
 */
export const themeTokens = {
  surface: {
    default: 'var(--surface-default)',
    content: 'var(--surface-content)',
    muted: 'var(--surface-muted)',
    line: 'var(--surface-line)',
  },
  primary: {
    default: 'var(--primary-default)',
    content: 'var(--primary-content)',
  },
  font: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
}
