/**
 * Fails when Next spent longer than the budget prerendering the site, from the build's log, so the
 * growth of exact-version pages shows before it slows every build. Usage: check-static-generation <log>
 */

import { readFileSync } from 'fs'
import { STATIC_GENERATION_BUDGET_S, staticGeneration } from './lib/static-generation.js'

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
const summary = `${found.pages} pages prerendered in ${found.seconds.toFixed(1)} s on ${found.workers} workers (budget ${STATIC_GENERATION_BUDGET_S} s)`
if (found.seconds > STATIC_GENERATION_BUDGET_S) {
  console.error(`${summary}: over budget.`)
  process.exit(1)
}
console.log(summary)
