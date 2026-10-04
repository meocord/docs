import { createNode } from '@meonode/ui'
import { hitAreaCss } from '@/lib/design/css'

/**
 * The home page's sections below the pipeline panel: a tile for each kind of handler, the claims of
 * Why MeoCord, and the three doors, the first holding the quick start's steps. Their code frames are
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
    '& > section[aria-labelledby="build"]': { containIntrinsicSize: 'auto 420px' },
    '& > section[aria-labelledby="why"]': { containIntrinsicSize: 'auto 260px' },
    '& > section[aria-labelledby="doors"]': { containIntrinsicSize: 'auto 760px' },
    '& section > h2': { margin: '0 0 theme.space.6' },
    '& [data-more]': { fontSize: 'theme.type.small.size', ...hitAreaCss },

    // Each kind of handler, a tile that opens its section
    '& [data-tiles]': {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 'theme.space.3',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    '& [data-tiles] > li': { margin: 0 },
    '& [data-tile]': {
      display: 'block',
      height: '100%',
      padding: 'theme.space.4',
      borderRadius: 'theme.radius.callout',
      border: 'theme.line.width solid theme.line.hairline',
      color: 'theme.ink.secondary',
      textDecoration: 'none',
    },
    '& [data-tile]:hover': { backgroundColor: 'theme.surface.fill' },
    '& [data-tile] h3': {
      margin: '0 0 theme.space.1',
      color: 'theme.accent.default',
      fontSize: 'theme.type.body.size',
    },
    '& [data-tile] p': { margin: 0, fontSize: 'theme.type.small.size' },

    // The claims, side by side where they fit
    '& [data-claims]': {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 'theme.space.8',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    '& [data-claims] h3': { margin: '0 0 theme.space.2' },
    '& [data-claims] p': { margin: '0 0 theme.space.2', color: 'theme.ink.secondary' },

    // Learn across the top, with the quick start's steps; the other two doors below it
    '& [data-doors]': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: 'theme.space.8',
    },
    '& [data-door]': {
      padding: 'theme.space.6',
      borderRadius: 'theme.radius.pane',
      border: 'theme.line.width solid theme.line.hairline',
    },
    '& [data-door]:first-of-type': { gridColumn: '1 / -1' },
    '& [data-door] h3': { margin: '0 0 theme.space.2' },
    '& [data-door] > p': { margin: '0 0 theme.space.4', color: 'theme.ink.secondary' },
    '& [data-door] > ul': { margin: 0, paddingLeft: 'theme.space.6' },
    '& [data-door] > ul > li': { margin: '0 0 theme.space.1' },
    '@media (width < 900px)': {
      '& [data-doors]': { gridTemplateColumns: 'minmax(0, 1fr)' },
      // One column: the tiles and doors stack, so each section runs taller.
      '& > section[aria-labelledby="build"]': { containIntrinsicSize: 'auto 1100px' },
      '& > section[aria-labelledby="why"]': { containIntrinsicSize: 'auto 520px' },
      '& > section[aria-labelledby="doors"]': { containIntrinsicSize: 'auto 1300px' },
    },

    '& [data-steps]': { margin: '0 0 theme.space.4', padding: 0, listStyle: 'none', counterReset: 'step' },
    '& [data-steps] > li': {
      counterIncrement: 'step',
      display: 'grid',
      gridTemplateColumns: '32px minmax(0, 1fr)',
      columnGap: 'theme.space.3',
      margin: '0 0 theme.space.4',
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
    '& [data-steps] [data-code]': { margin: 0 },
  },
})
