import { createNode } from '@meonode/ui'
import { hitAreaCss, safe } from '@/lib/design/css'

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
  maxWidth: 'calc(theme.layout.prose + 2 * theme.layout.sheetPad)',
  padding: 'theme.layout.sheetPad',
  fontSize: 'theme.type.body.size',
  lineHeight: 'theme.type.body.line',
  letterSpacing: 'theme.type.body.track',
  color: 'theme.ink.primary',
  css: {
    '@media (width < theme.breakpoint.compact)': {
      padding: 'theme.layout.sheetPadCompact',
      paddingLeft: safe('theme.layout.sheetPadCompact', 'left'),
      paddingRight: safe('theme.layout.sheetPadCompact', 'right'),
    },

    '& > :first-child': { marginTop: 0 },
    '& h1': { ...heading('h1'), margin: '0 0 theme.space.6' },
    '& h2': { ...heading('h2'), margin: 'theme.space.12 0 theme.space.4' },
    '& h3': { ...heading('h3'), margin: 'theme.space.10 0 theme.space.3' },
    // A heading that only groups what follows, such as a changelog's kinds of change: a label, as the
    // sidebar's and the contents' group titles are.
    '& h3[data-group]': {
      margin: 'theme.space.8 0 theme.space.2',
      fontSize: 'theme.type.caption.size',
      lineHeight: 'theme.type.caption.line',
      fontWeight: 'theme.font.weight.semibold',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'theme.ink.secondary',
    },
    '& h4': { ...heading('h4'), margin: 'theme.space.8 0 theme.space.2' },
    '& p': { margin: '0 0 theme.space.4' },
    '& strong': { fontWeight: 'theme.font.weight.semibold' },

    '& a': {
      color: 'theme.accent.default',
      textDecoration: 'underline',
      textDecorationThickness: '1px',
      textUnderlineOffset: '0.18em',
      textDecorationColor: 'theme.accent.tint',
      borderRadius: 'theme.radius.chip',
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
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.fill',
      // A long identifier or call breaks where it must rather than running off a phone's screen.
      overflowWrap: 'anywhere',
    },
    // In a heading, code keeps the heading's size and weight and reads as code by its face and a tint
    // of the accent, not by a block behind it.
    '& :is(h1, h2, h3, h4) code': {
      fontSize: '0.9em',
      fontWeight: 'inherit',
      padding: 0,
      backgroundColor: 'transparent',
      color: 'theme.accent.default',
    },
    // A code block in its frame: a header with the file or language and the copy button, then the code.
    '& [data-code]': {
      margin: '0 0 theme.space.6',
      borderRadius: 'theme.radius.code',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      overflow: 'hidden',
    },
    '@media (width >= theme.breakpoint.wide)': {
      // Code and tables may run a little past the prose measure, into the sheet's margin.
      '& [data-code], & [data-table], & [data-signature]': { marginInline: 'calc(-1 * theme.space.4)' },
    },
    '& [data-code] figcaption': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'theme.space.2',
      minHeight: 36,
      padding: '0 theme.space.1 0 theme.space.4',
      borderBottom: 'theme.line.width solid theme.line.hairline',
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.caption.size',
      color: 'theme.ink.secondary',
    },
    '& [data-code] figcaption [data-file]': { color: 'theme.ink.primary' },
    // A long file name gives way, with an ellipsis, rather than pushing the copy button out.
    '& [data-code] figcaption > span': {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& [data-code] figcaption [role="group"]': { display: 'flex', gap: 2, marginLeft: -8 },
    '& [data-code] pre': {
      margin: 0,
      padding: 'theme.space.4',
      overflowX: 'auto',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
    },
    '& [data-code] pre code': { padding: 0, fontSize: 'inherit', backgroundColor: 'transparent', borderRadius: 0 },
    '& [data-copy], & [data-pm-choice]': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'transparent',
      color: 'theme.ink.secondary',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      cursor: 'pointer',
    },
    '& [data-copy]': { flexShrink: 0, width: 28, height: 28, padding: 0, ...hitAreaCss },
    '& [data-pm-choice]': { height: 24, padding: '0 theme.space.2', ...hitAreaCss },
    '& [data-copy]:hover, & [data-pm-choice]:hover': { color: 'theme.ink.primary' },
    '& [data-copy]:focus-visible, & [data-pm-choice]:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: -2,
    },
    // The copy glyph turns into a tick for a moment once the code is copied.
    '& [data-copy] [data-icon="copied"], & [data-copy][data-copied] [data-icon="copy"]': { display: 'none' },
    '& [data-copy][data-copied] [data-icon="copied"]': { display: 'block', color: 'theme.callout.tip.glyph' },

    '& blockquote': {
      margin: '0 0 theme.space.4',
      padding: 'theme.space.3 theme.space.4',
      borderRadius: 'theme.radius.callout',
      backgroundColor: 'theme.callout.note.fill',
      color: 'theme.ink.primary',
    },
    '& blockquote > :last-child, & [data-callout] > :last-child': { marginBottom: 0 },

    // Callouts: a tinted fill and a label in the kind's colour; no thick border, no emoji.
    '& [data-callout]': {
      display: 'block',
      margin: '0 0 theme.space.4',
      padding: 'theme.space.3 theme.space.4',
      borderRadius: 'theme.radius.callout',
      backgroundColor: 'theme.callout.note.fill',
    },
    '& [data-callout] > [data-callout-label]': {
      display: 'block',
      marginBottom: 'theme.space.1',
      fontWeight: 'theme.font.weight.semibold',
      color: 'theme.callout.note.glyph',
    },
    '& [data-callout="tip"]': { backgroundColor: 'theme.callout.tip.fill' },
    '& [data-callout="tip"] > [data-callout-label]': { color: 'theme.callout.tip.glyph' },
    '& [data-callout="warning"]': { backgroundColor: 'theme.callout.warning.fill' },
    '& [data-callout="warning"] > [data-callout-label]': { color: 'theme.callout.warning.glyph' },
    '& [data-callout="danger"]': { backgroundColor: 'theme.callout.danger.fill' },
    '& [data-callout="danger"] > [data-callout-label]': { color: 'theme.callout.danger.glyph' },

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
    '& [data-api-meta]': {
      margin: '-12px 0 theme.space.8',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },
    '& [data-badge]': {
      display: 'inline-block',
      fontSize: 'theme.type.caption.size',
      lineHeight: 1.6,
      fontWeight: 'theme.font.weight.regular',
      letterSpacing: 0,
      padding: '0 theme.space.2',
      // A chip: a quiet tinted fill, rounded to its size.
      borderRadius: 'theme.radius.chip',
      backgroundColor: 'theme.accent.band',
      color: 'theme.accent.default',
      verticalAlign: 'middle',
    },
    '& [data-badge="deprecated"]': {
      backgroundColor: 'theme.callout.warning.fill',
      color: 'theme.callout.warning.glyph',
    },
    // A signature: framed like code, and wrapped rather than scrolled, since it is read, not copied.
    '& [data-signature]': {
      margin: '0 0 theme.space.6',
      padding: 'theme.space.3 theme.space.4',
      borderRadius: 'theme.radius.code',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
      // Long code arrives formatted over lines, so a narrow screen scrolls it rather than rewrapping.
      whiteSpace: 'pre',
      overflowX: 'auto',
    },
    '& [data-signature]:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: -2,
    },
    // A parameter's name reads whole; its type wraps between words, never inside one.
    '& [data-params] td:first-child code': { whiteSpace: 'nowrap' },
    '& [data-params] td code': { overflowWrap: 'normal' },
    '& [data-params] td code[data-type]': { display: 'inline-block', whiteSpace: 'pre' },
    '& [data-signature] code': { padding: 0, fontSize: 'inherit', backgroundColor: 'transparent', borderRadius: 0 },
    '& [data-signature] a': { color: 'inherit', textDecorationColor: 'theme.accent.tint' },
    '& [data-doc] > :last-child': { marginBottom: 0 },
    '& td [data-doc] p': { margin: 0 },
    '& [data-since]': { whiteSpace: 'nowrap' },

    // A page's one action, such as opening search: the accent push button, as the home panel's Run.
    '& [data-action]': {
      height: 32,
      padding: '0 theme.space.4',
      border: 'none',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.accent.default',
      color: 'theme.accent.content',
      fontFamily: 'inherit',
      fontSize: 'theme.type.control.size',
      fontWeight: 'theme.font.weight.semibold',
      cursor: 'pointer',
    },
    '& [data-action]:hover': { backgroundColor: 'theme.accent.hover' },
    '& [data-action]:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },

    // The page's context, muted under its title.
    '& [data-subtitle]': {
      margin: '-12px 0 theme.space.8',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },
  },
})
