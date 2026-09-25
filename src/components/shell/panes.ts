import { Aside, createNode, Div, Header, type ThemedCSSObject } from '@meonode/ui'
import { materialCss, safe } from '@/lib/design/css'

/*
 * The window's panes. A pane whose call sites may pass `css` is a function that merges it over the
 * pane's own, so a material's fallbacks survive; the rest are prestyled factories that call sites
 * override with CSS props only (meonode#31).
 */

type WithCss<P> = Omit<NonNullable<P>, 'css'> & { css?: ThemedCSSObject }

/**
 * The navigation pane: the sidebar material, inset from the window's edge, rounded. A column of its
 * header, which stays put, and SidebarBody beneath it, which scrolls.
 */
export const SidebarPane = ({ css, ...props }: WithCss<Parameters<typeof Aside>[0]> = {}) =>
  Aside({
    'data-sidebar': true,
    display: 'flex',
    flexDirection: 'column',
    width: 'theme.layout.sidebar',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 'theme.radius.pane',
    boxShadow: 'theme.elevation.1',
    ...props,
    css: { ...materialCss('sidebar'), ...css },
  })

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
 * The toolbar: the reading sheet's header, in the chrome material, above SheetBody. On a desktop it
 * stays put while the body scrolls; on a phone, where the document scrolls, it is sticky to it. Its
 * hairline appears once the page has scrolled, driven by the scroll itself where the browser supports
 * scroll timelines, and always drawn where it does not.
 */
export const ToolbarBar = ({ css, ...props }: WithCss<Parameters<typeof Header>[0]> = {}) =>
  Header({
    'data-toolbar': true,
    flexShrink: 0,
    zIndex: 'theme.z.chrome',
    height: 'theme.layout.toolbar',
    display: 'flex',
    alignItems: 'center',
    gap: 'theme.space.2',
    padding: '0 theme.space.3 0 theme.space.4',
    borderBottom: 'theme.line.width solid theme.line.hairline',
    borderRadius: 'theme.radius.pane theme.radius.pane 0 0',
    ...props,
    css: {
      ...materialCss('chrome'),
      '@supports (animation-timeline: scroll())': {
        borderBottomColor: 'transparent',
        animation: 'toolbar-hairline linear both',
        // SheetBody's scroll, which the sheet makes visible to the toolbar beside it.
        animationTimeline: '--sheet',
        animationRange: '0 8px',
      },
      '@keyframes toolbar-hairline': { to: { borderBottomColor: 'theme.line.hairline' } },
      '@media (width < theme.breakpoint.compact)': {
        position: 'sticky',
        top: 0,
        borderRadius: 0,
        '@supports (animation-timeline: scroll())': { animationTimeline: 'scroll(root)' },
        // Under a notch or status bar, the bar grows by the safe area and keeps its controls below it.
        height: 'calc(theme.layout.toolbar + env(safe-area-inset-top))',
        padding: `env(safe-area-inset-top) ${safe('theme.space.2', 'right')} 0 ${safe('theme.space.2', 'left')}`,
      },
      ...css,
    },
  })

/** A floating surface for menus and popovers: the popover material, raised, with rounded corners. */
export const PopoverSurface = ({ css, ...props }: WithCss<Parameters<typeof Div>[0]> = {}) =>
  Div({
    borderRadius: 'theme.radius.popover',
    boxShadow: 'theme.elevation.3',
    padding: 'theme.space.1',
    ...props,
    css: { ...materialCss('popover'), ...css },
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
