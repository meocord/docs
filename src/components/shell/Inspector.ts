import { A, For, H2, Li, Nav, Ul } from '@meonode/ui'
import type { Children } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'
import { InspectorPane } from '@/components/nodes'
import type { TocEntry } from '@/components/shell/types'

function TocList(entries: TocEntry[]) {
  return Nav({
    'aria-label': 'On this page',
    children: [
      H2('On this page', {
        margin: '0 0 theme.space.2',
        fontSize: 'theme.type.caption.size',
        fontWeight: 'theme.font.weight.semibold',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'theme.ink.secondary',
      }),
      Ul({
        margin: 0,
        padding: 0,
        listStyle: 'none',
        borderLeft: 'theme.line.width solid theme.line.hairline',
        children: For(
          entries,
          entry =>
            Li({
              children: A({
                href: `#${entry.id}`,
                'data-toc': entry.id,
                display: 'block',
                padding: 'theme.space.1 theme.space.3',
                paddingLeft: entry.depth === 3 ? 'theme.space.6' : 'theme.space.3',
                marginLeft: -1,
                borderLeft: '2px solid transparent',
                fontSize: 'theme.type.control.size',
                lineHeight: 'theme.type.control.line',
                color: 'theme.ink.secondary',
                textDecoration: 'none',
                css: {
                  ...focusCss,
                  '&:hover': { color: 'theme.ink.primary' },
                  '&[aria-current="location"]': { color: 'theme.ink.primary', borderLeftColor: 'theme.accent.default' },
                },
                children: entry.title,
              }),
            }),
          entry => entry.id,
        ),
      }),
    ],
  })
}

/** The right-hand column: the page's headings, then whatever facts the page adds. */
export function Inspector({ toc, children }: { toc: TocEntry[]; children?: Children }) {
  return InspectorPane({
    display: 'flex',
    flexDirection: 'column',
    gap: 'theme.space.8',
    children: [toc.length > 0 ? TocList(toc) : null, children ?? null],
  })
}
