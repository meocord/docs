/**
 * Applies a commit's changes to one line's guides to another line: `bun run content:backport <sha>
 * --to <line>`. It commits the result on a branch of its own, `backport/<sha>-<line>`, for a pull
 * request; a conflict means the two lines' text has diverged, and a person decides.
 */

import { execFileSync, spawnSync } from 'child_process'
import { paths } from './lib/layout.js'
import { retargetDiff, sourceLine } from './lib/backport.js'
import { findLine, readVersions } from './lib/versions.js'

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const [sha] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const to = process.argv[process.argv.indexOf('--to') + 1]
if (!sha || !process.argv.includes('--to') || !to) {
  console.error('Usage: bun run content:backport <sha> --to <line>')
  process.exit(1)
}
const config = readVersions(paths.versions)
if (!findLine(config, to)) {
  console.error(`versions.json has no line ${to}.`)
  process.exit(1)
}

// One line of context: the lines' pages differ around a change, in their front matter at least.
// Untrimmed, since a patch must end with its last line's newline.
const diff = execFileSync('git', ['show', '--format=', '--binary', '-U1', sha, '--', 'content/'], { encoding: 'utf8' })
const from = sourceLine(diff)
if (from === to) {
  console.error(`${sha} already changes content/${to}.`)
  process.exit(1)
}
const subject = git('show', '-s', '--format=%s', sha)
const short = git('rev-parse', '--short', sha)
if (git('status', '--porcelain')) {
  console.error('Commit or set aside your changes first; the backport works on a branch of its own.')
  process.exit(1)
}

git('switch', '-c', `backport/${short}-${to}`)
const apply = spawnSync('git', ['apply', '--index', '-C1', '-'], { input: retargetDiff(diff, from, to), encoding: 'utf8' })
if (apply.status !== 0) {
  console.error(`The change does not apply cleanly to ${to}:\n${apply.stderr}\nResolve it on this branch, or drop the branch.`)
  process.exit(1)
}
git('commit', '-m', `${subject.replace(/^(\w+)(\([^)]*\))?:/, `$1(${to}):`)}\n\nBackport of ${short} from ${from}.`)
console.log(`Committed on backport/${short}-${to}. Push it and open a pull request labelled backport:${to}.`)
