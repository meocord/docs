import { createNode } from '@meonode/ui'

const heading = (level: 'h1' | 'h2' | 'h3' | 'h4') => ({
  fontSize: `theme.type.${level}.size`,
  lineHeight: `theme.type.${level}.line`,
  letterSpacing: `theme.type.${level}.track`,
  fontWeight: 'theme.font.weight.semibold',
  color: 'theme.ink.primary',
  scrollMarginTop: 'calc(theme.layout.toolbar + theme.space.4)',
})

/**
 * The reading column: one styled container around a page's lowered Markdown. Its children are plain
 * elements with no style props of their own, styled here by selector, so a long page costs one styled
 * node rather than one per paragraph.
 */
export const Prose = createNode('article', {
  maxWidth: 'theme.layout.prose',
  padding: 'theme.layout.sheetPad',
  fontSize: 'theme.type.body.size',
  lineHeight: 'theme.type.body.line',
  letterSpacing: 'theme.type.body.track',
  color: 'theme.ink.primary',
  css: {
    '@media (width < theme.breakpoint.compact)': { padding: 'theme.layout.sheetPadCompact' },

    '& > :first-child': { marginTop: 0 },
    '& h1': { ...heading('h1'), margin: '0 0 theme.space.6' },
    '& h2': { ...heading('h2'), margin: 'theme.space.12 0 theme.space.4' },
    '& h3': { ...heading('h3'), margin: 'theme.space.10 0 theme.space.3' },
    '& h4': { ...heading('h4'), margin: 'theme.space.8 0 theme.space.2' },
    '& p': { margin: '0 0 theme.space.4' },
    '& strong': { fontWeight: 'theme.font.weight.semibold' },

    '& a': {
      color: 'theme.accent.default',
      textDecoration: 'underline',
      textDecorationThickness: '1px',
      textUnderlineOffset: '0.18em',
      textDecorationColor: 'theme.accent.tint',
      borderRadius: 2,
    },
    '& a:hover': { textDecorationColor: 'currentColor' },
    '& a:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },

    '& ul, & ol': { margin: '0 0 theme.space.4', paddingLeft: 'theme.space.6' },
    '& li': { margin: 'theme.space.1 0' },
    '& li > ul, & li > ol': { margin: 'theme.space.1 0 0' },
    '& li::marker': { color: 'theme.ink.secondary' },

    '& code': {
      fontFamily: 'theme.font.mono',
      fontSize: '0.875em',
      padding: '0.1em 0.3em',
      borderRadius: 4,
      backgroundColor: 'theme.surface.fill',
    },
    '& pre': {
      margin: '0 0 theme.space.6',
      padding: 'theme.space.4',
      overflowX: 'auto',
      borderRadius: 'theme.radius.code',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
    },
    '& pre code': { padding: 0, fontSize: 'inherit', backgroundColor: 'transparent' },

    '& blockquote': {
      margin: '0 0 theme.space.4',
      padding: 'theme.space.3 theme.space.4',
      borderRadius: 'theme.radius.callout',
      backgroundColor: 'theme.callout.note.fill',
      color: 'theme.ink.primary',
    },
    '& blockquote > :last-child': { marginBottom: 0 },

    '& hr': { margin: 'theme.space.10 0', border: 'none', borderTop: 'theme.line.width solid theme.line.strong' },

    '& [data-table]': { margin: '0 0 theme.space.6', overflowX: 'auto' },
    '& table': { width: '100%', borderCollapse: 'collapse', fontSize: 'theme.type.small.size' },
    '& th, & td': {
      padding: 'theme.space.2 theme.space.3',
      textAlign: 'left',
      verticalAlign: 'top',
      borderBottom: 'theme.line.width solid theme.line.hairline',
    },
    '& th': { fontWeight: 'theme.font.weight.semibold', borderBottomColor: 'theme.line.strong' },
    '& [data-align="center"]': { textAlign: 'center' },
    '& [data-align="right"]': { textAlign: 'right' },

    '& img': { maxWidth: '100%', height: 'auto' },

    // API reference pages: the kind and entry line under the title, badges, linked signatures and
    // doc comments, whose last paragraph sits flush with what follows.
    '& [data-api-meta]': { margin: '-12px 0 theme.space.6', color: 'theme.ink.secondary' },
    '& [data-badge]': {
      display: 'inline-block',
      fontSize: 'theme.type.caption.size',
      lineHeight: 1.6,
      fontWeight: 'theme.font.weight.regular',
      letterSpacing: 0,
      padding: '0 theme.space.1',
      borderRadius: 'theme.radius.control',
      border: '1px solid theme.accent.tint',
      color: 'theme.accent.default',
      verticalAlign: 'middle',
    },
    '& [data-badge="deprecated"]': { borderColor: 'theme.callout.warning.glyph', color: 'theme.callout.warning.glyph' },
    '& [data-signature] a': { color: 'inherit', textDecorationColor: 'theme.accent.tint' },
    '& [data-doc] > :last-child': { marginBottom: 0 },
    '& td [data-doc] p': { margin: 0 },
    '& [data-since]': { whiteSpace: 'nowrap' },

    // The note on a page imported from a README, under its title.
    '& [data-source]': {
      margin: '-12px 0 theme.space.8',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },
  },
})
