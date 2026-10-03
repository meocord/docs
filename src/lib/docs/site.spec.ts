import { describe, expect, it } from 'vitest'
import { renderGuide } from '@/lib/docs/render'
import { VERSIONS } from '@/config/versions'
import {
  elsewhereHref,
  guidePage,
  linePageWithId,
  lines,
  pageParams,
  readmeVersion,
  sidebar,
  versionChoices,
} from '@/lib/docs/site'
import { docsHref, lineSegment } from '@/lib/urls'

// Each line's path segment as versions.json gives it: `latest` for the current line
const docs41 = `/docs/${lineSegment('4.1', VERSIONS)}`
const docs40 = `/docs/${lineSegment('4.0', VERSIONS)}`

// These read the repository's real versions.json and pages: 4.0 is current, 4.1 in prerelease.
describe('the docs site data', () => {
  it('lists a page for every line and slug', () => {
    expect(lines()).toEqual(expect.arrayContaining(['4.0', '4.1']))
    const params = pageParams()
    expect(params).toContainEqual({ line: '4.0', slug: ['testing'] })
    expect(params.filter(param => param.line === '4.1').length).toBeGreaterThan(0)
  })

  it('groups the sidebar by section, in order, marking the current page', () => {
    const groups = sidebar('4.0', 'guards')
    const items = groups.flatMap(group => group.items)
    expect(items.filter(item => item.current).map(item => item.title)).toEqual(['Guards'])
    expect(items.find(item => item.title === 'Guards')?.href).toBe(`${docs40}/guards`)
    expect(sidebar('4.1').flatMap(group => group.items)[0].href).toMatch(
      new RegExp(`^${docs41.replaceAll('.', '\\.')}/`),
    )
    // A Guide line marks the page read, by its path, a recipe's under its group
    const marked = (path: string) =>
      sidebar('4.1', path)
        .flatMap(group => group.items)
        .filter(item => item.current)
        .map(item => item.href)
    expect(marked('defer')).toEqual([`${docs41}/defer`])
    expect(marked('overview')).toEqual([`${docs41}/overview`])
    expect(marked('recipes/tickets')).toEqual([`${docs41}/recipes/tickets`])
    // Every group carries a glyph; a section without its own gets the book.
    expect(groups.every(group => group.icon)).toBe(true)
    expect(groups.at(-1)).toEqual({
      title: 'Reference',
      icon: 'reference',
      items: [
        { title: 'Migrating', href: `${docs40}/migrating`, current: false },
        { title: 'Changelog', href: `${docs40}/changelog`, current: false },
      ],
    })
  })

  it('keeps the page when switching lines, and says so on a line without it', () => {
    const page = (id: string, formerly: string[] = []) => ({ page: { id, formerly }, line: '4.0' })
    const { current, options } = versionChoices('4.0', page('guards'))
    expect(current).toMatchObject({ label: '4.0', href: `${docs40}/guards` })
    expect(options.find(option => option.label === '4.1')?.href).toBe(`${docs41}/guards`)
    expect(versionChoices('4.0', page('no-such-page')).options.find(option => option.label === '4.1')?.href).toBe(
      '/docs/4.1/missing/no-such-page',
    )
    expect(versionChoices('4.0').current.href).toBe(docs40)
  })

  it("finds a line's page on the same topic by the ids a Guide page covers, both ways", () => {
    const to = (line: string, from: string, id: string) =>
      versionChoices(from, { page: linePageWithId(from, id)!, line: from }).options.find(
        option => option.label === line,
      )?.href
    expect(to('4.0', '4.1', 'slash-commands')).toBe(`${docs40}/command-types`)
    expect(to('4.0', '4.1', 'context-menus')).toBe(`${docs40}/command-types`)
    expect(to('4.0', '4.1', 'components')).toBe(`${docs40}/command-parameters`)
    expect(to('4.0', '4.1', 'cli')).toBe(`${docs40}/cli-reference`)
    expect(to('4.0', '4.1', 'testing-recipes')).toBe(`${docs40}/testing`)
    // Where several pages cover one id, the first in reading order is the one
    expect(to('4.1', '4.0', 'command-types')).toBe(`${docs41}/slash-commands`)
    expect(to('4.0', '4.1', 'services')).toBe('/docs/4.0/missing/services')
    // A page covering a section lands on it
    expect(to('4.0', '4.1', 'eslint')).toBe(`${docs40}/configuration#eslint`)
  })

  it('lowers a page with its breadcrumbs, headings and canonical URL', () => {
    const page = guidePage('4.0', 'testing')!
    expect(page.canonical).toBe(`${docs40}/testing`)
    expect(page.crumbs.at(-1)).toEqual({ title: 'Testing' })
    expect(page.crumbs[0]).toEqual({ title: '4.0', href: docs40 })
    expect(page.toc.length).toBeGreaterThan(0)
    expect(page.toc.every(entry => entry.depth === 2 || entry.depth === 3)).toBe(true)
    expect(readmeVersion(page.entry)).toMatch(/^4\.0\./)
    expect(guidePage('4.0', 'no-such-page')).toBeUndefined()
  })

  it('reads no README version from a page written for the site', () => {
    expect(readmeVersion({ id: 'x', slug: 'x', title: 'X', order: 1, formerly: [] })).toBeUndefined()
  })

  // The rendered window is covered end to end in e2e/docs.spec.ts, under Next's client boundary.
  it('renders a guide, and nothing for a missing page', () => {
    expect(renderGuide('4.0', 'testing')).toBeDefined()
    expect(renderGuide('4.0', 'no-such-page')).toBeUndefined()
  })
})

describe('elsewhereHref', () => {
  // 4.1 lacks these 4.0 paths, which latest URLs reached while 4.0 was current
  it("sends another line's path to this line's page on its topic", () => {
    expect(elsewhereHref('4.1', 'features')).toBe(docsHref({ kind: 'guide', line: '4.1', slug: 'overview' }, VERSIONS))
    expect(elsewhereHref('4.1', 'cli-reference')).toBe(docsHref({ kind: 'guide', line: '4.1', slug: 'cli' }, VERSIONS))
  })

  it('leaves a path no other line has a page at', () => {
    expect(elsewhereHref('4.1', 'no-such-page')).toBeUndefined()
    expect(elsewhereHref('4.0', 'no-such-page')).toBeUndefined()
  })
})
