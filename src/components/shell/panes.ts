import { Aside, createNode, Div, Header, type ThemedCSSObject } from '@meonode/ui'
import { materialCss } from '@/lib/design/css'

/*
 * The window's panes. A pane whose call sites may pass `css` is a function that merges it over the
 * pane's own, so a material's fallbacks survive; the rest are prestyled factories that call sites
 * override with CSS props only (meonode#31).
 */

type WithCss<P> = Omit<NonNullable<P>, 'css'> & { css?: ThemedCSSObject }

/** The navigation column: the sidebar material, full height, scrolling on its own. */
export const SidebarPane = ({ css, ...props }: WithCss<Parameters<typeof Aside>[0]> = {}) =>
  Aside({
    width: 'theme.layout.sidebar',
    height: '100dvh',
    position: 'sticky',
    top: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    borderRight: 'theme.line.width solid theme.line.hairline',
    ...props,
    css: { ...materialCss('sidebar'), ...css },
  })

/** The toolbar across the reading column: the chrome material, sticky at the top. */
export const ToolbarBar = ({ css, ...props }: WithCss<Parameters<typeof Header>[0]> = {}) =>
  Header({
    position: 'sticky',
    top: 0,
    zIndex: 'theme.z.chrome',
    height: 'theme.layout.toolbar',
    display: 'flex',
    alignItems: 'center',
    gap: 'theme.space.2',
    padding: '0 theme.space.4',
    borderBottom: 'theme.line.width solid theme.line.hairline',
    ...props,
    css: { ...materialCss('chrome'), ...css },
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

/** The opaque reading sheet. Reading is never on glass. */
export const SheetPane = createNode('main', {
  id: 'content',
  minWidth: 0,
  flexGrow: 1,
  flexShrink: 1,
  backgroundColor: 'theme.surface.sheet',
  outline: 'none',
})

/** The right-hand column: on this page, and the page's facts. */
export const InspectorPane = createNode('aside', {
  width: 'theme.layout.inspector',
  flexShrink: 0,
  position: 'sticky',
  top: 'theme.layout.toolbar',
  alignSelf: 'flex-start',
  maxHeight: 'calc(100dvh - theme.layout.toolbar)',
  overflowY: 'auto',
  padding: 'theme.space.8 theme.space.6',
  backgroundColor: 'theme.surface.sheet',
  // Shown only from the wide breakpoint up.
  css: { '@media (width < theme.breakpoint.wide)': { display: 'none' } },
})
