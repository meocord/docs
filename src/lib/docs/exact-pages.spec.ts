import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { apiArticle, apiVersions, exactApiPage, exactSidebar, type ExactApiPage } from '@/lib/docs/api-render'
import { guideEnabled, guideTabs } from '@/lib/docs/guide-site'
import { exactApiParams, lineVersions, versionRange } from '@/lib/docs/api-site'
import { exactApiGroups, exactApiRoutes, exactRoutesMismatch, pageKey } from '@/lib/docs/exact-pages'
import {
  EXACT_ROUTES_FILE,
  exactRewrite,
  readExactRoutes,
  servedPages,
  sharedVersions,
  type ExactRoutes,
} from '@/lib/docs/exact-routes'

const groups = exactApiGroups()
const pageOf = (line: string, version: string, section: string, symbol: string) =>
  exactApiPage(line, version, section, symbol)!
const pathOf = (line: string, version: string, section: string, symbol: string) =>
  `/docs/${line}/api/${version}/${section}/${symbol}`
// A group whose page several versions share, and one with signatures and a member, to change each input of
const shared = groups.find(group => group.versions.length > 1 && group.symbol === 'MeoCordFactory')!
const sharedPage = pageOf(shared.line, shared.versions[0]!, shared.section, shared.symbol)

// A link to the version's own pages inside a signature's code, as e2e/exact-pages.spec.ts looks for one
const SIGNATURE_LINK = /<pre data-signature="true"[^>]*><code>(?:(?!<\/code>)[\s\S])*<a href="\.\.\//
/** A page's article and sidebar, as markup. */
const markupOf = (page: ExactApiPage) =>
  renderToStaticMarkup(
    Div({
      children: [...apiArticle(page.symbol, page.layouts).nodes, SidebarNav({ groups: exactSidebar(page) })],
    }).render(),
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
        sidebar: sharedPage.sidebar.map((group, index) =>
          index === 0 ? { ...group, items: group.items.slice(1) } : group,
        ),
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

  it('carries the line’s tabs and the symbol’s version switcher, links relative to the version', () => {
    const firsts = [...new Map(groups.map(group => [group.line, group])).values()]
    for (const { line, versions, section, symbol } of firsts) {
      const page = pageOf(line, versions[0]!, section, symbol)
      const relative = (value: unknown) =>
        value === undefined
          ? undefined
          : JSON.parse(JSON.stringify(value).split(`/docs/${line}/api/${versions[0]}/`).join('../'))
      expect(page.switcher, line).toEqual(relative(apiVersions(line, symbol)))
      expect(page.tabs, line).toEqual(relative(guideEnabled(line) ? guideTabs(line, 'api') : undefined))
    }
    // Both are there to compare: a line with the Guide's tabs, and a switcher with versions to pick
    expect(firsts.some(({ line, versions, section, symbol }) => pageOf(line, versions[0]!, section, symbol).tabs)).toBe(
      true,
    )
    expect(sharedPage.switcher.options.length).toBeGreaterThan(1)
  })

  it('links each version of a shared page to its own pages, the sidebar marking the page itself', () => {
    const hrefs = hrefsOf(sharedPage)
    // No link names a version; one to the version's pages is relative to it
    expect(hrefs.filter(href => /\/api\/\d+\.\d+\.\d+/.test(href))).toEqual([])
    const relative = hrefs.filter(href => href.startsWith('../'))
    expect(relative.length).toBeGreaterThan(0)
    // A type in its signature among them, which e2e/exact-pages.spec.ts follows
    expect(markupOf(sharedPage)).toMatch(SIGNATURE_LINK)
    // A page whose signature links nothing doesn't count for its sidebar's links
    expect(markupOf(pageOf('4.1', '4.1.0-beta.8', 'responses', 'CommandNotFoundError'))).not.toMatch(SIGNATURE_LINK)
    for (const version of shared.versions) {
      const page = new URL(pathOf(shared.line, version, shared.section, shared.symbol), 'https://docs.test')
      for (const href of relative) {
        const target = new URL(href, page)
        const [, , , , , section, symbol] = target.pathname.split('/')
        expect(target.pathname.startsWith(`/docs/${shared.line}/api/${version}/`), href).toBe(true)
        // A symbol's page or the CLI's, which the line's by-kind sidebar lists too
        if (section !== 'cli') expect(exactApiPage(shared.line, version, section!, symbol!), href).toBeDefined()
      }
    }
    const current = exactSidebar(sharedPage)
      .flatMap(group => group.items)
      .filter(item => item.current)
    expect(current.map(item => item.href)).toEqual([`../${shared.section}/${shared.symbol}`])
  })

  it('builds one sidebar for all of a version’s pages, which marks none of them', () => {
    const [line, version] = [shared.line, shared.versions[0]!]
    const other = exactApiParams().find(param => param.version === version && param.symbol !== shared.symbol)!
    expect(pageOf(line, version, other.section, other.symbol).sidebar).toBe(sharedPage.sidebar)
    expect(sharedPage.sidebar.flatMap(group => group.items).some(item => item.current)).toBe(false)
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
      servedPages(routes).map(({ line, version, section, symbol }) => pathOf(line, version, section, symbol)),
    )
    expect(prerendered.size).toBe(groups.length)
    let routed = 0
    for (const { line, version, section, symbol } of exactApiParams()) {
      const own = pathOf(line, version, section, symbol)
      const served = exactRewrite(own, routes, line)
      // Served by its own page, or by a prerendered page of its group's first version
      if (prerendered.has(own)) expect(served, own).toBeUndefined()
      else {
        routed += 1
        expect(served, own).toBe(
          pathOf(line, sharedVersions(routes, line, version, `${section}/${symbol}`)![0]!, section, symbol),
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

  it('gives back every group from the routes, and tells routes that do not', () => {
    const routes = exactApiRoutes()
    expect(exactRoutesMismatch(routes, groups)).toBeUndefined()
    for (const { line, section, symbol, versions } of groups) {
      for (const version of versions) {
        expect(sharedVersions(routes, line, version, `${section}/${symbol}`), `${line} ${version}`).toEqual(versions)
      }
    }
    // A version sent to another set's page, as many pages served, and routes the step never wrote
    const moved = structuredClone(routes) as ExactRoutes
    const { versions, servedBy } = moved[shared.line]!
    const served = servedBy[`${shared.section}/${shared.symbol}`]!
    const own = versions.indexOf(shared.versions[0]!)
    const other = served.find(by => by >= 0 && by !== own)!
    served[versions.indexOf(shared.versions.at(-1)!)] = other
    expect(servedPages(moved).length).toBe(groups.length)
    expect(exactRoutesMismatch(moved, groups)).toBeDefined()
    const extra = structuredClone(routes) as ExactRoutes
    extra[shared.line]!.servedBy['core/NoSuchSymbol'] = extra[shared.line]!.versions.map((_, index) => index)
    expect(exactRoutesMismatch(extra, groups)).toBeDefined()
    expect(exactRoutesMismatch({}, groups)).toBeDefined()
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
