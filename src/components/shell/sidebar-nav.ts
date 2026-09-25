import { Div, For, H2, Li, Nav, Span, Ul } from '@meonode/ui'
import { focusCss, transitionCss } from '@/lib/design/css'
import { Link } from '@/components/shell/links'
import type { NavGroup, NavItem } from '@/components/shell/types'

function NavRow(item: NavItem) {
  return Li({
    children: Link({
      href: item.href,
      'aria-current': item.current ? 'page' : undefined,
      display: 'flex',
      alignItems: 'center',
      gap: 'theme.space.2',
      minHeight: 'theme.layout.row',
      padding: '0 theme.space.2',
      borderRadius: 'theme.radius.control',
      fontSize: 'theme.type.control.size',
      letterSpacing: 'theme.type.control.track',
      textDecoration: 'none',
      color: item.current ? 'theme.ink.primary' : 'theme.ink.secondary',
      fontWeight: item.current ? 'theme.font.weight.medium' : 'theme.font.weight.regular',
      backgroundColor: item.current ? 'theme.accent.tint' : 'transparent',
      css: {
        ...transitionCss(),
        ...focusCss,
        '&:hover': {
          color: 'theme.ink.primary',
          backgroundColor: item.current ? undefined : 'theme.surface.fillHover',
        },
      },
      children: [
        Span(item.title, { flexGrow: 1, minWidth: 0 }),
        item.badge
          ? Span(item.badge, {
              fontSize: 'theme.type.caption.size',
              color: 'theme.accent.default',
              border: '1px solid theme.accent.tint',
              borderRadius: 'theme.radius.control',
              padding: '0 theme.space.1',
            })
          : null,
      ],
    }),
  })
}

function NavSection(group: NavGroup) {
  return Div({
    children: [
      H2(group.title, {
        margin: '0 0 theme.space.1',
        padding: '0 theme.space.2',
        fontSize: 'theme.type.caption.size',
        fontWeight: 'theme.font.weight.semibold',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'theme.ink.secondary',
      }),
      Ul({ margin: 0, padding: 0, listStyle: 'none', children: For(group.items, NavRow, item => item.href) }),
    ],
  })
}

/** The sidebar's links, grouped. Used by the sidebar pane and by the sheet that replaces it on phones. */
export function SidebarNav({ groups, label = 'Documentation' }: { groups: NavGroup[]; label?: string }) {
  return Nav({
    'aria-label': label,
    display: 'flex',
    flexDirection: 'column',
    gap: 'theme.space.6',
    padding: 'theme.space.4 theme.space.3 theme.space.8',
    children: For(groups, NavSection, group => group.title),
  })
}
