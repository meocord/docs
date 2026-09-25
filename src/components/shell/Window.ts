import { A, Div } from '@meonode/ui'
import type { Children } from '@meonode/ui'
import { BrandLink } from '@/components/shell/brand'
import { Inspector } from '@/components/shell/Inspector'
import { SheetPane, SidebarPane } from '@/components/shell/panes'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { Toolbar, type ToolbarProps } from '@/components/shell/Toolbar'
import type { TocEntry } from '@/components/shell/types'

export interface WindowProps extends ToolbarProps {
  toc?: TocEntry[]
  /** Facts for the inspector under the headings, such as the edit link. */
  inspector?: Children
  children: Children
}

/** Hidden until focused, then the first thing on the page. */
function SkipLink() {
  return A({
    href: '#content',
    position: 'absolute',
    left: 'theme.space.2',
    top: 'theme.space.2',
    zIndex: 'theme.z.palette',
    padding: 'theme.space.2 theme.space.3',
    borderRadius: 'theme.radius.control',
    backgroundColor: 'theme.accent.default',
    color: 'theme.accent.content',
    fontWeight: 'theme.font.weight.medium',
    textDecoration: 'none',
    css: {
      transform: 'translateY(-200%)',
      '&:focus-visible': { transform: 'none', outline: 'none' },
    },
    children: 'Skip to content',
  })
}

/**
 * The docs window: the sidebar, then the toolbar over the reading sheet, then the inspector. Below the
 * compact breakpoint the sidebar becomes a sheet opened from the toolbar, and below the wide one the
 * inspector is not shown. Everything it draws comes from its props.
 */
export function Window({ crumbs, groups, version, repository, toc = [], inspector, children }: WindowProps) {
  return Div({
    display: 'flex',
    minHeight: '100dvh',
    children: [
      SkipLink(),
      SidebarPane({
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        css: { '@media (width < theme.breakpoint.compact)': { display: 'none' } },
        children: [Div({ padding: 'theme.space.3 theme.space.3 0', children: BrandLink() }), SidebarNav({ groups })],
      }),
      Div({
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        // meonode sets flex-shrink: 0 on every node; the reading column has to give way to the viewport.
        flexShrink: 1,
        minWidth: 0,
        children: [
          Toolbar({ crumbs, groups, version, repository }),
          Div({
            display: 'flex',
            flexGrow: 1,
            minWidth: 0,
            backgroundColor: 'theme.surface.sheet',
            children: [SheetPane({ tabIndex: -1, children }), Inspector({ toc, children: inspector })],
          }),
        ],
      }),
    ],
  })
}
