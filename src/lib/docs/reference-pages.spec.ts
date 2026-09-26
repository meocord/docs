import { describe, expect, it } from 'vitest'
import {
  changelogArticle,
  changelogParams,
  changelogSummary,
  lineChangelog,
  migratingArticle,
  missingArticle,
  missingParams,
  renderChangelog,
  renderMigrating,
  releaseArticle,
  renderMissing,
  renderRelease,
} from '@/lib/docs/reference-pages'

// These read the repository's generated changelogs, migration guides and pages.
describe('changelog', () => {
  it('reads a line newest first, each release dated by the registry', () => {
    const changelogs = lineChangelog('4.0')
    expect(changelogs.map(changelog => changelog.version).slice(0, 2)).toEqual(['4.0.0', '4.0.0-beta.5'])
    expect(changelogs.every(changelog => /^\d{4}-\d{2}-\d{2}$/.test(changelog.published ?? ''))).toBe(true)
  })

  it('gives the newest release in full and the earlier ones a line each, so the page stays one release long', () => {
    const [newest, ...earlier] = lineChangelog('4.0')
    const article = changelogArticle('4.0')!
    expect(article.toc).toEqual([
      { id: '4-0-0', title: '4.0.0', depth: 2 },
      { id: 'earlier-releases', title: 'Earlier releases', depth: 2 },
    ])
    type Raw = { rawProps?: Record<string, unknown> }
    const props = (node: unknown) => (node as Raw).rawProps ?? {}
    // Group headings and entry lists for the newest release only, then one list naming the others.
    const groups = article.nodes.filter(node => props(node)['data-group'])
    expect(groups.map(node => props(node).id)).toEqual(
      newest.sections.map(section => `4-0-0-${section.title.toLowerCase().replace(/ /g, '-')}`),
    )
    const releases = article.nodes.find(node => props(node)['data-releases'])
    const items = props(releases).children as Raw[]
    expect(items.map(item => item.rawProps?.key)).toEqual(earlier.map(changelog => changelog.version))
  })

  it('prerenders a page for every release of every line, each with its groups in the table of contents', () => {
    const params = changelogParams()
    expect(params).toContainEqual({ line: '4.1', version: '4.1.0-beta.0' })
    expect(params).toContainEqual({ line: '4.0', version: '4.0.0' })
    const article = releaseArticle('4.1', '4.1.0-beta.0')!
    expect(article.toc.map(entry => entry.id)).toEqual(['minor-changes', 'patch-changes'])
    expect(article.toc.every(entry => entry.depth === 2)).toBe(true)
    expect(releaseArticle('4.1', '4.0.0')).toBeUndefined()
    expect(renderRelease('4.1', '4.1.0-beta.0')).toBeDefined()
    expect(renderRelease('4.1', '9.9.9')).toBeUndefined()
  })

  it('sums a release up in one line: its groups counted, breaking entries called out', () => {
    const entry = (breaking = false) => ({ markdown: 'x', breaking })
    expect(
      changelogSummary({
        version: '4.1.0',
        sections: [
          { title: 'Minor Changes', entries: [entry(true), entry()] },
          { title: 'Patch Changes', entries: [entry()] },
        ],
      }),
    ).toBe('2 minor changes and 1 patch change, 1 breaking')
    expect(
      changelogSummary({
        version: '4.1.0',
        sections: [
          { title: 'Major Changes', entries: [entry(true)] },
          { title: 'Minor Changes', entries: [entry()] },
          { title: 'Patch Changes', entries: [entry(), entry()] },
        ],
      }),
    ).toBe('1 major change, 1 minor change and 2 patch changes, 1 breaking')
    expect(changelogSummary({ version: '4.1.0', sections: [] })).toBe('No changes recorded.')
  })

  it('has no page for a line without changelogs', () => {
    expect(changelogArticle('9.9')).toBeUndefined()
    expect(renderChangelog('9.9')).toBeUndefined()
    expect(renderChangelog('4.0')).toBeDefined()
  })
})

describe('migrating', () => {
  it('renders the guide the library ships, with its headings in the table of contents', () => {
    const article = migratingArticle('4.1')!
    expect(article.toc.length).toBeGreaterThan(0)
    expect(article.toc.every(entry => entry.depth === 2 || entry.depth === 3)).toBe(true)
    expect(migratingArticle('9.9')).toBeUndefined()
    expect(renderMigrating('4.1')).toBeDefined()
  })
})

describe('missing', () => {
  it('prerenders a page for each id a line lacks that another line has', () => {
    const params = missingParams()
    expect(params).toContainEqual({ line: '4.0', id: 'interceptors' })
    expect(params.some(param => param.line === '4.1' && param.id === 'interceptors')).toBe(false)
  })

  it('says where the page is documented, for a line without it', () => {
    const article = missingArticle('4.0', 'interceptors')!
    expect(article.title).toBe('Interceptors')
    expect(renderMissing('4.0', 'interceptors')).toBeDefined()
  })

  it('has no page for an id no line has, one the line has, or an unknown line', () => {
    expect(missingArticle('4.0', 'no-such-page')).toBeUndefined()
    expect(missingArticle('4.1', 'interceptors')).toBeUndefined()
    expect(missingArticle('9.9', 'interceptors')).toBeUndefined()
    expect(renderMissing('4.0', 'no-such-page')).toBeUndefined()
  })
})
