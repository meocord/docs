import { A, Div, Footer, Grid, Node, Row, Script } from '@meonode/ui'
import type { Children } from '@meonode/ui'
import { BrandLink } from '@/components/shell/brand'
import { safe } from '@/lib/design/css'
import { Inspector } from '@/components/shell/Inspector'
import { CreditLink, SheetBody, SheetCard, SheetPane, SidebarBody } from '@/components/nodes'
import { SidebarPane } from '@/components/shell/panes'
import { SheetScroll } from '@/components/shell/SheetScroll'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { SidebarScroll } from '@/components/shell/SidebarScroll'
import { Toolbar, type ToolbarProps } from '@/components/shell/Toolbar'
import type { NavGroup, NavTab, TocEntry } from '@/components/shell/types'
import { SHELL_IDS } from '@/lib/page-ids'
import { breadcrumbList, jsonLd, type StructuredData } from '@/lib/seo/structured-data'
import { ArchivedNotice } from '@/components/shell/ArchivedNotice'
import { CURRENT_LINE, VERSIONS } from '@/config/versions'
import { docsHref } from '@/lib/urls'

export interface WindowProps extends Omit<ToolbarProps, 'sidebar'> {
  /**
   * The sidebar's links, grouped. Without them the window has no sidebar, as the not-found page, which
   * every page's data carries, draws it.
   */
  groups?: NavGroup[]
  /** Top-level tabs above the sidebar's groups, such as Guide and API. */
  tabs?: NavTab[]
  toc?: TocEntry[]
  /** Facts for the inspector under the headings, such as the edit link. */
  inspector?: Children
  /** A page wider than the prose measure, such as the home page, with no contents column. */
  wide?: boolean
  /** What search engines read about the page beside its crumbs' trail, such as a Guide page as an article. */
  structuredData?: StructuredData[]
  children: Children
}

/** The foot of every page: the credits for what the site is built and drawn with. */
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
      'Built with ',
      CreditLink({ key: 'meonode-ui', href: 'https://ui.meonode.com/', children: '@meonode/ui' }),
      '. Images drawn with ',
      CreditLink({ key: 'meo-canvas', href: 'https://github.com/l7aromeo/meo-canvas', children: 'meo-canvas' }),
      '.',
    ],
  })
}

/** Hidden until focused, then the first thing on the page. */
function SkipLink() {
  return A({
    href: `#${SHELL_IDS.main}`,
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
export function Window({
  crumbs,
  groups,
  tabs,
  version,
  repository,
  toc = [],
  inspector,
  wide,
  structuredData = [],
  children,
}: WindowProps) {
  const described = [breadcrumbList(crumbs), ...structuredData].filter((data): data is StructuredData => !!data)
  // A page of an archived line says so first, and where the supported one is
  const latest = version?.options.find(option => option.status === 'latest')
  const notice =
    version?.current.status === 'archived' && latest
      ? ArchivedNotice({
          line: version.current.label,
          latest,
          upgrade: docsHref({ kind: 'migrating', line: CURRENT_LINE }, VERSIONS),
        })
      : null
  // A window without a sidebar has no inspector either, so its one column sits in the middle of the sheet
  const inspected = !wide && Boolean(groups)
  return Row({
    gap: 'theme.layout.gutter',
    height: '100dvh',
    padding: 'theme.layout.gutter',
    overflow: 'hidden',
    css: {
      '@media (width < theme.breakpoint.compact)': { height: 'auto', padding: 0, gap: 0, overflow: 'visible' },
      // On paper the page runs its full length: no panes, no chrome, nothing clipped to a screen.
      '@media print': {
        height: 'auto',
        padding: 0,
        overflow: 'visible',
        '& [data-sidebar], & [data-toolbar], & [data-inspector]': { display: 'none' },
        // The sheet and its body.
        '& [data-sheet], & :has(> [data-sheet])': {
          height: 'auto',
          overflow: 'visible',
          boxShadow: 'none',
        },
      },
    },
    children: [
      SkipLink(),
      described.length > 0 &&
        Script({
          key: 'structured-data',
          type: 'application/ld+json',
          dangerouslySetInnerHTML: { __html: jsonLd(described) },
        }),
      groups &&
        SidebarPane({
          flexShrink: 0,
          css: { '@media (width < theme.breakpoint.compact)': { display: 'none' } },
          children: [
            Div({ key: 'header', flexShrink: 0, padding: 'theme.space.3 theme.space.3 0', children: BrandLink() }),
            SidebarBody({
              key: 'body',
              children: [SidebarNav({ groups, tabs }), Node(SidebarScroll, { key: 'scroll' })],
            }),
          ],
        }),
      SheetCard({
        children: [
          Toolbar({ crumbs, version, repository, sidebar: Boolean(groups) }),
          SheetBody({
            key: 'body',
            children:
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
                  ...(!inspected
                    ? {}
                    : {
                        '@media (width >= theme.breakpoint.wide)': {
                          gridTemplateColumns:
                            'minmax(0, calc(theme.layout.prose + 2 * theme.layout.sheetPad)) theme.layout.inspector',
                        },
                      }),
                },
                children: [
                  SheetPane({ tabIndex: -1, children: [notice, children, SiteFooter({ wide })] }),
                  inspected ? Inspector({ toc, children: inspector }) : null,
                ],
              }),
          }),
        ],
      }),
      Node(SheetScroll, { key: 'scroll' }),
    ],
  })
}
