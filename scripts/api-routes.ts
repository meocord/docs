/**
 * Writes .api-routes.json before `next build` and `next dev`, after `api:layout`: which version's page serves each exact
 * version's API page, which next.config.ts inlines into the proxy. Two versions share a page when the pages are equal,
 * so a change to what a page shows regroups here on the next build. Output is derived, so it is not committed.
 */

import { writeFileSync } from 'fs'
import path from 'path'
import { ROOT } from './lib/layout.js'
import { exactApiGroups, exactApiRoutes } from '../src/lib/docs/exact-pages.js'
import { EXACT_ROUTES_FILE } from '../src/lib/docs/exact-routes.js'

const routes = exactApiRoutes()
writeFileSync(path.join(ROOT, EXACT_ROUTES_FILE), `${JSON.stringify(routes)}\n`)
const pages = exactApiGroups()
const versions = pages.reduce((count, group) => count + group.versions.length, 0)
console.log(`${versions} exact-version API pages, served by ${pages.length}`)
