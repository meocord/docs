/**
 * Fails when Next spent longer than its budget prerendering a page, on average, from the build's log, so a
 * page that renders slower shows before it slows every build. Adding versions adds pages, not cost a page.
 * Usage: check-static-generation <log>
 */

import { readFileSync } from 'fs'
import { staticGeneration, staticGenerationReport } from './lib/static-generation.js'

const file = process.argv[2]
if (!file) {
  console.error('Usage: bun scripts/check-static-generation.ts <build log>')
  process.exit(1)
}
const found = staticGeneration(readFileSync(file, 'utf8'))
if (!found) {
  console.error(`No static generation summary in ${file}.`)
  process.exit(1)
}
const { summary, over } = staticGenerationReport(found)
if (over) {
  console.error(`${summary}: over budget.`)
  process.exit(1)
}
console.log(summary)
