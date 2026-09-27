import { describe, expect, it } from 'vitest'
import { listPages } from '../../scripts/lib/pages'
import { GUIDE_ALIASES, guideAliasRedirects } from '@/config/guide-aliases'
import manifest from '../../versions.json'

describe('guideAliasRedirects', () => {
  const lines = [
    { line: '4.0', ids: ['overview', 'command-types'] },
    { line: '4.1', ids: ['overview', 'command-types', 'component-routing', 'reactions'] },
  ]
  const aliases = { 'slash-commands': 'command-types', components: 'component-routing', reactions: 'x', gone: 'y' }

  it('sends a slug to the page holding its topic, or to the page saying another line has it', () => {
    expect(guideAliasRedirects(lines, '4.0', aliases)).toEqual([
      { source: '/docs/4.0/slash-commands', destination: '/docs/4.0/command-types', permanent: false },
      { source: '/docs/latest/slash-commands', destination: '/docs/4.0/command-types', permanent: false },
      { source: '/docs/4.0/components', destination: '/docs/4.0/missing/component-routing', permanent: false },
      { source: '/docs/latest/components', destination: '/docs/4.0/missing/component-routing', permanent: false },
      { source: '/docs/4.1/slash-commands', destination: '/docs/4.1/command-types', permanent: false },
      { source: '/docs/4.1/components', destination: '/docs/4.1/component-routing', permanent: false },
    ])
  })

  it("leaves a line's own page at the slug alone, and a target no line has", () => {
    const redirects = guideAliasRedirects(lines, '4.0', aliases)
    expect(redirects.some(redirect => redirect.source.endsWith('/reactions'))).toBe(false)
    expect(redirects.some(redirect => redirect.source.endsWith('/gone'))).toBe(false)
  })

  it("points every row at a page of the site's newest authored line", () => {
    const newest = manifest.lines.find(entry => entry.guides === 'authored')!.line
    const ids = new Set(listPages(newest).map(page => page.slug))
    expect(Object.values(GUIDE_ALIASES).filter(id => !ids.has(id))).toEqual([])
    expect(Object.keys(GUIDE_ALIASES).filter(slug => ids.has(slug))).toEqual([])
  })
})
