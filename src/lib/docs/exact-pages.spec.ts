import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { apiArticle, exactApiPage, type ExactApiPage } from '@/lib/docs/api-render'
import { exactApiParams, lineVersions, versionRange } from '@/lib/docs/api-site'
import {
  checkExactRoutes,
  exactApiGroup,
  exactApiGroups,
  exactApiPageParams,
  exactApiRoutes,
  pageKey,
} from '@/lib/docs/exact-pages'
import { EXACT_ROUTES_FILE, exactRewrite, readExactRoutes } from '@/lib/docs/exact-routes'

const groups = exactApiGroups()
const pageOf = (line: string, version: string, section: string, symbol: string) =>
  exactApiPage(line, version, section, symbol)!
const pathOf = (line: string, version: string, section: string, symbol: string) =>
  `/docs/${line}/api/${version}/${section}/${symbol}`
// A group whose page several versions share, and one with signatures and a member, to change each input of
const shared = groups.find(group => group.versions.length > 1 && group.symbol === 'MeoCordFactory')!
const sharedPage = pageOf(shared.line, shared.versions[0]!, shared.section, shared.symbol)

/** A page's article and sidebar, as markup. */
const markupOf = (page: ExactApiPage) =>
  renderToStaticMarkup(
    Div({ children: [...apiArticle(page.symbol, page.layouts).nodes, SidebarNav({ groups: page.sidebar })] }).render(),
  )

/** Every href a page renders: its article's and its sidebar's. */
const hrefsOf = (page: ExactApiPage) =>
  [...markupOf(page).matchAll(/href="([^"]*)"/g)].map(match => match[1]!.replaceAll('&amp;', '&'))

/** A page with its `since` values taken out, which name the version a symbol first shipped in. */
const withoutSince = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(withoutSince)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== 'since')
            .map(([key, each]) => [key, withoutSince(each)]),
        )
      : value

// Each walks every exact version's page of every line
const WALK_TIMEOUT_MS = 60_000

