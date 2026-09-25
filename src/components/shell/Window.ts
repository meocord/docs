import { A, Div, Footer, Grid, Node, Row } from '@meonode/ui'
import type { Children } from '@meonode/ui'
import { BrandLink } from '@/components/shell/brand'
import { safe } from '@/lib/design/css'
import { Inspector } from '@/components/shell/Inspector'
import { SheetCard, SheetPane, SidebarPane } from '@/components/shell/panes'
import { SheetScroll } from '@/components/shell/SheetScroll'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { Toolbar, type ToolbarProps } from '@/components/shell/Toolbar'
import type { TocEntry } from '@/components/shell/types'

export interface WindowProps extends ToolbarProps {
  toc?: TocEntry[]
  /** Facts for the inspector under the headings, such as the edit link. */
  inspector?: Children
  /** A page wider than the prose measure, such as the home page, with no contents column. */
  wide?: boolean
  children: Children
}

/** The foot of every page: the credit for the site's images. */
function SiteFooter({ wide }: { wide?: boolean } = {}) {
  return Footer({
    key: 'footer',
    maxWidth: wide ? 'none' : 'calc(theme.layout.prose + 2 * theme.layout.sheetPad)',
    margin: 'theme.space.16 0 0',
    padding: 'theme.space.6 theme.layout.sheetPad theme.space.10',
    borderTop: 'theme.line.width solid theme.line.hairline',
    fontSize: 'theme.type.caption.size',
    color: 'theme.ink.secondary',
    css: {
      '@media (width < theme.breakpoint.compact)': {
        paddingLeft: safe('theme.layout.sheetPadCompact', 'left'),
        paddingRight: safe('theme.layout.sheetPadCompact', 'right'),
        paddingBottom: 'calc(theme.space.10 + env(safe-area-inset-bottom))',
      },
    },
    children: [
      'Images drawn with ',
      A({
        key: 'meo-canvas',
        href: 'https://github.com/l7aromeo/meo-canvas',
        color: 'inherit',
        textDecoration: 'underline',
        textUnderlineOffset: '0.18em',
        css: { '&:hover': { color: 'theme.ink.primary' } },
        children: 'meo-canvas',
      }),
      '.',
    ],
  })
}

/** Hidden until focused, then the first thing on the page. */
function SkipLink() {
  return A({
    href: '#content',
    position: 'absolute',
    left: 'theme.space.2',
    top: 'theme.space.2',
    zIndex: 'theme.z.palette',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 theme.space.4',
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
 * The docs window, as a desktop app's: on the canvas, an inset material sidebar, and beside it the
 * reading sheet, an elevated card whose header is the toolbar. Inside the sheet, the prose and the
 * table of contents form one region, centred, so the page is balanced at any width. Below the compact
 * breakpoint the sidebar becomes a sheet opened from the toolbar and the card fills the screen; below
 * the wide one the table of contents is not shown. On a desktop the window is fixed to the viewport
 * and its panes scroll, each on its own; on a phone the document scrolls. Everything it draws comes
 * from its props.
 */
export function Window({ crumbs, groups, version, repository, toc = [], inspector, wide, children }: WindowProps) {
  return Row({
    gap: 'theme.layout.gutter',
    height: '100dvh',
    padding: 'theme.layout.gutter',
    overflow: 'hidden',
    css: {
      '@media (width < theme.breakpoint.compact)': { height: 'auto', padding: 0, gap: 0, overflow: 'visible' },
    },
    children: [
      SkipLink(),
      SidebarPane({
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        css: { '@media (width < theme.breakpoint.compact)': { display: 'none' } },
        children: [Div({ padding: 'theme.space.3 theme.space.3 0', children: BrandLink() }), SidebarNav({ groups })],
      }),
      SheetCard({
        children: [
          Toolbar({ crumbs, groups, version, repository }),
          // Tracks sized by the viewport alone, so the page's width never waits on what fills them: the
          // contents column keeps its track while empty.
          Grid({
            gridTemplateColumns: wide
              ? 'minmax(0, min(1200px, 100%))'
              : 'minmax(0, calc(theme.layout.prose + 2 * theme.layout.sheetPad))',
            justifyContent: 'center',
            alignItems: 'start',
            columnGap: 'theme.space.12',
            flexGrow: 1,
            padding: '0 theme.space.6',
            css: {
              '@media (width < theme.breakpoint.compact)': { padding: 0 },
              ...(wide
                ? {}
                : {
                    '@media (width >= theme.breakpoint.wide)': {
                      gridTemplateColumns:
                        'minmax(0, calc(theme.layout.prose + 2 * theme.layout.sheetPad)) theme.layout.inspector',
                    },
                  }),
            },
            children: [
              SheetPane({ tabIndex: -1, children: [children, SiteFooter({ wide })] }),
              wide ? null : Inspector({ toc, children: inspector }),
            ],
          }),
        ],
      }),
      Node(SheetScroll, { key: 'scroll' }),
    ],
  })
}
