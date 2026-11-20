import { createHash } from 'node:crypto'
import type { NavGroup } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { exactApiPage, type ExactApiPage } from '@/lib/docs/api-render'
import { apiModel, lineVersions } from '@/lib/docs/api-site'
import { servedPages, sharedVersions, type ExactRoutes } from '@/lib/docs/exact-routes'

/** A symbol's exact-version page and the versions of its line that show it, oldest first; the first serves it. */
export interface ExactGroup {
  line: string
  section: string
  symbol: string
  versions: string[]
}

const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const sidebarKeys = new WeakMap<NavGroup[], string>()

/**
 * What decides whether two versions share a page: the whole page, as data. The sidebar, which every page of a version
 * shares, is hashed once for the version and stands in the page's key by its hash.
 */
export function pageKey(page: ExactApiPage): string {
  let sidebar = sidebarKeys.get(page.sidebar)
  if (sidebar === undefined) sidebarKeys.set(page.sidebar, (sidebar = digest(JSON.stringify(page.sidebar))))
  return digest(JSON.stringify({ ...page, sidebar }))
}

let groups: ExactGroup[] | undefined

/** Every symbol's exact-version pages, one group for each page, by line, oldest version first. */
export function exactApiGroups(): ExactGroup[] {
  if (groups) return groups
  const found = new Map<string, ExactGroup>()
  for (const { line } of VERSIONS.lines) {
    for (const version of lineVersions(line).reverse()) {
      for (const { section, symbol } of apiModel(line, version)?.params() ?? []) {
        const key = `${line}\0${section}/${symbol}\0${pageKey(exactApiPage(line, version, section, symbol)!)}`
        const group = found.get(key)
        if (group) group.versions.push(version)
        else found.set(key, { line, section, symbol, versions: [version] })
      }
    }
  }
  return (groups = [...found.values()])
}

/** Which version's page serves each exact version's API page, by line and symbol, for the proxy and the API route. */
export function exactApiRoutes(): ExactRoutes {
  const routes: ExactRoutes = {}
  for (const { line, section, symbol, versions } of exactApiGroups()) {
    routes[line] ??= { versions: lineVersions(line).reverse(), servedBy: {} }
    const { versions: order, servedBy } = routes[line]
    const served = (servedBy[`${section}/${symbol}`] ??= order.map(() => -1))
    for (const version of versions) served[order.indexOf(version)] = order.indexOf(versions[0]!)
  }
  return routes
}

/**
 * Where `routes` doesn't give back `groups`: a group whose versions don't share one served page, or a served page no
 * group has. Undefined when they agree, as the routes `bun run api:routes` writes must.
 */
export function exactRoutesMismatch(routes: ExactRoutes, found: ExactGroup[]): string | undefined {
  for (const { line, section, symbol, versions } of found) {
    for (const version of versions) {
      const shared = sharedVersions(routes, line, version, `${section}/${symbol}`)
      if (shared?.join() !== versions.join()) return `${line} ${version} ${section}/${symbol}`
    }
  }
  const served = servedPages(routes)
  if (served.length !== found.length) return `${served.length} served pages for ${found.length} groups`
  return undefined
}
