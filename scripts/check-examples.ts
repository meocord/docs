/**
 * Typechecks each line's examples against the exact meocord version the line pins:
 * `bun run examples:check [line...]`. Run `bun install --linker isolated` first, so each workspace
 * resolves its own meocord.
 */

import { spawnSync } from 'child_process'
import { existsSync, readFileSync, realpathSync } from 'fs'
import path from 'path'
import { paths, ROOT } from './lib/layout.js'
import { readVersions } from './lib/versions.js'

const config = readVersions(paths.versions)
const requested = process.argv.slice(2)
const lines = config.lines.map(line => line.line).filter(line => requested.length === 0 || requested.includes(line))
const tsc = path.join(ROOT, 'node_modules', '.bin', 'tsc')

let failed = 0
for (const line of lines) {
  const dir = paths.examples(line)
  if (!existsSync(dir)) {
    console.log(`  skip  ${line}: no examples`)
    continue
  }
  const pinned = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies?.meocord
  const installedDir = path.join(dir, 'node_modules', 'meocord')
  // Read from disk: versions before 4.1 do not export package.json
  const installed = existsSync(installedDir) ? JSON.parse(readFileSync(path.join(realpathSync(installedDir), 'package.json'), 'utf8')).version : undefined
  if (installed !== pinned) {
    failed++
    console.log(`  FAIL  ${line}: pins meocord ${pinned} but resolves ${installed ?? 'nothing'}; run bun install --linker isolated`)
    continue
  }
  const result = spawnSync(tsc, ['-p', dir], { encoding: 'utf8' })
  if (result.status === 0) console.log(`  ok    ${line}: typechecks against meocord ${installed}`)
  else {
    failed++
    console.log(`  FAIL  ${line}: against meocord ${installed}\n${(result.stdout + result.stderr).trim()}`)
  }
}
if (failed > 0) process.exit(1)
