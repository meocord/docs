import { describe, expect, it } from 'vitest'
import { renderGuide } from '@/lib/docs/render'
import { guidePage, lines, pageParams, readmeVersion, sidebar, versionChoices } from '@/lib/docs/site'

// These read the repository's real versions.json and pages: 4.0 is current, 4.1 in prerelease.
describe('the docs site data', () => {
  it('lists a page for every line and slug', () => {
    expect(lines()).toEqual(expect.arrayContaining(['4.0', '4.1']))
    const params = pageParams()
    expect(params).toContainEqual({ line: '4.0', slug: 'testing' })
    expect(params.filter(param => param.line === '4.1').length).toBeGreaterThan(0)
  })

  it('groups the sidebar by section, in order, marking the current page', () => {
    const groups = sidebar('4.0', 'guards')
    const items = groups.flatMap(group => group.items)
    expect(items.filter(item => item.current).map(item => item.title)).toEqual(['Guards'])
    expect(items.find(item => item.title === 'Guards')?.href).toBe('/docs/latest/guards')
    expect(sidebar('4.1').flatMap(group => group.items)[0].href).toMatch(/^\/docs\/4\.1\//)
    expect(groups.at(-1)).toEqual({
      title: 'Reference',
      items: [
        { title: 'Migrating', href: '/docs/latest/migrating', current: false },
        { title: 'Changelog', href: '/docs/latest/changelog', current: false },
      ],
    })
  })

  it('keeps the page when switching lines, and says so on a line without it', () => {
    const { current, options } = versionChoices('4.0', 'guards')
    expect(current).toMatchObject({ label: '4.0', href: '/docs/latest/guards' })
    expect(options.find(option => option.label === '4.1')?.href).toBe('/docs/4.1/guards')
    expect(versionChoices('4.0', 'no-such-page').options.find(option => option.label === '4.1')?.href).toBe(
      '/docs/4.1/missing/no-such-page',
    )
    expect(versionChoices('4.0').current.href).toBe('/docs/latest')
  })

  it('lowers a page with its breadcrumbs, headings and canonical URL', () => {
    const page = guidePage('4.0', 'testing')!
    expect(page.canonical).toBe('/docs/latest/testing')
    expect(page.crumbs.at(-1)).toEqual({ title: 'Testing' })
    expect(page.crumbs[0]).toEqual({ title: '4.0', href: '/docs/latest' })
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
