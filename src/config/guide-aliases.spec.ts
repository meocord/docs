import { describe, expect, it } from 'vitest'
import { guideAliasRedirects } from '@/config/guide-aliases'

describe('guideAliasRedirects', () => {
  const page = (slug: string, id = slug, formerly: string[] = []) => ({ slug, id, formerly })
  // 4.0 holds the routing topic under another slug, and has no install-contexts page at all.
  const lines = [
    {
      line: '4.0',
      pages: [page('overview'), page('command-types'), page('command-parameters'), page('configuration')],
    },
  ]
  const guide = [
    { path: 'overview', id: 'overview', formerly: [] },
    { path: 'slash-commands', id: 'slash-commands', formerly: ['command-types'] },
    // Covers the topic 4.0 keeps under command-types, as slash-commands does
    { path: 'context-menus', id: 'context-menus', formerly: [], covers: ['4.0/command-types'] },
    { path: 'components', id: 'components', formerly: ['component-routing', 'command-parameters'] },
    { path: 'install-contexts', id: 'install-contexts', formerly: [] },
    // Covers a section of 4.0's configuration page
    { path: 'eslint', id: 'eslint', formerly: [], covers: ['4.0/configuration#eslint'] },
    { path: 'recipes/tickets', id: 'tickets', formerly: ['recipe-tickets'] },
  ]

  // The current line's pages at the URL the site uses for them, latest; a missing page keeps its line's number
  it("sends a Guide path to the line's page for the topic, found by id, or to the page saying another line has it", () => {
    expect(guideAliasRedirects(lines, '4.0', guide, '4.1')).toEqual([
      { source: '/docs/4.0/slash-commands', destination: '/docs/latest/command-types', permanent: false },
      { source: '/docs/latest/slash-commands', destination: '/docs/latest/command-types', permanent: false },
      { source: '/docs/4.0/context-menus', destination: '/docs/latest/command-types', permanent: false },
      { source: '/docs/latest/context-menus', destination: '/docs/latest/command-types', permanent: false },
      { source: '/docs/4.0/components', destination: '/docs/latest/command-parameters', permanent: false },
      { source: '/docs/latest/components', destination: '/docs/latest/command-parameters', permanent: false },
      { source: '/docs/4.0/install-contexts', destination: '/docs/4.0/missing/install-contexts', permanent: false },
      { source: '/docs/latest/install-contexts', destination: '/docs/4.0/missing/install-contexts', permanent: false },
      { source: '/docs/4.0/eslint', destination: '/docs/latest/configuration#eslint', permanent: false },
      { source: '/docs/latest/eslint', destination: '/docs/latest/configuration#eslint', permanent: false },
      { source: '/docs/4.0/recipes/tickets', destination: '/docs/4.0/missing/tickets', permanent: false },
      { source: '/docs/latest/recipes/tickets', destination: '/docs/4.0/missing/tickets', permanent: false },
    ])
  })

  it('leaves a page the line has at the path alone, and reaches a line that is not current by its own number only', () => {
    const redirects = guideAliasRedirects(lines, '4.1', guide, '4.1')
    expect(redirects.some(redirect => redirect.source.endsWith('/overview'))).toBe(false)
    expect(redirects.some(redirect => redirect.source.startsWith('/docs/latest/'))).toBe(false)
    expect(redirects.find(redirect => redirect.source === '/docs/4.0/slash-commands')?.destination).toBe(
      '/docs/4.0/command-types',
    )
    // Each one's destination depends on versions.json and the pages, so none is permanent
    expect(redirects.every(redirect => redirect.permanent === false)).toBe(true)
  })
})
