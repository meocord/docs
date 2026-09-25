/**
 * `bun run brand:sync` writes meocord main's tools/brand/mark.json to src/lib/brand/mark.json;
 * `bun run brand:check` (this script with --check) fails when the copy differs. See scripts/lib/brand-mark.ts.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { checkMark, fetchCanonicalMark, MARK_COPY, markVerdict } from './lib/brand-mark.js'
import { ROOT } from './lib/layout.js'

const file = path.join(ROOT, MARK_COPY)

if (process.argv.includes('--check')) {
  const copy = existsSync(file) ? readFileSync(file, 'utf8') : undefined
  // The merge queue is the last gate before main, so it is held to main's rule
  const onMain = process.env.GITHUB_REF === 'refs/heads/main' || process.env.GITHUB_EVENT_NAME === 'merge_group'
  const verdict = markVerdict(await checkMark(copy), { onMain })
  if (verdict.level === 'pass') console.log(verdict.message)
  // A GitHub Actions annotation, shown on the pull request without failing it
  else if (verdict.level === 'warn') console.log(`::warning::${verdict.message}`)
  else {
    console.error(verdict.message)
    process.exit(1)
  }
} else {
  writeFileSync(file, await fetchCanonicalMark())
  console.log(`Wrote ${MARK_COPY} from meocord main.`)
}
