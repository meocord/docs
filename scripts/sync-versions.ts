/**
 * Adds every version published to npm since versions.json's `since` that the site lacks, each one
 * verified first: `bun run versions:sync [--summary <file>]`. The release bot runs it and opens a
 * pull request with what it wrote; the summary file becomes that pull request's body.
 */

import { writeFileSync } from 'fs'
import { paths } from './lib/layout.js'
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
  console.log(`Added ${result.added.join(', ')}.`)
  if (summaryFile) writeFileSync(summaryFile, `${syncSummary(result)}\n`)
}
