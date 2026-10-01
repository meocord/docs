/**
 * Fails when the E2E run's JSON report doesn't show every must-run spec running each of its tests; see
 * scripts/lib/e2e-ran.ts. Run after `bun run test:e2e` in CI:
 *
 *   bun scripts/check-e2e-ran.ts e2e-results/results.json
 */

import { existsSync, readFileSync } from 'node:fs'
import { MUST_RUN, mustRunProblems, type Report, testsOf } from './lib/e2e-ran'

const file = process.argv[2] ?? 'e2e-results/results.json'
if (!existsSync(file)) {
  console.error(`No E2E report at ${file}: the run wrote none, so nothing shows what ran.`)
  process.exit(1)
}
const report = JSON.parse(readFileSync(file, 'utf8')) as Report
const tests = testsOf(report)
const count = (status: string) => tests.filter(({ test }) => test.status === status).length
console.log(
  `${tests.length} tests: ${count('expected')} passed, ${count('flaky')} flaky, ${count('unexpected')} failed, ${count('skipped')} skipped`,
)
const problems = mustRunProblems(report)
if (problems.length > 0) {
  console.error(`${problems.length} must-run test(s) didn't run:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`Every test of ${MUST_RUN.length} must-run specs ran: ${MUST_RUN.join(', ')}.`)
