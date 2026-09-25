/**
 * Adds every version published to npm since versions.json's `since` that the site lacks, each one
 * verified first: `bun run versions:sync [--summary <file>]`. The release bot runs it and opens a
 * pull request with what it wrote; the summary file becomes that pull request's body. A new version
 * moves its line's example pin, so the lockfile is updated to match, without installing anything.
 */

import { spawnSync } from 'child_process'
import { writeFileSync } from 'fs'
import { formatFiles } from './lib/format.js'
import { paths, ROOT } from './lib/layout.js'
import { loadTrustedRoot } from './lib/provenance.js'
import { fetchPackument } from './lib/registry.js'
import { sync, syncSummary } from './lib/sync.js'
import { readVersions, writeVersions } from './lib/versions.js'

const summaryIndex = process.argv.indexOf('--summary')
const summaryFile = summaryIndex > -1 ? process.argv[summaryIndex + 1] : undefined

const config = readVersions(paths.versions)
let trustedRoot: ReturnType<typeof loadTrustedRoot> | undefined
const result = await sync(config, {
  packument: await fetchPackument(config.package),
  trustedRoot: () => (trustedRoot ??= loadTrustedRoot()),
})

if (result.added.length === 0) {
  console.log('Every published version is already documented.')
} else {
  writeVersions(paths.versions, result.config)
  await formatFiles([paths.versions, ...result.config.lines.map(line => paths.readme(line.line))])
  // The pull request's checks install with --frozen-lockfile; resolving alone runs nothing it downloads
  const lockfile = spawnSync('bun', ['install', '--lockfile-only'], { cwd: ROOT, stdio: 'inherit' })
  if (lockfile.status !== 0) throw new Error('bun install --lockfile-only failed; bun.lock does not match the pins.')
  console.log(`Added ${result.added.join(', ')}.`)
  if (summaryFile) writeFileSync(summaryFile, `${syncSummary(result)}\n`)
}
