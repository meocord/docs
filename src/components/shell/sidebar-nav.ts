import { Details, For, Li, Nav, Span, Summary, Ul } from '@meonode/ui'
import { focusCss, transitionCss } from '@/lib/design/css'
import { Glyph, type GlyphName } from '@/components/shell/icons'
import { Link } from '@/components/shell/links'
import type { NavGroup, NavItem } from '@/components/shell/types'

/** One link row, with no styles of its own: `SidebarNav` styles every row. */
function NavRow(item: NavItem) {
  return Li({
    children: Link({
      href: item.href,
      'aria-current': item.current ? 'page' : undefined,
      children: [Span(item.title, { title: item.title }), item.badge ? Span(item.badge, { 'data-badge': true }) : null],
    }),
  })
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
        children: For(group.items, NavRow, item => item.href),
      }),
    ],
  })
}

/**
 * The sidebar's links, grouped. Drawn once, in the sidebar pane; the sheet that replaces the pane on
 * phones reads them back from it with `readNavGroups`.
 */
export function SidebarNav({ groups, label = 'Documentation' }: { groups: NavGroup[]; label?: string }) {
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
      '& :where(li > a > span[title])': {
        flexGrow: 1,
        // Set explicitly: a flex shorthand loses to the default flex-shrink 0 (l7aromeo/meonode#33).
        flexShrink: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
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
    children: For(groups, NavSection, group => group.title),
  })
}

/**
 * The groups a `SidebarNav` was drawn from, read back from its markup, so the phone's sheet shows the
 * sidebar's links without the page carrying a second copy of them.
 */
export function readNavGroups(nav: Element): NavGroup[] {
  return [...nav.querySelectorAll<HTMLDetailsElement>(':scope > [data-nav-group]')].map(group => ({
    title: group.querySelector('summary')?.textContent ?? '',
    icon: (group.dataset.navIcon as GlyphName | undefined) || undefined,
    items: [...group.querySelectorAll<HTMLAnchorElement>(':scope > ul > li > a')].map(link => ({
      title: link.querySelector('[title]')?.getAttribute('title') ?? link.textContent ?? '',
      href: link.getAttribute('href') ?? '',
      current: link.getAttribute('aria-current') === 'page' || undefined,
      badge: link.querySelector('[data-badge]')?.textContent || undefined,
    })),
  }))
}
