/**
 * Fails when a built page would load an image, script, frame, stylesheet or media file from another origin,
 * which the page policy refuses. Run after `next build`.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { foreignResources } from './lib/built-resources.js'
import { ROOT } from './lib/layout.js'

const app = path.join(ROOT, '.next', 'server', 'app')
if (!existsSync(app)) {
  console.error('No built pages under .next/server/app: run the build first.')
  process.exit(1)
}
const pages = readdirSync(app, { recursive: true, encoding: 'utf8' }).filter(name => name.endsWith('.html'))
const problems = pages.flatMap(page =>
  foreignResources(readFileSync(path.join(app, page), 'utf8')).map(found => `.next/server/app/${page}: ${found}`),
)
if (problems.length > 0) {
  console.error(`${problems.length} resource(s) a built page would load from another origin, which its policy refuses:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`No built page loads anything from another origin: ${pages.length} pages.`)
