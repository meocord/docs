import { createHash } from 'node:crypto'
import { VERSIONS } from '@/config/versions'
import { exactApiPage, type ExactApiPage } from '@/lib/docs/api-render'
import { apiModel, lineVersions } from '@/lib/docs/api-site'
import { readExactRoutes, type ExactRoutes } from '@/lib/docs/exact-routes'

/** A symbol's exact-version page and the versions of its line that show it, oldest first; the first serves it. */
export interface ExactGroup {
  line: string
  section: string
  symbol: string
  versions: string[]
}

/** What decides whether two versions share a page: the whole page, as data. */
export const pageKey = (page: ExactApiPage) => createHash('sha256').update(JSON.stringify(page)).digest('hex')

let groups: ExactGroup[] | undefined
let byPath: Map<string, ExactGroup> | undefined
const pathKey = (line: string, version: string, section: string, symbol: string) =>
  `${line}/${version}/${section}/${symbol}`

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

/** The group an exact version's page of a symbol belongs to, or undefined when that version has no such symbol. */
export function exactApiGroup(line: string, version: string, section: string, symbol: string): ExactGroup | undefined {
  byPath ??= new Map(
    exactApiGroups().flatMap(group =>
      group.versions.map(each => [pathKey(group.line, each, group.section, group.symbol), group] as const),
    ),
  )
  return byPath.get(pathKey(line, version, section, symbol))
}

/** Every `{ line, version, section, symbol }` an exact version's API page is prerendered for: one per group. */
export function exactApiPageParams(): { line: string; version: string; section: string; symbol: string }[] {
  return exactApiGroups().map(({ line, versions, section, symbol }) => ({
    line,
    version: versions[0]!,
    section,
    symbol,
  }))
}

/** Which version's page serves each exact version's API page, by line and symbol, for the proxy. */
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
 * Fails a production build whose routes, as `bun run api:routes` wrote them, are not the ones its pages make: the
 * proxy would send a version to a page that isn't its own.
 */
export function checkExactRoutes(production = process.env.NODE_ENV === 'production', root = process.cwd()): void {
  if (!production) return
  if (readExactRoutes(true, root) !== JSON.stringify(exactApiRoutes())) {
    throw new Error('The exact-version routes are out of date with the pages: run `bun run api:routes`.')
  }
}
