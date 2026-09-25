import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { A, Button, Div, H1, P } from '@meonode/ui'
import { Prose } from '@/components/nodes'
import { Window } from '@/components/shell/Window'
import { CURRENT_LINE } from '@/config/versions'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { pageMetadata } from '@/lib/docs/page-metadata'

export const metadata: Metadata = pageMetadata({
  title: 'Page not found',
  description: 'The address may be from an older version of the docs, or the page has moved.',
  index: false,
})

// Cached for the life of the build, like every page drawn from the repository's files.
async function notFoundPage() {
  'use cache'
  cacheLife('max')
  return Window({
    crumbs: [{ title: 'Not found' }],
    groups: sidebar(CURRENT_LINE),
    version: versionChoices(CURRENT_LINE),
    repository: REPOSITORY,
    children: Prose({
      children: [
        H1('Page not found', { key: 'title' }),
        Div({
          key: 'subtitle',
          'data-subtitle': true,
          children: 'The address may be from an older version of the docs, or the page has moved.',
        }),
        P(
          [
            'Search for what you were after, start from the ',
            A({ key: 'docs', href: '/docs/latest', children: 'documentation' }),
            ', or go to the ',
            A({ key: 'home', href: '/', children: 'home page' }),
            '.',
          ],
          { key: 'next' },
        ),
        P(Button('Search the docs', { type: 'button', 'data-search-trigger': true, 'data-action': true }), {
          key: 'search',
        }),
      ],
    }),
  }).render()
}

/** The page for any address the site does not have: the docs window, with ways back in. */
export default async function NotFound() {
  return notFoundPage()
}
