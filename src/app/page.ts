import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { Div, H1, Node, Span } from '@meonode/ui'
import { BuildSection, DoorsSection, WhySection } from '@/components/home/HomeSections'
import { HomeRows, Prose } from '@/components/nodes'
import { PipelinePanel } from '@/components/home/PipelinePanel'

import { ReadingIsland } from '@/components/prose/ReadingIsland'
import { Window } from '@/components/shell/Window'
import { HOME_LINE } from '@/config/home'
import { SITE_DESCRIPTION, SITE_HEADLINE, SITE_TAGLINE } from '@/config/site'
import { specFor, VERSIONS } from '@/config/versions'
import { REPOSITORY } from '@/lib/docs/render'
import { guideTabs } from '@/lib/docs/guide-site'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { buildKinds, claims, doors, pipelineDemo } from '@/lib/home/data'
import { framework, website } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/docs/page-metadata'

export const metadata: Metadata = pageMetadata({
  tagline: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  canonical: '/',
})

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function home() {
  'use cache'
  cacheLife('max')
  const status = VERSIONS.lines.find(entry => entry.line === HOME_LINE)?.status

  return Window({
    crumbs: [{ title: 'Overview' }],
    structuredData: [website(SITE_DESCRIPTION), framework(SITE_DESCRIPTION, REPOSITORY)],
    // The home page is the line's overview, so the sidebar marks it.
    groups: sidebar(HOME_LINE, 'overview'),
    // The home is the Guide's first page, under the same tabs
    tabs: guideTabs(HOME_LINE, 'guide'),
    version: versionChoices(HOME_LINE),
    repository: REPOSITORY,
    wide: true,
    children: Prose({
      maxWidth: 'none',
      children: [
        // The brand, then what it is: one heading, so search engines read both, drawn as the title and its subtitle
        H1(['MeoCord', ' ', Span(SITE_HEADLINE, { key: 'headline', 'data-headline': true })], { key: 'title' }),
        Div({
          key: 'subtitle',
          'data-subtitle': true,
          children: [
            'With the pipeline you’d build yourself',
            `${HOME_LINE}${status === 'prerelease' ? ' beta' : ''}`,
            'for discord.js 14',
          ].join(' · '),
        }),
        PipelinePanel(pipelineDemo()),
        HomeRows({
          key: 'rows',
          children: [BuildSection(buildKinds()), WhySection(claims()), DoorsSection(doors(), specFor(HOME_LINE))],
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
