import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Which version's page serves each exact version's API page, as the proxy carries it: for each line its versions, oldest
 * first, and for each symbol, by `section/symbol`, the index of the version whose page serves each of those versions,
 * `-1` where that version has no such symbol.
 */
export type ExactRoutes = Record<string, { versions: string[]; servedBy: Record<string, number[]> }>

/** The file `bun run api:routes` writes before `next build` and `next dev`; derived, so it is not committed. */
export const EXACT_ROUTES_FILE = '.api-routes.json'

// An exact version's page of a symbol, its line by number or as latest: `/docs/latest/api/4.2.1/core/MeoCordApp`
const EXACT_PAGE = /^\/docs\/([^/]+)\/api\/(\d+\.\d+\.\d+[^/]*)\/([^/]+\/[^/]+)$/

/**
 * The routes `bun run api:routes` wrote, as next.config.ts inlines them into the proxy. A production build without
 * them fails, so no shared page goes unserved; a dev server without them gets none, and each version's URL renders its
 * own page.
 */
export function readExactRoutes(production: boolean, root = process.cwd()): string {
  const file = path.join(root, EXACT_ROUTES_FILE)
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  if (production) throw new Error(`No exact-version routes at ${file}: run \`bun run api:routes\`.`)
  return '{}'
}

/**
 * The path that serves an exact version's page reached at `pathname`, when it is another version's page; undefined for
 * a page that serves itself and for any other path. `latest` names `latestLine`.
 */
export function exactRewrite(pathname: string, routes: ExactRoutes, latestLine: string): string | undefined {
  const match = EXACT_PAGE.exec(pathname)
  if (!match) return undefined
  const [, segment, version, page] = match
  const line = segment === 'latest' ? latestLine : segment!
  const entry = routes[line]
  const at = entry?.versions.indexOf(version!) ?? -1
  const by = at < 0 ? undefined : entry!.servedBy[page!]?.[at]
  return by === undefined || by < 0 || by === at ? undefined : `/docs/${line}/api/${entry!.versions[by]}/${page}`
}
