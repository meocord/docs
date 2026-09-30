import { Details, Div, For, Li, Nav, Span, Summary, Ul } from '@meonode/ui'
import { focusCss, transitionCss } from '@/lib/design/css'
import { Glyph, type GlyphName } from '@/components/shell/icons'
import { Link } from '@/components/shell/links'
import type { NavGroup, NavItem, NavTab } from '@/components/shell/types'

/** One link row, with no styles of its own: `SidebarNav` styles every row. */
function NavRow(item: NavItem) {
  return Li({
    key: item.href,
    children: Link({
      href: item.href,
      'aria-current': item.current ? 'page' : undefined,
      children: [Span(item.title, { title: item.title }), item.badge ? Span(item.badge, { 'data-badge': true }) : null],
    }),
  })
}

/** A group's items in runs of one category each, in order; items without one run on their own. */
function runs(items: NavItem[]): { category?: string; items: NavItem[] }[] {
  const out: { category?: string; items: NavItem[] }[] = []
  for (const item of items) {
    const last = out.at(-1)
    if (last && last.category === item.category) last.items.push(item)
    else out.push({ category: item.category, items: [item] })
  }
  return out
}

/**
 * A group as a disclosure: the browser's own <details>, so it opens and closes with no script. Its
 * summary is the group's title beside its glyph, and a chevron that turns as it opens.
 */
function NavSection(group: NavGroup) {
  return Details({
    open: true,
    'data-nav-group': true,
    'data-nav-icon': group.icon,
    children: [
      Summary(
        [
          Span(Glyph('chevronRight', 12), { key: 'chevron', 'data-chevron': true }),
          Span(Glyph(group.icon ?? 'book', 16), { key: 'icon', 'data-group-icon': true }),
          Span(group.title, { key: 'label' }),
        ],
        { key: 'title' },
      ),
      Ul({
        key: 'items',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        children: runs(group.items).flatMap(({ category, items }) =>
          category
            ? // A sub-group: its own list, named by its category, which its visible label shows once
              [
                Li({
                  key: `category-${category}`,
                  children: [
                    Div({ key: 'label', 'data-nav-category': true, 'aria-hidden': true, children: category }),
                    Ul({ key: 'items', 'aria-label': category, children: items.map(NavRow) }),
                  ],
                }),
              ]
            : items.map(NavRow),
        ),
      }),
    ],
  })
}

/**
 * The sidebar's links, grouped. Drawn once, in the sidebar pane; the sheet that replaces the pane on
 * phones reads them back from it with `readNavGroups`.
 */
