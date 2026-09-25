import { createNode } from '@meonode/ui'

/*
 * The window's prestyled panes: factories whose call sites override them with CSS props only. The
 * panes that take `css` are functions in @/components/shell/panes.
 */

/**
 * The sidebar's scroller: the body scrolls, the header above it does not, and nothing in the pane is
 * sticky. The scrollbar runs beside the navigation only.
 */
export const SidebarBody = createNode('div', {
  'data-sidebar-body': true,
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
})

/**
 * The reading sheet: an opaque, elevated card on the canvas, rounded where it meets it. A column of the
 * toolbar and SheetBody; on a desktop the body scrolls inside the card's rounded edge, on a phone the
 * card fills the screen and the document scrolls.
 */
export const SheetCard = createNode('div', {
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  // meonode sets flex-shrink: 0 on every node; the sheet has to give way to the viewport.
  flexShrink: 1,
  minWidth: 0,
  height: '100%',
  borderRadius: 'theme.radius.pane',
  backgroundColor: 'theme.surface.sheet',
  boxShadow: 'theme.elevation.2',
  // Clips without making a scroll container, so on a phone the toolbar stays sticky to the document.
  overflow: 'clip',
  // The body's scroll timeline, for the toolbar's hairline.
  timelineScope: '--sheet',
  css: {
    '@media (width < theme.breakpoint.compact)': {
      height: 'auto',
      minHeight: '100dvh',
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
})

/**
 * The reading sheet's scroller: the body scrolls, the toolbar above it does not, and nothing in the
 * sheet is sticky but the contents column inside the body. On a phone it is not a scroller; the
 * document scrolls.
 */
export const SheetBody = createNode('div', {
  'data-sheet': true,
  tabIndex: -1,
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  // Room for a classic scrollbar from the first frame, so its arrival never moves the page.
  scrollbarGutter: 'stable',
  scrollTimeline: '--sheet y',
  outline: 'none',
  css: { '@media (width < theme.breakpoint.compact)': { overflowY: 'visible' } },
})

/** The prose column inside the sheet. Reading is never on glass. */
export const SheetPane = createNode('main', {
  id: 'content',
  minWidth: 0,
  outline: 'none',
})

/** The column beside the prose: on this page, and the page's facts. */
export const InspectorPane = createNode('aside', {
  'data-inspector': true,
  width: 'theme.layout.inspector',
  flexShrink: 0,
  position: 'sticky',
  top: 'theme.space.2',
  maxHeight: 'calc(100dvh - 2 * theme.layout.gutter - theme.layout.toolbar - theme.space.4)',
  overflowY: 'auto',
  padding: 'theme.space.10 0 theme.space.8',
  // Shown only from the wide breakpoint up.
  css: { '@media (width < theme.breakpoint.wide)': { display: 'none' } },
})
