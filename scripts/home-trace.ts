/**
 * Records the home page's pipeline demo by running the real example call in the current line's
 * examples workspace, as a member and as a blocked user, and writes what happened to
 * .home-trace/trace.json. The build, the dev server and the unit tests run it first; the output
 * follows from the pinned meocord, so it is not committed.
 *
 *   bun run home:trace
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { paths, ROOT, writeText } from './lib/layout.js'
import { HOME_LINE } from '../src/config/home.js'

// The line the home page shows the demo from
const LINE = HOME_LINE
const OUT = path.join(ROOT, '.home-trace', 'trace.json')

const result = spawnSync(process.execPath, ['src/home/record.ts'], { cwd: paths.examples(LINE), encoding: 'utf8' })
if (result.status !== 0) {
  console.error(`Recording the home trace in examples/${LINE} failed:\n${result.stderr || result.stdout}`)
  process.exit(1)
}
writeText(OUT, result.stdout)
console.log(`Wrote .home-trace/trace.json from examples/${LINE}.`)
