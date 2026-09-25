import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { Node } from '@meonode/ui'
import { HomeRows, NewSection, StartSection, TestingSection, WhySection } from '@/components/home/HomeSections'
import { PipelinePanel } from '@/components/home/PipelinePanel'
import { Prose } from '@/components/prose/Prose'
import { ReadingIsland } from '@/components/prose/ReadingIsland'
import { Window } from '@/components/shell/Window'
import { VERSIONS } from '@/config/versions'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { claims, HOME_LINE, pipelineDemo, specReport, whatsNew } from '@/lib/home/data'
import { docsHref } from '@/lib/urls'
import { resolveExample } from '../../scripts/lib/pages'

export const metadata: Metadata = { alternates: { canonical: '/' } }

const guide = (slug: string) => docsHref({ kind: 'guide', line: HOME_LINE, slug }, VERSIONS)

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function home() {
  'use cache'
  cacheLife('max')
  const status = VERSIONS.lines.find(entry => entry.line === HOME_LINE)?.status
  const report = specReport()

  return Window({
    crumbs: [{ title: 'Overview' }],
    // The home page is the line's overview, so the sidebar marks it.
    groups: sidebar(HOME_LINE, 'overview'),
    version: versionChoices(HOME_LINE),
    repository: REPOSITORY,
    wide: true,
    children: Prose({
      maxWidth: 'none',
      children: [
        Node('h1', { key: 'title', children: 'MeoCord' }),
        Node('div', {
          key: 'subtitle',
          'data-subtitle': true,
          children: [
            'Decorator-based Discord bots, with the pipeline you’d build yourself',
            `${HOME_LINE}${status === 'prerelease' ? ' beta' : ''}`,
            'for discord.js 14',
          ].join(' · '),
        }),
        PipelinePanel(pipelineDemo()),
        HomeRows({
          key: 'rows',
          children: [
            WhySection(claims()),
            StartSection(guide('quick-start')),
            TestingSection(
              {
                file: report.file,
                code: resolveExample(HOME_LINE, report.file.replace(/^src\//, ''), 'spec'),
                report: report.lines,
              },
              guide('testing'),
            ),
            NewSection(HOME_LINE, whatsNew(), guide('whats-new')),
          ],
        }),
        Node(ReadingIsland, { key: 'island' }),
      ],
    }),
  }).render()
}

/** The home page: the docs window, opened on MeoCord's pipeline running a real call. */
export default async function HomePage() {
  return home()
}
