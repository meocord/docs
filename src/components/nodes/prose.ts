import { createNode } from '@meonode/ui'
import { hitAreaCss, safe } from '@/lib/design/css'
import { HANDLER_KINDS } from '@/lib/docs/pipeline'

const heading = (level: 'h1' | 'h2' | 'h3' | 'h4') => ({
  fontSize: `theme.type.${level}.size`,
  lineHeight: `theme.type.${level}.line`,
  letterSpacing: `theme.type.${level}.track`,
  fontWeight: 'theme.font.weight.semibold',
  color: 'theme.ink.primary',
  // The sheet's body scrolls below the toolbar on a desktop; on a phone the toolbar sits over the page.
  scrollMarginTop: 'theme.space.4',
  '@media (width < theme.breakpoint.compact)': { scrollMarginTop: 'calc(theme.layout.toolbar + theme.space.4)' },
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
    // A code block scrolls sideways, so it takes focus; the frame clips, so the ring sits inside it.
    '& [data-code] pre:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: -2,
    },

    // A playground: its code frame, then a bar with Run and the inputs it dispatches, then the result.
    '& [data-playground-embed]': { margin: '0 0 theme.space.6' },
    '& [data-playground-embed] [data-code]': { margin: 0 },
    '& [data-playground-bar]': {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 'theme.space.3',
      marginTop: 'theme.space.2',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },
    '& [data-playground-run]': {
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
    '& [data-playground-run]:hover': { backgroundColor: 'theme.accent.hover' },
    '& [data-playground-run]:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },
    '& [data-playground-run][aria-busy="true"]': { cursor: 'progress' },
    '& [data-playground-run][hidden]': { display: 'none' },
    '& [data-playground-output]': {
      marginTop: 'theme.space.3',
      padding: 'theme.space.3 theme.space.4',
      border: 'theme.line.width solid theme.line.hairline',
      borderRadius: 'theme.radius.code',
      fontSize: 'theme.type.small.size',
    },
    // Collapsed, not hidden, while empty: a live region must be in the tree before it changes to be announced
    '& [data-playground-output]:empty': { margin: 0, padding: 0, border: 0 },
    '& [data-playground-output] p': { margin: 0 },
    '& [data-playground-steps]': { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 'theme.space.3' },
    '& [data-playground-steps] > li': { margin: 0 },
    '& [data-playground-input]': { fontWeight: 'theme.font.weight.semibold' },
    '& [data-playground-calls]': { margin: 'theme.space.1 0 0', paddingLeft: 'theme.space.4' },
    '& [data-playground-calls] li': { margin: 'theme.space.1 0 0', overflowWrap: 'anywhere' },
    '& [data-playground-output] details': { marginTop: 'theme.space.1' },
    '& [data-playground-output] summary': { cursor: 'pointer', color: 'theme.ink.secondary' },
    '& [data-playground-output] pre': {
      margin: 'theme.space.1 0 0',
      padding: 'theme.space.2 theme.space.3',
      maxHeight: 320,
      overflow: 'auto',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.canvas',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
    },
    '& [data-playground-output] pre:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: -2,
    },
    '& [data-playground-quiet]': { color: 'theme.ink.secondary' },
    '& [data-playground-error]': { color: 'theme.callout.danger.glyph', overflowWrap: 'anywhere' },
    '& [data-playground-step][data-ran="false"] [data-playground-input]': { color: 'theme.ink.secondary' },
    // The playground page: an editor for the code and the inputs, then the bar and the result.
    '& [data-playground-page]': { display: 'grid', gap: 'theme.space.4', margin: '0 0 theme.space.6' },
    '& [data-playground-fields]': { display: 'grid', gap: 'theme.space.4' },
    '& [data-playground-field]': { display: 'grid', gap: 'theme.space.1' },
    '& [data-playground-field] label': { fontWeight: 'theme.font.weight.semibold' },
    '& [data-playground-field] :is(textarea, input, select)': {
      width: '100%',
      padding: 'theme.space.2 theme.space.3',
      border: 'theme.line.width solid theme.line.strong',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.canvas',
      color: 'theme.ink.primary',
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
    },
    '& [data-playground-field] textarea': { minHeight: 320, resize: 'vertical', overflowX: 'auto', whiteSpace: 'pre' },
    // The code editor, once loaded, in the textarea's frame: its lines carry the padding, the gutter the left edge
    '& [data-playground-field] .cm-editor': {
      border: 'theme.line.width solid theme.line.strong',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.canvas',
      color: 'theme.ink.primary',
      fontSize: 'theme.type.code.size',
    },
    '& [data-playground-field] .cm-scroller': {
      minHeight: 320,
      maxHeight: '70vh',
      fontFamily: 'theme.font.mono',
      lineHeight: 'theme.type.code.line',
    },
    '& [data-playground-field] .cm-content': { padding: 'theme.space.2 0' },
    '& [data-playground-field] .cm-editor.cm-focused': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },
    // Over CodeMirror's own theme, which draws for a light page: a black caret and a grey gutter
    '& [data-playground-field] .cm-editor .cm-content': { caretColor: 'theme.ink.primary' },
    '& [data-playground-field] .cm-editor .cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'theme.ink.secondary',
    },
    '& [data-playground-field] select': { fontFamily: 'inherit', fontSize: 'theme.type.body.size' },
    '& [data-playground-field] :is(textarea, input, select):focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },
    '& [data-playground-page] [data-playground-bar]': { marginTop: 0 },
    '& [data-playground-share]': {
      height: 32,
      padding: '0 theme.space.4',
      border: 'theme.line.width solid theme.line.strong',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'transparent',
      color: 'theme.ink.primary',
      fontFamily: 'inherit',
      fontSize: 'theme.type.control.size',
      cursor: 'pointer',
    },
    '& [data-playground-share]:hover': { backgroundColor: 'theme.surface.fill' },
    '& [data-playground-share]:focus-visible': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },
    '& [data-playground-share][hidden], & [data-playground-open][hidden]': { display: 'none' },
    '& [data-playground-status]': { color: 'theme.ink.secondary' },

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
    // An API's list of symbols: each name over its summary, rows divided by hairlines rather than bulleted.
    '& [data-api-list]': { listStyle: 'none', padding: 0, margin: '0 0 theme.space.8' },
    '& [data-api-list] > li': {
      margin: 0,
      padding: 'theme.space.3 0',
      borderBottom: 'theme.line.width solid theme.line.hairline',
    },
    '& [data-api-list] > li > a': { textDecoration: 'none' },
    '& [data-api-list] [data-doc] p': { margin: 'theme.space.1 0 0', color: 'theme.ink.secondary' },
    // A kind's heading on the API index links to its page, but reads as a heading.
    '& [data-kind-heading] a': { color: 'inherit', textDecoration: 'none' },
    '& [data-kind-heading] a:hover': { color: 'theme.accent.default' },
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
    // An option's row is a link's target, as a heading is: clear of the toolbar, and marked at its edge while it
    // is the target, leaving the background its code's colours are measured against.
    '& [data-params] tr[id]': {
      scrollMarginTop: 'theme.space.4',
      '@media (width < theme.breakpoint.compact)': { scrollMarginTop: 'calc(theme.layout.toolbar + theme.space.4)' },
    },
    '& [data-params] tr:target': { boxShadow: 'inset 3px 0 0 theme.accent.default' },
    // A glossary's term is a link's target too: clear of the toolbar, and marked in the gutter beside it while it
    // is the target, its text left where it stands.
    '& p[data-term]': {
      position: 'relative',
      scrollMarginTop: 'theme.space.4',
      '@media (width < theme.breakpoint.compact)': { scrollMarginTop: 'calc(theme.layout.toolbar + theme.space.4)' },
    },
    '& p[data-term]:target::before': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      insetInlineStart: 'calc(-1 * theme.space.3)',
      width: 3,
      borderRadius: 'theme.radius.chip',
      backgroundColor: 'theme.accent.default',
    },
    '& [data-params] td:first-child code': { whiteSpace: 'nowrap' },
    '& [data-params] td code': { overflowWrap: 'normal' },
    '& [data-params] td code[data-type]': { display: 'inline-block', whiteSpace: 'pre' },
    '& [data-signature] code': { padding: 0, fontSize: 'inherit', backgroundColor: 'transparent', borderRadius: 0 },
    '& [data-signature] a': { color: 'inherit', textDecorationColor: 'theme.accent.tint' },
    '@media (width >= theme.breakpoint.wide)': {
      // Code and tables may run a little past the prose measure, into the sheet's margin.
      '& [data-code], & [data-table], & [data-signature]': { marginInline: 'calc(-1 * theme.space.4)' },
    },
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

    // Text read aloud and indexed but not drawn, such as punctuation a line break stands in for on screen
    '& [data-visually-hidden]': {
      position: 'absolute',
      width: 1,
      height: 1,
      margin: -1,
      padding: 0,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0,
    },

    // What the page's subject is, inside its heading but drawn as the line under the title, as the home page's is
    '& h1 [data-headline]': {
      display: 'block',
      marginTop: 'theme.space.2',
      fontSize: 'theme.type.body.size',
      lineHeight: 'theme.type.body.line',
      fontWeight: 'theme.font.weight.regular',
      letterSpacing: 'theme.type.body.track',
      color: 'theme.ink.primary',
    },

    // The page's context, muted under its title.
    '& [data-subtitle]': {
      margin: '-12px 0 theme.space.8',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },

    // A Guide page's opening: its summary, then what it teaches and what to read first, side by side.
    '& [data-summary]': {
      margin: '-16px 0 theme.space.6',
      fontSize: 'theme.type.body.size',
      lineHeight: 'theme.type.body.line',
      color: 'theme.ink.secondary',
    },
    '& [data-guide-intro]': {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 'theme.space.4',
      margin: '0 0 theme.space.8',
      padding: 'theme.space.4',
      borderRadius: 'theme.radius.callout',
      backgroundColor: 'theme.surface.canvas',
    },
    '& [data-guide-intro] ul': { margin: 0 },
    '& [data-guide-label]': {
      margin: '0 0 theme.space.1',
      fontSize: 'theme.type.caption.size',
      lineHeight: 'theme.type.caption.line',
      fontWeight: 'theme.font.weight.semibold',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'theme.ink.secondary',
    },

    // The pipeline figure: each stage in order, the ones that wrap others drawn around them.
    '& [data-pipeline-figure]': { margin: 'theme.space.6 0' },
    '& [data-pipeline-figure] fieldset': {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 'theme.space.2',
      margin: '0 0 theme.space.4',
      padding: 0,
      border: 'none',
    },
    '& [data-pipeline-figure] legend': {
      float: 'left',
      marginRight: 'theme.space.1',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },
    '& [data-pipeline-figure] label': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'theme.space.2',
      padding: 'theme.space.1 theme.space.3',
      border: 'theme.line.width solid theme.line.hairline',
      borderRadius: 'theme.radius.chip',
      fontSize: 'theme.type.small.size',
      cursor: 'pointer',
    },
    '& [data-pipeline-figure] label:has(input:checked)': { borderColor: 'theme.accent.default' },
    '& [data-pipeline-figure] label:has(input:focus-visible)': {
      outline: 'theme.focus.width solid theme.accent.default',
      outlineOffset: 'theme.focus.offset',
    },
    '& [data-pipeline-figure] input': { margin: 0, accentColor: 'theme.accent.default' },
    '& [data-pipeline-figure] ol': { display: 'grid', gap: 'theme.space.2', margin: 0, padding: 0, listStyle: 'none' },
    '& [data-pipeline-figure] li': { margin: 0 },
    '& [data-pipeline-figure] [data-stage]': {
      padding: 'theme.space.2 theme.space.3',
      border: 'theme.line.width solid theme.line.hairline',
      borderRadius: 'theme.radius.control',
      background: 'theme.surface.fill',
    },
    '& [data-pipeline-figure] [data-stage] > a:first-child': { fontWeight: 'theme.font.weight.semibold' },
    '& [data-pipeline-figure] [data-stage] p': {
      margin: 'theme.space.1 0 0',
      fontSize: 'theme.type.small.size',
      color: 'theme.ink.secondary',
    },
    '& [data-pipeline-figure] li[data-frame]': {
      padding: 'theme.space.2',
      border: 'theme.line.width dashed theme.line.strong',
      borderRadius: 'theme.radius.callout',
    },
    '& [data-pipeline-figure] li[data-frame] > [data-stage]': {
      padding: '0 theme.space.1 theme.space.2',
      border: 'none',
      background: 'none',
    },
    // A stage's words for one kind show once that kind is picked, in place of its words for any
    '& [data-pipeline-figure] [data-stage] p[data-kinds]': { display: 'none' },
    // A kind of handler picked shows only the stages it runs; a frame it skips keeps what it wraps, unframed
    ...Object.fromEntries(
      HANDLER_KINDS.flatMap(({ id }) => {
        const picked = `& [data-pipeline-figure]:has(input[value="${id}"]:checked)`
        const skipped = `:not([data-kinds~="${id}"])`
        return [
          [`${picked} li${skipped}:not([data-frame])`, { display: 'none' }],
          [`${picked} li[data-frame]${skipped}`, { padding: 0, border: 'none' }],
          [`${picked} li[data-frame]${skipped} > [data-stage]`, { display: 'none' }],
          [`${picked} [data-stage] p[data-kinds~="${id}"]`, { display: 'block' }],
          [`${picked} [data-stage]:has(p[data-kinds~="${id}"]) > p[data-what]`, { display: 'none' }],
        ]
      }),
    ),

    // After the body: the API entries the page teaches, the example bots showing it, then the pages around it.
    ...Object.fromEntries(
      ['[data-guide-api]', '[data-guide-bots]'].flatMap(aside => [
        [
          `& ${aside}`,
          {
            margin: 'theme.space.12 0 0',
            paddingTop: 'theme.space.6',
            borderTop: 'theme.line.width solid theme.line.hairline',
          },
        ],
        [`& ${aside} h2`, { margin: '0 0 theme.space.3', fontSize: 'theme.type.h3.size' }],
      ]),
    ),
    '& [data-pager]': {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'theme.space.4',
      margin: 'theme.space.12 0 0',
    },
    '& [data-pager] a': {
      display: 'flex',
      flexDirection: 'column',
      gap: 'theme.space.1',
      padding: 'theme.space.3 theme.space.4',
      border: 'theme.line.width solid theme.line.hairline',
      borderRadius: 'theme.radius.code',
      textDecoration: 'none',
    },
    '& [data-pager] a[rel="next"]': { gridColumn: 2, textAlign: 'right' },
    '& [data-pager] a > span:first-child': {
      fontSize: 'theme.type.caption.size',
      color: 'theme.ink.secondary',
    },
  },
})
