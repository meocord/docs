/**
 * Prints `run=true` or `run=false` for the step that regenerates every version; see
 * scripts/lib/regeneration-scope.ts. A pull request's run checks out its merge commit, whose first parent is the
 * base it merges into, so the files it changes are `git diff HEAD^1 HEAD`. In CI, with `fetch-depth: 2`:
 *
 *   bun scripts/regeneration-scope.ts >> "$GITHUB_OUTPUT"
 */

import { spawnSync } from 'node:child_process'
import { readsChanges, regenerates } from './lib/regeneration-scope'

const event = process.env.GITHUB_EVENT_NAME ?? ''
let changed: string[] = []
if (readsChanges(event)) {
  const diff = spawnSync('git', ['diff', '--name-only', 'HEAD^1', 'HEAD'], { encoding: 'utf8' })
  if (diff.status !== 0) {
    console.error(`Could not list the pull request's changes: ${diff.stderr.trim()}`)
    process.exit(1)
  }
  changed = diff.stdout.split('\n').filter(Boolean)
  console.error(`The pull request changes ${changed.length} file(s):\n  ${changed.join('\n  ')}`)
}
const run = regenerates(event, changed)
console.error(run ? 'Regenerating every version.' : 'Nothing the documents are made from changed: not regenerating.')
console.log(`run=${run}`)
