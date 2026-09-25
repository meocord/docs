import type { Metadata } from 'next'
import { A, Div, H1, P } from '@meonode/ui'
import { Window } from '@/components/shell/Window'
import { CURRENT_LINE, VERSIONS } from '@/config/versions'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { docsHref } from '@/lib/urls'

export const metadata: Metadata = { alternates: { canonical: '/' } }

/** A placeholder until the landing page is designed, drawn in the docs window with the current line's guides. */
export default function HomePage() {
  return Window({
    crumbs: [{ title: 'Overview' }],
    groups: sidebar(CURRENT_LINE),
    version: versionChoices(CURRENT_LINE),
    repository: REPOSITORY,
    children: Div({
      maxWidth: 'theme.layout.prose',
      padding: 'theme.layout.sheetPad',
      css: { '@media (width < theme.breakpoint.compact)': { padding: 'theme.layout.sheetPadCompact' } },
      children: [
        H1('MeoCord', {
          margin: '0 0 theme.space.4',
          fontSize: 'theme.type.h1.size',
          lineHeight: 'theme.type.h1.line',
          fontWeight: 'theme.font.weight.semibold',
          letterSpacing: 'theme.type.h1.track',
        }),
        P('Decorator-based Discord bots, with the pipeline you’d build yourself.', {
          margin: '0 0 theme.space.6',
          fontSize: 'theme.type.body.size',
          lineHeight: 'theme.type.body.line',
          color: 'theme.ink.secondary',
        }),
        Div({
          display: 'flex',
          gap: 'theme.space.4',
          children: [
            A({
              href: docsHref({ kind: 'line', line: CURRENT_LINE }, VERSIONS),
              color: 'theme.accent.default',
              children: 'Read the guides',
            }),
            A({ href: REPOSITORY, color: 'theme.ink.secondary', children: 'Source on GitHub' }),
          ],
        }),
      ],
    }),
  }).render()
}
