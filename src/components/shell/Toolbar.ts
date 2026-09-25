import { For, Li, Nav, Node, Ol, Span } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'
import { Mark } from '@/components/shell/brand'
import { Link } from '@/components/shell/links'
import { MobileNav } from '@/components/shell/MobileNav'
import { ToolbarBar } from '@/components/shell/panes'
import { ThemeControl } from '@/components/shell/ThemeControl'
import type { Crumb, NavGroup, VersionOption } from '@/components/shell/types'
import { VersionSwitcher } from '@/components/shell/VersionSwitcher'

function Breadcrumbs(crumbs: Crumb[]) {
  return Nav({
    'aria-label': 'Breadcrumb',
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    children: Ol({
      display: 'flex',
      alignItems: 'center',
      gap: 'theme.space.1',
      margin: 0,
      padding: 0,
      listStyle: 'none',
      fontSize: 'theme.type.control.size',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      children: For(
        crumbs,
        (crumb, index) =>
          Li({
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'theme.space.1',
            minWidth: 0,
            flexShrink: 1,
            children: [
              index > 0 ? Span('/', { 'aria-hidden': true, color: 'theme.ink.quiet' }) : null,
              crumb.href && index < crumbs.length - 1
                ? Link({
                    href: crumb.href,
                    color: 'theme.ink.secondary',
                    textDecoration: 'none',
                    borderRadius: 4,
                    css: { ...focusCss, '&:hover': { color: 'theme.ink.primary' } },
                    children: crumb.title,
                  })
                : Span(crumb.title, {
                    'aria-current': index === crumbs.length - 1 ? 'page' : undefined,
                    color: 'theme.ink.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }),
            ],
          }),
        crumb => crumb.title,
      ),
    }),
  })
}

export interface ToolbarProps {
  crumbs: Crumb[]
  groups: NavGroup[]
  version: { current: VersionOption; options: VersionOption[] }
  /** The source repository, linked at the end of the bar. */
  repository: string
}

/** The bar over the reading column: the phone menu, where the reader is, and the page-wide controls. */
export function Toolbar({ crumbs, groups, version, repository }: ToolbarProps) {
  return ToolbarBar({
    children: [
      Node(MobileNav, { groups }),
      // The home link, while the sidebar that carries it is hidden.
      Link({
        href: '/',
        'aria-label': 'MeoCord home',
        display: 'inline-flex',
        padding: 'theme.space.1',
        borderRadius: 'theme.radius.control',
        css: { ...focusCss, '@media (width >= theme.breakpoint.compact)': { display: 'none' } },
        children: Mark(),
      }),
      Breadcrumbs(crumbs),
      Node(VersionSwitcher, version),
      Node(ThemeControl),
      Link({
        href: repository,
        fontSize: 'theme.type.control.size',
        color: 'theme.ink.secondary',
        textDecoration: 'none',
        padding: '0 theme.space.1',
        borderRadius: 4,
        css: {
          ...focusCss,
          '&:hover': { color: 'theme.ink.primary' },
          '@media (width < theme.breakpoint.compact)': { display: 'none' },
        },
        children: 'GitHub',
      }),
    ],
  })
}
