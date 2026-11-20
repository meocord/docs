/**
 * Writes .api-routes.json before `next build` and `next dev`, after `api:layout`: which version's page serves each exact
 * version's API page. It is the only step that groups the pages; next.config.ts inlines the file into the proxy and the
 * API route, which read their routes, params and shared versions from it. Two versions share a page when the pages are
 * equal, so a change to what a page shows regroups here on the next build. Output is derived, so it is not committed.
 */

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { ROOT } from './lib/layout.js'
import { exactApiGroups, exactApiRoutes, exactRoutesMismatch } from '../src/lib/docs/exact-pages.js'
import { EXACT_ROUTES_FILE, type ExactRoutes } from '../src/lib/docs/exact-routes.js'

const file = path.join(ROOT, EXACT_ROUTES_FILE)
writeFileSync(file, `${JSON.stringify(exactApiRoutes())}\n`)
const pages = exactApiGroups()
// What the proxy and the route will read back must give these groups, or a version would be served another's page
const mismatch = exactRoutesMismatch(JSON.parse(readFileSync(file, 'utf8')) as ExactRoutes, pages)
if (mismatch) throw new Error(`${EXACT_ROUTES_FILE} does not give back the pages' groups: ${mismatch}`)
const versions = pages.reduce((count, group) => count + group.versions.length, 0)
console.log(`${versions} exact-version API pages, served by ${pages.length}`)
