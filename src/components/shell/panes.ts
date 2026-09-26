import { Aside, Div, Header, type ThemedCSSObject } from '@meonode/ui'
import { materialCss, safe } from '@/lib/design/css'

/*
 * The window's panes whose call sites may pass `css`: each is a function that merges it over the pane's
 * own, so a material's fallbacks survive (meonode#31). The prestyled panes are factories in
 * @/components/nodes, where @meonode/compiler compiles their call sites.
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
    // A column for each control, in their order, sized before any is drawn: a page painted before the
    // bar has all arrived draws each control where it stays. Hidden controls take no column.
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 220px minmax(71px, auto) 86px minmax(51px, auto)',
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
        // The menu, the home link, where the reader is, search and the version.
        gridTemplateColumns: '44px 44px minmax(0, 1fr) 44px minmax(71px, auto)',
        borderRadius: 0,
        '@supports (animation-timeline: scroll())': { animationTimeline: 'scroll(root)' },
        // Under a notch or status bar, the bar grows by the safe area and keeps its controls below it.
        height: 'calc(theme.layout.toolbar + env(safe-area-inset-top))',
        padding: `env(safe-area-inset-top) ${safe('theme.space.2', 'right')} 0 ${safe('theme.space.2', 'left')}`,
      },
      // A window without a sidebar: no menu, and the home mark first, at every width.
      '&[data-bare]': {
        gridTemplateColumns: 'auto minmax(0, 1fr) 220px minmax(71px, auto) 86px minmax(51px, auto)',
        '@media (width < theme.breakpoint.compact)': {
          gridTemplateColumns: '44px minmax(0, 1fr) 44px minmax(71px, auto)',
        },
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
