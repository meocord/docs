/**
 * Formats the reference's long code for every version with a generated API, before `next build`:
 * .api-layout/<version>.json, which the API pages read. Output is derived, so it is not committed.
 */

import { mkdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { modelLayouts } from './lib/api-layout.js'
import { ROOT } from './lib/layout.js'
import { apiModel, lineVersions } from '../src/lib/docs/api-site.js'
import { VERSIONS } from '../src/config/versions.js'

const OUT = path.join(ROOT, '.api-layout')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const { line } of VERSIONS.lines) {
  for (const version of lineVersions(line)) {
    const model = apiModel(line, version)
    if (!model) {
      // versions.json lists it, so its pages are built: without its API they cannot be.
      console.error(`${version}: no generated API at generated/api/${version}.json`)
      process.exit(1)
    }
    const layouts = await modelLayouts(model)
    writeFileSync(path.join(OUT, `${version}.json`), JSON.stringify(layouts))
    console.log(`${version}: ${Object.keys(layouts).length} displays formatted`)
  }
}