describe('exact-version pages', { timeout: WALK_TIMEOUT_MS }, () => {
  it('gives the versions of a group one page, and the groups of a symbol pages that differ', () => {
    const keysBySymbol = new Map<string, string[]>()
    for (const group of groups) {
      const keys = new Set(
        group.versions.map(version => pageKey(pageOf(group.line, version, group.section, group.symbol))),
      )
      expect(keys.size, `${group.line} ${group.section}/${group.symbol}`).toBe(1)
      const symbol = `${group.line}/${group.section}/${group.symbol}`
      keysBySymbol.set(symbol, [...(keysBySymbol.get(symbol) ?? []), ...keys])
    }
    for (const [symbol, keys] of keysBySymbol) expect(new Set(keys).size, symbol).toBe(keys.length)
    // Every exact version's page is in one group, and some groups serve several versions
    expect(groups.reduce((count, group) => count + group.versions.length, 0)).toBe(exactApiParams().length)
    expect(groups.length).toBeLessThan(exactApiParams().length)
  })

  it('keeps two versions apart when any part of their pages differs, a part added later included', () => {
    const changed: Record<string, ExactApiPage> = {
      symbol: {
        ...sharedPage,
        symbol: { ...sharedPage.symbol, description: `${sharedPage.symbol.description} More.` },
      },
      since: { ...sharedPage, symbol: { ...sharedPage.symbol, since: `${sharedPage.symbol.since ?? ''}.1` } },
      sidebar: {
        ...sharedPage,
        sidebar: sharedPage.sidebar.map(group => ({ ...group, items: group.items.filter(item => !item.current) })),
      },
      layouts: {
        ...sharedPage,
        layouts: { ...sharedPage.layouts, 'declaration\0class MeoCordFactory': 'class MeoCordFactory {}' },
      },
      crumbs: { ...sharedPage, crumbs: sharedPage.crumbs.slice(1) },
      description: { ...sharedPage, description: 'Another description.' },
      'a part added later': { ...sharedPage, unlisted: true } as ExactApiPage,
    }
    for (const [part, page] of Object.entries(changed)) expect(pageKey(page), part).not.toBe(pageKey(sharedPage))
  })

  it("names no version in a page outside a since value, so a version's own links don't keep it apart", () => {
    const named: string[] = []
    for (const { line, version, section, symbol } of exactApiParams()) {
      const text = JSON.stringify(withoutSince(pageOf(line, version, section, symbol)))
      const own = new RegExp(`(?<![\\w.-])${version.replaceAll('.', '\\.')}(?![\\w.-])`)
      if (own.test(text)) named.push(pathOf(line, version, section, symbol))
    }
    expect(named).toEqual([])
  })

  it('links each version of a shared page to its own pages, the sidebar marking the page itself', () => {
    const hrefs = hrefsOf(sharedPage)
    // No link names a version; one to the version's pages is relative to it
    expect(hrefs.filter(href => /\/api\/\d+\.\d+\.\d+/.test(href))).toEqual([])
    const relative = hrefs.filter(href => href.startsWith('../'))
    expect(relative.length).toBeGreaterThan(0)
    // A type in its signature among them, which e2e/exact-pages.spec.ts follows
    expect(markupOf(sharedPage)).toMatch(/data-signature[^>]*>.*?<a href="\.\.\//s)
    for (const version of shared.versions) {
      const page = new URL(pathOf(shared.line, version, shared.section, shared.symbol), 'https://docs.test')
      for (const href of relative) {
        const target = new URL(href, page)
        const [, , , , , section, symbol] = target.pathname.split('/')
        expect(target.pathname.startsWith(`/docs/${shared.line}/api/${version}/`), href).toBe(true)
        // A symbol's page or the CLI's, which the line's by-kind sidebar lists too
        if (section !== 'cli') expect(exactApiGroup(shared.line, version, section!, symbol!), href).toBeDefined()
      }
    }
    const current = sharedPage.sidebar.flatMap(group => group.items).filter(item => item.current)
    expect(current.map(item => item.href)).toEqual([`../${shared.section}/${shared.symbol}`])
  })

  it('names the versions a page serves: a run of them as a range, others each', () => {
    const versions = lineVersions('4.1').reverse()
    expect(versionRange('4.1', [versions[4]!])).toBe(versions[4])
    expect(versionRange('4.1', [versions[6]!, versions[4]!, versions[5]!])).toBe(`${versions[4]} to ${versions[6]}`)
    expect(versionRange('4.1', [versions[6]!, versions[4]!])).toBe(`${versions[4]}, ${versions[6]}`)
  })
})

describe('the routes to shared pages', { timeout: WALK_TIMEOUT_MS }, () => {
  it('prerenders the first version of each group and routes every other version to it', () => {
    const routes = exactApiRoutes()
    const prerendered = new Set(
      exactApiPageParams().map(({ line, version, section, symbol }) => pathOf(line, version, section, symbol)),
    )
    let routed = 0
    for (const { line, version, section, symbol } of exactApiParams()) {
      const own = pathOf(line, version, section, symbol)
      const served = exactRewrite(own, routes, line)
      // Served by its own page, or by a prerendered page of its group's first version
      if (prerendered.has(own)) expect(served, own).toBeUndefined()
      else {
        routed += 1
        expect(served, own).toBe(
          pathOf(line, exactApiGroup(line, version, section, symbol)!.versions[0]!, section, symbol),
        )
        expect(prerendered.has(served!), own).toBe(true)
      }
    }
    expect(prerendered.size + routed).toBe(exactApiParams().length)
  })

  it('reads the routes the build wrote, which a production build needs and dev does without', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'exact-routes-'))
    expect(() => readExactRoutes(true, root)).toThrow('run `bun run api:routes`')
    expect(readExactRoutes(false, root)).toBe('{}')
    writeFileSync(path.join(root, EXACT_ROUTES_FILE), '{"4.2":{"versions":[],"servedBy":{}}}\n')
    expect(readExactRoutes(true, root)).toBe('{"4.2":{"versions":[],"servedBy":{}}}')
  })

  it('fails a production build whose routes are not its pages', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'exact-routes-'))
    writeFileSync(path.join(root, EXACT_ROUTES_FILE), `${JSON.stringify(exactApiRoutes())}\n`)
    expect(() => checkExactRoutes(true, root)).not.toThrow()
    const stale = mkdtempSync(path.join(tmpdir(), 'exact-routes-'))
    writeFileSync(path.join(stale, EXACT_ROUTES_FILE), '{}')
    expect(() => checkExactRoutes(true, stale)).toThrow('run `bun run api:routes`')
    expect(() => checkExactRoutes(false, stale)).not.toThrow()
  })

  it("finds the page an exact version's URL is served by, its line by number or as latest", () => {
    const routes = { '4.2': { versions: ['4.2.0', '4.2.1', '4.2.2'], servedBy: { 'core/X': [-1, 1, 1] } } }
    expect(exactRewrite('/docs/4.2/api/4.2.2/core/X', routes, '4.2')).toBe('/docs/4.2/api/4.2.1/core/X')
    expect(exactRewrite('/docs/latest/api/4.2.2/core/X', routes, '4.2')).toBe('/docs/4.2/api/4.2.1/core/X')
    // Its own page, a version without the symbol, an unknown symbol, version or line, and other paths
    for (const other of [
      '/docs/4.2/api/4.2.1/core/X',
      '/docs/4.2/api/4.2.0/core/X',
      '/docs/4.2/api/4.2.2/core/Y',
      '/docs/4.2/api/4.2.9/core/X',
      '/docs/4.9/api/4.9.0/core/X',
      '/docs/4.2/api/core/X',
      '/docs/4.2/api/4.2.2/cli',
      '/docs/latest/guards',
    ]) {
      expect(exactRewrite(other, routes, '4.2'), other).toBeUndefined()
    }
  })
})
