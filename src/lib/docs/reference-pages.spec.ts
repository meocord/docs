import { describe, expect, it } from 'vitest'
import {
  changelogArticle,
  lineChangelog,
  migratingArticle,
  missingArticle,
  missingParams,
  renderChangelog,
  renderMigrating,
  renderMissing,
} from '@/lib/docs/reference-pages'

// These read the repository's generated changelogs, migration guides and pages.
describe('changelog', () => {
  it('lists the versions of a line newest first, each at its v<version> anchor', () => {
    expect(
      lineChangelog('4.0')
        .map(changelog => changelog.version)
        .slice(0, 2),
    ).toEqual(['4.0.0', '4.0.0-beta.5'])
    const article = changelogArticle('4.0')!
    expect(article.toc[0]).toEqual({ id: 'v4.0.0', title: '4.0.0', depth: 2 })
    expect(article.toc.every(entry => entry.id === `v${entry.title}`)).toBe(true)
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
