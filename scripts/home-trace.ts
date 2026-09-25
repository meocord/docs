/**
 * Records the home page's pipeline demo by running the real example call in the current line's
 * examples workspace, as a member and as a blocked user, and writes what happened to
 * generated/home/trace.json. `--check` fails instead of writing when the file is out of date.
 *
 *   bun run home:trace [--check]
 */
import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { paths, ROOT, writeText } from './lib/layout.js'

// The line the home page shows the demo from: the newest line with an examples workspace.
const LINE = '4.1'
const OUT = path.join(ROOT, 'generated', 'home', 'trace.json')
const check = process.argv.includes('--check')

const dir = paths.examples(LINE)
const result = spawnSync(process.execPath, ['src/home/record.ts'], { cwd: dir, encoding: 'utf8' })
if (result.status !== 0) {
  console.error(`Recording the home trace in examples/${LINE} failed:\n${result.stderr || result.stdout}`)
  process.exit(1)
}
const recorded = result.stdout

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== recorded) {
    console.error('generated/home/trace.json is out of date; run bun run home:trace')
    process.exit(1)
  }
  console.log('generated/home/trace.json matches a fresh recording.')
} else {
  writeText(OUT, recorded)
  console.log(`Wrote generated/home/trace.json from examples/${LINE}.`)
}
