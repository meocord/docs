import { describe, expect, it } from 'vitest'
import { GUIDE_PLAN } from '../../scripts/lib/guide'
import { listPages } from '../../scripts/lib/pages'
import { GUIDE_ALIASES, guideAliasRedirects } from '@/config/guide-aliases'
import manifest from '../../versions.json'

describe('guideAliasRedirects', () => {
  const page = (slug: string, id = slug, formerly: string[] = []) => ({ slug, id, formerly })
  const lines = [
    // 4.0 holds the routing topic under another slug, and has no install-contexts page at all.
    { line: '4.0', pages: [page('overview'), page('command-types'), page('command-parameters')] },
    {
      line: '4.1',
      pages: [
        page('overview'),
        page('command-types'),
        page('component-routing', 'command-parameters'),
        page('install-contexts'),
        page('reactions'),
      ],
    },
  ]
  const aliases = {
    'slash-commands': 'command-types',
    components: 'component-routing',
    places: 'install-contexts',
    reactions: 'install-contexts',
    gone: 'nowhere',
  }

  it("sends a slug to each line's page for the topic, found by id, or to the page saying another line has it", () => {
    expect(guideAliasRedirects(lines, '4.0', '4.1', aliases)).toEqual([
      { source: '/docs/4.0/slash-commands', destination: '/docs/4.0/command-types', permanent: false },
      { source: '/docs/latest/slash-commands', destination: '/docs/4.0/command-types', permanent: false },
      { source: '/docs/4.0/components', destination: '/docs/4.0/command-parameters', permanent: false },
      { source: '/docs/latest/components', destination: '/docs/4.0/command-parameters', permanent: false },
      { source: '/docs/4.0/places', destination: '/docs/4.0/missing/install-contexts', permanent: false },
      { source: '/docs/latest/places', destination: '/docs/4.0/missing/install-contexts', permanent: false },
      { source: '/docs/4.0/reactions', destination: '/docs/4.0/missing/install-contexts', permanent: false },
      { source: '/docs/latest/reactions', destination: '/docs/4.0/missing/install-contexts', permanent: false },
      { source: '/docs/4.1/slash-commands', destination: '/docs/4.1/command-types', permanent: false },
      { source: '/docs/4.1/components', destination: '/docs/4.1/component-routing', permanent: false },
      { source: '/docs/4.1/places', destination: '/docs/4.1/install-contexts', permanent: false },
    ])
  })

  it('leaves a line whose Guide is rendered without aliases, since the Guide serves those slugs', () => {
    const guided = lines.map(entry => ({ ...entry, guide: entry.line === '4.1' }))
    const redirects = guideAliasRedirects(guided, '4.0', '4.1', aliases)
    expect(redirects.some(redirect => redirect.source.startsWith('/docs/4.1/'))).toBe(false)
    // Another line keeps its own: 4.0 still finds its page for the topic.
    expect(redirects).toContainEqual({
      source: '/docs/4.0/components',
      destination: '/docs/4.0/command-parameters',
      permanent: false,
    })
  })

  it("leaves a line's own page at the slug alone, and a target the line the aliases name lacks", () => {
    const redirects = guideAliasRedirects(lines, '4.0', '4.1', aliases)
    expect(redirects.some(redirect => redirect.source === '/docs/4.1/reactions')).toBe(false)
    expect(redirects.some(redirect => redirect.source.endsWith('/gone'))).toBe(false)
  })

  it("points every row at a page of the site's newest authored line", () => {
    const newest = manifest.lines.find(entry => entry.guides === 'authored')!.line
    const ids = new Set(listPages(newest).map(page => page.slug))
    expect(Object.values(GUIDE_ALIASES).filter(id => !ids.has(id))).toEqual([])
    expect(Object.keys(GUIDE_ALIASES).filter(slug => ids.has(slug))).toEqual([])
  })

  it("aliases only slugs of the Guide's plan, its one list of slugs", () => {
    const planned = new Set(Object.values(GUIDE_PLAN).flat())
    expect(Object.keys(GUIDE_ALIASES).filter(slug => !planned.has(slug))).toEqual([])
  })
})
