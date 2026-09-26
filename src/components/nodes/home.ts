import { createNode } from '@meonode/ui'
import { hitAreaCss } from '@/lib/design/css'

/**
 * The home page's sections below the pipeline panel, laid out in rows: a claim beside the code that
 * backs it, the steps to start, a spec beside its passing run, and what is new. Their code frames are
 * the docs' own, styled by the Prose container around them; this lays them out.
 */
export const HomeRows = createNode('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: 'theme.space.16',
  css: {
    // Drawn only as the reader nears them: before the first paint the browser skips their style,
    // layout and paint, while they stay in the accessibility tree and find-in-page. Each size is the
    // section's measured height, which `auto` replaces with the real one once it has been drawn.
    '& > section': { contentVisibility: 'auto' },
    '& > section[aria-labelledby="why"]': { containIntrinsicSize: 'auto 1600px' },
    '& > section[aria-labelledby="features"]': { containIntrinsicSize: 'auto 2500px' },
    '& > section[aria-labelledby="start"]': { containIntrinsicSize: 'auto 632px' },
    '& > section[aria-labelledby="testing"]': { containIntrinsicSize: 'auto 790px' },
    '& > section[aria-labelledby="new"]': { containIntrinsicSize: 'auto 143px' },
    '& section > h2': { margin: '0 0 theme.space.6' },
    '& [data-row]': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
      columnGap: 'theme.space.10',
      rowGap: 'theme.space.4',
      alignItems: 'start',
      padding: 'theme.space.8 0',
      borderTop: 'theme.line.width solid theme.line.hairline',
    },
    '& [data-row]:first-of-type': { borderTop: 'none', paddingTop: 0 },
    '@media (width < 1100px)': {
      '& [data-row]': { gridTemplateColumns: 'minmax(0, 1fr)' },
      // One column: the rows stack, so each section runs taller.
      '& > section[aria-labelledby="why"]': { containIntrinsicSize: 'auto 2750px' },
      '& > section[aria-labelledby="features"]': { containIntrinsicSize: 'auto 3750px' },
      '& > section[aria-labelledby="start"]': { containIntrinsicSize: 'auto 686px' },
      '& > section[aria-labelledby="testing"]': { containIntrinsicSize: 'auto 1166px' },
      '& > section[aria-labelledby="new"]': { containIntrinsicSize: 'auto 191px' },
    },
    '& [data-row] h3': { margin: '0 0 theme.space.2' },
    '& [data-row] p': { margin: '0 0 theme.space.3', color: 'theme.ink.secondary' },
    '& [data-row] [data-code]': { margin: 0 },
    // A row's code reads whole at any width: long lines wrap, continuing under a hanging indent. Lines
    // are rows of a flex column, so the newlines between them are not drawn twice.
    '& [data-row] [data-code] pre code': { display: 'flex', flexDirection: 'column', whiteSpace: 'pre-wrap' },
    '& [data-row] [data-code] .line': {
      minHeight: '1lh',
      paddingLeft: '4ch',
      textIndent: '-4ch',
      overflowWrap: 'anywhere',
    },
    '& [data-more]': { fontSize: 'theme.type.small.size', ...hitAreaCss },

    '& [data-steps]': { margin: 0, padding: 0, listStyle: 'none', counterReset: 'step' },
    '& [data-steps] > li': {
      counterIncrement: 'step',
      display: 'grid',
      gridTemplateColumns: '32px minmax(0, 1fr)',
      columnGap: 'theme.space.4',
      margin: '0 0 theme.space.6',
    },
    '& [data-steps] > li::before': {
      content: 'counter(step)',
      display: 'grid',
      placeItems: 'center',
      width: 28,
      height: 28,
      borderRadius: '50%',
      backgroundColor: 'theme.accent.band',
      color: 'theme.accent.default',
      fontSize: 'theme.type.small.size',
      fontWeight: 'theme.font.weight.semibold',
    },
    '& [data-steps] > li > div > p': { margin: '2px 0 theme.space.3', color: 'theme.ink.primary' },

    // The spec's run, drawn as a terminal reports it.
    '& [data-run-output]': {
      margin: 0,
      padding: 'theme.space.4',
      borderRadius: 'theme.radius.code',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
      color: 'theme.ink.secondary',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    },
    '& [data-pass]': { color: 'theme.callout.tip.glyph' },

    '& [data-news]': {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'theme.space.2',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    '& [data-news] a': {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 32,
      padding: '0 theme.space.3',
      borderRadius: 'theme.radius.row',
      backgroundColor: 'theme.surface.fill',
      color: 'theme.ink.primary',
      textDecoration: 'none',
      fontSize: 'theme.type.small.size',
    },
    '& [data-news] a:hover': { backgroundColor: 'theme.surface.fillHover' },

    // A feature's result: a small panel drawn the way the reader meets it, in Discord or in a test.
    '& [data-result]': {
      margin: 'theme.space.4 0 0',
      padding: 'theme.space.4',
      borderRadius: 'theme.radius.callout',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      fontSize: 'theme.type.small.size',
    },
    '& [data-result-label]': {
      margin: '0 0 theme.space.3',
      fontSize: 'theme.type.caption.size',
      color: 'theme.ink.secondary',
    },
    '& [data-result-label] code': { fontFamily: 'theme.font.mono' },
    '& [data-route]': {
      display: 'grid',
      gridTemplateColumns: 'max-content minmax(0, 1fr)',
      columnGap: 'theme.space.4',
      rowGap: 'theme.space.2',
      margin: 0,
    },
    '& [data-route] dt': { color: 'theme.ink.secondary' },
    '& [data-route] dd': {
      margin: 0,
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.control.size',
      color: 'theme.ink.primary',
      overflowWrap: 'anywhere',
    },
    '& [data-message]': { display: 'flex', gap: 'theme.space.3', alignItems: 'flex-start' },
    '& [data-avatar]': {
      flexShrink: 0,
      width: 28,
      height: 28,
      display: 'grid',
      placeItems: 'center',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.sheet',
    },
    '& [data-who]': { display: 'flex', gap: 'theme.space.2', alignItems: 'center' },
    '& [data-who] strong': { color: 'theme.ink.primary', fontWeight: 'theme.font.weight.semibold' },
    '& [data-app]': {
      padding: '0 theme.space.1',
      borderRadius: 'theme.radius.chip',
      backgroundColor: 'theme.accent.band',
      color: 'theme.accent.default',
      fontSize: 10,
      fontWeight: 'theme.font.weight.semibold',
    },
    '& [data-private]': { fontSize: 'theme.type.caption.size', color: 'theme.ink.secondary' },
    '& [data-said]': { color: 'theme.ink.primary', overflowWrap: 'anywhere' },
    '& [data-embed]': {
      marginTop: 'theme.space.1',
      padding: 'theme.space.2 theme.space.3',
      borderRadius: 'theme.radius.chip',
      borderLeft: '4px solid var(--embed-color)',
      backgroundColor: 'theme.surface.fill',
    },
    '& [data-embed] strong': { display: 'block', color: 'theme.ink.primary' },
  },
})
