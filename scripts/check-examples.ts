/**
 * Typechecks each line's examples against the exact meocord version the line pins, and runs their
 * specs where the line has a vitest config:
 * `bun run examples:check [line... | compare]`. Run `bun install --linker isolated` first, so each workspace
 * resolves its own meocord.
 */

import { spawnSync } from 'child_process'
import { cpSync, existsSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import { paths, ROOT } from './lib/layout.js'
import { asOf, READING_ORDER, stepIndex, stepProblems, stepsIn } from './lib/steps.js'
import { readVersions } from './lib/versions.js'

const config = readVersions(paths.versions)
const requested = process.argv.slice(2)
const lines = config.lines.map(line => line.line).filter(line => requested.length === 0 || requested.includes(line))
// tsc's own entry point, run by this Bun process rather than through the bin's node shebang
const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

/** Every .ts file under a folder, by its path relative to it, node_modules aside. */
function tsFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (name === 'node_modules') return []
    if (statSync(full).isDirectory()) return tsFiles(full, base)
    return name.endsWith('.ts') ? [path.relative(base, full)] : []
  })
}

/**
 * Typechecks each tutorial step's version of the folders that hold step marks: the files as they stand
 * at every page that adds a step, and before the first, so no page shows code that does not compile.
 * Each version is written to examples/<line>/.steps/, beside src/ so it resolves the line's packages.
 */
function checkSteps(line: string, dir: string): string[] {
  const src = path.join(dir, 'src')
  const marked = tsFiles(src).filter(file => stepsIn(readFileSync(path.join(src, file), 'utf8')).length > 0)
  if (marked.length === 0) return []
  const failures: string[] = []
  for (const file of marked)
    for (const problem of stepProblems(readFileSync(path.join(src, file), 'utf8')))
      failures.push(`examples/${line}/src/${file}: ${problem}`)
  if (failures.length > 0) return failures

  const folders = [...new Set(marked.map(file => path.dirname(file)))]
  const steps = [...new Set(marked.flatMap(file => stepsIn(readFileSync(path.join(src, file), 'utf8'))))]
  const first = Math.min(...steps.map(step => stepIndex(step)!))
  const pages = [...(first > 0 ? [READING_ORDER[first - 1]] : []), ...steps]
  const root = path.join(dir, '.steps')
  try {
    for (const page of pages) {
      const at = path.join(root, page.replace(/\//g, '-'))
      cpSync(src, path.join(at, 'src'), { recursive: true, filter: from => !from.includes('node_modules') })
      for (const folder of folders)
        for (const file of tsFiles(path.join(src, folder)).map(name => path.join(folder, name)))
          writeFileSync(path.join(at, 'src', file), asOf(readFileSync(path.join(src, file), 'utf8'), page))
      writeFileSync(
        path.join(at, 'tsconfig.json'),
        JSON.stringify({
          extends: '../../tsconfig.json',
          compilerOptions: { rootDir: '.', paths: { '@src/*': ['./src/*'] } },
          include: folders.map(folder => `src/${folder}/**/*.ts`),
        }),
      )
      const result = spawnSync(process.execPath, [tsc, '-p', at], { encoding: 'utf8' })
      if (result.status !== 0)
        failures.push(`the tutorial as it stands at ${page}:\n${(result.stdout + result.stderr).trim()}`)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  return failures
}

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
  // Examples that augment meocord's types, such as an app's own theme tokens, are a program of their own, since an
  // augmentation reaches every file compiled with it
  const augmented = path.join(dir, 'src', 'augmented', 'tsconfig.json')
  if (existsSync(augmented)) {
    const typed = spawnSync(process.execPath, [tsc, '-p', augmented], { encoding: 'utf8' })
    if (typed.status !== 0) {
      failed++
      console.log(
        `  FAIL  ${line}: augmented examples against meocord ${installed}\n${(typed.stdout + typed.stderr).trim()}`,
      )
      continue
    }
  }
  const stepFailures = checkSteps(line, dir)
  if (stepFailures.length > 0) {
    failed++
    console.log(`  FAIL  ${line}: tutorial steps against meocord ${installed}\n${stepFailures.join('\n')}`)
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