export function SidebarNav({
  groups,
  tabs = [],
  label = 'Documentation',
}: {
  groups: NavGroup[]
  /** Top-level tabs above the groups, such as Guide and API; none draws no tab row. */
  tabs?: NavTab[]
  label?: string
}) {
  return Nav({
    'aria-label': label,
    display: 'flex',
    flexDirection: 'column',
    padding: 'theme.space.2 theme.space.2 theme.space.8',
    css: {
      // Groups are separated by a hairline, drawn between them rather than around them.
      '& [data-nav-group] + [data-nav-group]': {
        marginTop: 'theme.space.2',
        paddingTop: 'theme.space.2',
        borderTop: 'theme.line.width solid theme.line.hairline',
      },
      '& summary': {
        display: 'flex',
        alignItems: 'center',
        gap: 'theme.space.2',
        minHeight: 'theme.layout.row',
        padding: '0 theme.space.2',
        borderRadius: 'theme.radius.row',
        listStyle: 'none',
        cursor: 'pointer',
        fontSize: 'theme.type.caption.size',
        fontWeight: 'theme.font.weight.semibold',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'theme.ink.secondary',
        userSelect: 'none',
      },
      '& summary::-webkit-details-marker': { display: 'none' },
      '& summary:hover': { color: 'theme.ink.primary' },
      '& summary:focus-visible': {
        outline: 'theme.focus.width solid theme.accent.default',
        outlineOffset: -2,
      },
      '& [data-chevron]': {
        display: 'inline-flex',
        color: 'theme.ink.quiet',
        transitionProperty: 'transform',
        transitionDuration: 'theme.motion.duration.state',
        transitionTimingFunction: 'theme.motion.ease.enter',
      },
      '& details[open] > summary [data-chevron]': { transform: 'rotate(90deg)' },
      '& [data-group-icon]': { display: 'inline-flex', color: 'theme.accent.default' },
      '& li > ul': { margin: 0, padding: 0, listStyle: 'none' },
      // A sub-group's label: quieter than the group's, aligned with the rows' text.
      '& [data-nav-category]': {
        padding: 'theme.space.2 theme.space.2 theme.space.1 theme.space.8',
        fontSize: 'theme.type.caption.size',
        fontWeight: 'theme.font.weight.medium',
        color: 'theme.ink.secondary',
      },
      // The rows' styles, here rather than on each row: on the server a styled element is a client element
      // carrying its css object into the page's data, once per row (l7aromeo/meonode#34). Once meonode styles
      // server-rendered tags without that, rows can style themselves again. `:where` keeps each rule at the
      // nav's own weight, as a row's own class had, so the phone sheet's larger rows still override them.
      '& :where(li > a)': {
        display: 'flex',
        alignItems: 'center',
        gap: 'theme.space.2',
        minHeight: 'theme.layout.row',
        // Inset from the pane's edges, with the text aligned under the group's title.
        padding: '0 theme.space.2 0 theme.space.8',
        borderRadius: 'theme.radius.row',
        fontSize: 'theme.type.small.size',
        textDecoration: 'none',
        color: 'theme.ink.secondary',
        fontWeight: 'theme.font.weight.regular',
        backgroundColor: 'transparent',
        ...transitionCss(),
      },
      '& :where(li > a:hover)': { color: 'theme.ink.primary', backgroundColor: 'theme.surface.fillHover' },
      '& :where(li > a:focus-visible)': focusCss['&:focus-visible'],
      '& :where(li > a[aria-current="page"])': {
        color: 'theme.ink.primary',
        fontWeight: 'theme.font.weight.medium',
        backgroundColor: 'theme.accent.tint',
      },
      // A long title wraps to a second line rather than being cut short.
      '& :where(li > a > span[title])': {
        flexGrow: 1,
        // Set explicitly: a flex shorthand loses to the default flex-shrink 0 (l7aromeo/meonode#33).
        flexShrink: 1,
        minWidth: 0,
        paddingBlock: 'theme.space.1',
        overflowWrap: 'anywhere',
      },
      // The tabs: two or more links side by side, the current one tinted as a current row is.
      '& [data-nav-tabs]': {
        display: 'flex',
        gap: 'theme.space.1',
        margin: '0 0 theme.space.2',
        padding: 'theme.space.1',
        borderRadius: 'theme.radius.row',
        backgroundColor: 'theme.surface.fill',
      },
      '& [data-nav-tabs] > a': {
        flex: '1 1 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'theme.layout.row',
        borderRadius: 'theme.radius.row',
        fontSize: 'theme.type.small.size',
        fontWeight: 'theme.font.weight.medium',
        textDecoration: 'none',
        color: 'theme.ink.secondary',
        ...transitionCss(),
      },
      '& [data-nav-tabs] > a:hover': { color: 'theme.ink.primary' },
      '& [data-nav-tabs] > a:focus-visible': focusCss['&:focus-visible'],
      '& [data-nav-tabs] > a[aria-current="true"]': {
        color: 'theme.ink.primary',
        backgroundColor: 'theme.surface.sheet',
      },
      '& :where(li > a > [data-badge])': {
        // A long title shortens rather than the badge.
        flexShrink: 0,
        fontSize: 'theme.type.caption.size',
        color: 'theme.accent.default',
        border: '1px solid theme.accent.tint',
        borderRadius: 'theme.radius.chip',
        padding: '0 theme.space.1',
      },
      // On the current row's tint the default accent falls short of 4.5:1.
      '& :where(li > a[aria-current="page"] > [data-badge])': { color: 'theme.accent.hover' },
      '@media (prefers-reduced-motion: reduce)': { '& [data-chevron]': { transitionDuration: '0s' } },
    },
    children: [
      tabs.length > 0
        ? Div({
            key: 'tabs',
            'data-nav-tabs': true,
            children: tabs.map(tab =>
              Link({
                key: tab.href,
                href: tab.href,
                // The section read, not the page: the page's own link below is the one current as a page
                'aria-current': tab.current ? 'true' : undefined,
                children: tab.title,
              }),
            ),
          })
        : null,
      ...For(groups, NavSection, group => group.title),
    ],
  })
}

/** The tabs a `SidebarNav` was drawn with, read back from its markup, as `readNavGroups` reads its groups. */
export function readNavTabs(nav: Element): NavTab[] {
  return [...nav.querySelectorAll<HTMLAnchorElement>(':scope > [data-nav-tabs] > a')].map(link => ({
    title: link.textContent ?? '',
    href: link.getAttribute('href') ?? '',
    current: link.getAttribute('aria-current') === 'true' || undefined,
  }))
}

/**
 * The groups a `SidebarNav` was drawn from, read back from its markup, so the phone's sheet shows the
 * sidebar's links without the page carrying a second copy of them.
 */
export function readNavGroups(nav: Element): NavGroup[] {
  return [...nav.querySelectorAll<HTMLDetailsElement>(':scope > [data-nav-group]')].map(group => ({
    title: group.querySelector('summary')?.textContent ?? '',
    icon: (group.dataset.navIcon as GlyphName | undefined) || undefined,
    items: [...group.querySelectorAll<HTMLAnchorElement>(':scope > ul li > a')].map(link => ({
      title: link.querySelector('[title]')?.getAttribute('title') ?? link.textContent ?? '',
      href: link.getAttribute('href') ?? '',
      current: link.getAttribute('aria-current') === 'page' || undefined,
      badge: link.querySelector('[data-badge]')?.textContent || undefined,
      category: link.closest('ul[aria-label]')?.getAttribute('aria-label') || undefined,
    })),
  }))
}
