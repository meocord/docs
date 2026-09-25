/**
 * Typechecks each line's examples against the exact meocord version the line pins, and runs their
 * specs where the line has a vitest config:
 * `bun run examples:check [line... | compare]`. Run `bun install --linker isolated` first, so each workspace
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
// tsc's own entry point, run by this Bun process rather than through the bin's node shebang
const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

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
  const installed = existsSync(installedDir)
    ? JSON.parse(readFileSync(path.join(realpathSync(installedDir), 'package.json'), 'utf8')).version
    : undefined
  if (installed !== pinned) {
    failed++
    console.log(
      `  FAIL  ${line}: pins meocord ${pinned} but resolves ${installed ?? 'nothing'}; run bun install --linker isolated`,
    )
    continue
  }
  const result = spawnSync(process.execPath, [tsc, '-p', dir], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed++
    console.log(`  FAIL  ${line}: against meocord ${installed}\n${(result.stdout + result.stderr).trim()}`)
    continue
  }
  // A line with a vitest config runs its specs too, on Bun, as a generated app of that version does
  const hasSpecs = existsSync(path.join(dir, 'vitest.config.ts'))
  if (hasSpecs) {
    const specs = spawnSync(process.execPath, ['--bun', 'vitest', 'run'], { cwd: dir, encoding: 'utf8' })
    if (specs.status !== 0) {
      failed++
      console.log(`  FAIL  ${line}: specs against meocord ${installed}\n${(specs.stdout + specs.stderr).trim()}`)
      continue
    }
  }
  console.log(`  ok    ${line}: typechecks${hasSpecs ? ', and its specs pass,' : ''} against meocord ${installed}`)
}

// examples/compare holds the other frameworks' code the Coming-from pages show. It belongs to no line and
// pins no meocord, so it is typechecked against the framework versions its own package.json pins.
const compare = paths.examples('compare')
if (existsSync(compare) && (requested.length === 0 || requested.includes('compare'))) {
  const pins = JSON.parse(readFileSync(path.join(compare, 'package.json'), 'utf8')).dependencies as Record<
    string,
    string
  >
  const frameworks = ['discord.js', '@sapphire/framework', 'discordx', 'necord']
    .map(name => `${name} ${pins[name]}`)
    .join(', ')
  const result = spawnSync(process.execPath, [tsc, '-p', compare], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed++
    console.log(`  FAIL  compare: against ${frameworks}\n${(result.stdout + result.stderr).trim()}`)
  } else {
    console.log(`  ok    compare: typechecks against ${frameworks}`)
  }
}

if (failed > 0) process.exit(1)
