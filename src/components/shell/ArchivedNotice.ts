import { A, Aside, Div, Strong } from '@meonode/ui'
import { safe } from '@/lib/design/css'
import type { VersionOption } from '@/components/shell/types'

const link = { color: 'inherit', fontWeight: 'theme.font.weight.semibold', textDecoration: 'underline' }

/**
 * Says, above a page of an archived line, that the line gets no more fixes, security fixes included, and links the
 * same page in the latest line and the latest line's upgrade guide. Lines are archived once a newer one ships.
 */
export function ArchivedNotice({ line, latest, upgrade }: { line: string; latest: VersionOption; upgrade: string }) {
  return Div({
    key: 'archived',
    maxWidth: 'calc(theme.layout.prose + 2 * theme.layout.sheetPad)',
    padding: 'theme.layout.sheetPad theme.layout.sheetPad 0',
    css: {
      '@media (width < theme.breakpoint.compact)': {
        padding: 'theme.layout.sheetPadCompact theme.layout.sheetPadCompact 0',
        paddingLeft: safe('theme.layout.sheetPadCompact', 'left'),
        paddingRight: safe('theme.layout.sheetPadCompact', 'right'),
      },
    },
    children: Aside({
      'aria-label': `MeoCord ${line} is no longer supported`,
      'data-archived-notice': true,
      padding: 'theme.space.3 theme.space.4',
      borderRadius: 'theme.radius.callout',
      backgroundColor: 'theme.callout.danger.fill',
      fontSize: 'theme.type.small.size',
      lineHeight: 'theme.type.small.line',
      color: 'theme.ink.primary',
      children: [
        Strong(`MeoCord ${line} is no longer supported.`, { key: 'title', color: 'theme.callout.danger.glyph' }),
        ` It gets no more fixes, security fixes included. `,
        A({ key: 'latest', href: latest.href, css: link, children: `Read this page for ${latest.label}` }),
        ', or follow the ',
        A({ key: 'upgrade', href: upgrade, css: link, children: 'upgrade guide' }),
        '.',
      ],
    }),
  })
}
