import { Button, For, Li, Nav, Node, Ol, Span } from '@meonode/ui'
import { earFlickCss } from '@/lib/brand/ear-flick'
import { focusCss, touchCss, transitionCss } from '@/lib/design/css'
import { Mark } from '@/components/shell/brand'
import { Glyph } from '@/components/shell/icons'
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
      css: {
        // Each crumb gives way with an ellipsis (flex-shrink set explicitly, l7aromeo/meonode#33).
        '& > li > a, & > li > span[aria-current]': {
          flexShrink: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        // A phone shows only where the reader is, as a native navigation bar does.
        '@media (width < theme.breakpoint.compact)': {
          '& > li:not(:last-child), & > li > [aria-hidden]': { display: 'none' },
        },
      },
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
                    borderRadius: 'theme.radius.chip',
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

/**
 * The search field: a button drawn as a field, which opens the command palette. It carries
 * `data-search-trigger` for the palette's island to find, and shows the shortcut it answers to.
 */
function SearchField() {
  return Button(
    [
      Span(Glyph('search', 14), { key: 'icon', display: 'inline-flex', color: 'theme.ink.secondary' }),
      Span('Search', {
        key: 'label',
        flexGrow: 1,
        textAlign: 'left',
        css: { '@media (width < theme.breakpoint.compact)': { display: 'none' } },
      }),
      Node('kbd', {
        key: 'shortcut',
        'aria-hidden': true,
        children: '⌘K',
        css: { '@media (width < theme.breakpoint.compact)': { display: 'none' } },
      }),
    ],
    {
      type: 'button',
      'data-search-trigger': true,
      'aria-label': 'Search the documentation',
      'aria-keyshortcuts': 'Meta+K Control+K',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'theme.space.2',
      width: 220,
      height: 28,
      padding: '0 theme.space.1 0 theme.space.2',
      border: 'none',
      borderRadius: 'theme.radius.row',
      backgroundColor: 'theme.surface.fill',
      color: 'theme.ink.secondary',
      fontFamily: 'inherit',
      fontSize: 'theme.type.control.size',
      cursor: 'pointer',
      css: {
        ...transitionCss(),
        ...focusCss,
        '&:hover': { backgroundColor: 'theme.surface.fillHover' },
        '& kbd': {
          padding: '1px theme.space.1',
          borderRadius: 'theme.radius.chip',
          backgroundColor: 'theme.surface.sheet',
          boxShadow: 'theme.elevation.1',
          fontFamily: 'inherit',
          fontSize: 'theme.type.caption.size',
          color: 'theme.ink.secondary',
        },
        // A plain icon button on a phone, as the menu button beside it.
        '@media (width < theme.breakpoint.compact)': {
          width: 44,
          height: 44,
          padding: 0,
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
      },
    },
  )
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'theme.space.1',
        borderRadius: 'theme.radius.control',
        css: {
          ...focusCss,
          ...touchCss,
          ...earFlickCss(['&:hover', '&:focus-visible']),
          '@media (width >= theme.breakpoint.compact)': { display: 'none' },
        },
        children: Mark(),
      }),
      Breadcrumbs(crumbs),
      SearchField(),
      Node(VersionSwitcher, version),
      // On a phone the theme control is in the navigation sheet, leaving the bar room for touch targets.
      Span(Node(ThemeControl), {
        key: 'theme',
        display: 'inline-flex',
        css: { '@media (width < theme.breakpoint.compact)': { display: 'none' } },
      }),
      Link({
        href: repository,
        fontSize: 'theme.type.control.size',
        color: 'theme.ink.secondary',
        textDecoration: 'none',
        padding: '0 theme.space.1',
        borderRadius: 'theme.radius.chip',
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
