import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { Node } from '@meonode/ui'
import { Prose } from '@/components/prose/Prose'
import { Window } from '@/components/shell/Window'
import { CURRENT_LINE } from '@/config/versions'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

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
        Node('h1', { key: 'title', children: 'Page not found' }),
        Node('div', {
          key: 'subtitle',
          'data-subtitle': true,
          children: 'The address may be from an older version of the docs, or the page has moved.',
        }),
        Node('p', {
          key: 'next',
          children: [
            'Search for what you were after, start from the ',
            Node('a', { key: 'docs', href: '/docs/latest', children: 'documentation' }),
            ', or go to the ',
            Node('a', { key: 'home', href: '/', children: 'home page' }),
            '.',
          ],
        }),
        Node('p', {
          key: 'search',
          children: Node('button', {
            type: 'button',
            'data-search-trigger': true,
            'data-action': true,
            children: 'Search the docs',
          }),
        }),
      ],
    }),
  }).render()
}

/** The page for any address the site does not have: the docs window, with ways back in. */
export default async function NotFound() {
  return notFoundPage()
}
