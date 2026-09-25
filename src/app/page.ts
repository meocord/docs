import type { Metadata } from 'next'
import { A, Div, H1, P } from '@meonode/ui'
import { Window } from '@/components/shell/Window'
import { CURRENT_LINE, VERSIONS } from '@/config/versions'
import { versionOption, versionOptions } from '@/lib/version-options'

export const metadata: Metadata = { alternates: { canonical: '/' } }

const REPOSITORY = 'https://github.com/meocord/meocord'

/** A placeholder until the landing page is designed, drawn in the docs window. */
export default function HomePage() {
  return Window({
    crumbs: [{ title: 'Overview' }],
    groups: [{ title: 'Introduction', items: [{ title: 'Overview', href: '/', current: true }] }],
    version: { current: versionOption(CURRENT_LINE, VERSIONS), options: versionOptions(VERSIONS) },
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
        P('Decorator-based Discord bots on discord.js. The documentation is on its way.', {
          margin: '0 0 theme.space.4',
          fontSize: 'theme.type.body.size',
          lineHeight: 'theme.type.body.line',
          color: 'theme.ink.secondary',
        }),
        A({ href: REPOSITORY, color: 'theme.accent.default', children: 'Source on GitHub' }),
      ],
    }),
  }).render()
}
