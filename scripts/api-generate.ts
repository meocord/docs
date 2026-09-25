/**
 * Regenerates what the site takes from versions it already lists, verifying each package again: their
 * API documents, changelogs and configuration references, and for a line's newest version its guides, example pin and migration
 * guide. `bun run api:generate <version...>`, or `--all` after upgrading TypeDoc.
 */

import { formatFiles } from './lib/format.js'
import { paths } from './lib/layout.js'
import { loadTrustedRoot } from './lib/provenance.js'
import { fetchPackument } from './lib/registry.js'
import { generateVersion, refreshConfig, refreshLine, refreshSince } from './lib/sync.js'
import { fetchVerified } from './lib/verified-package.js'
import { allVersions, readVersions } from './lib/versions.js'

const config = readVersions(paths.versions)
const known = allVersions(config)
const requested = process.argv.includes('--all') ? known : process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const unknown = requested.filter(version => !known.includes(version))
if (requested.length === 0 || unknown.length > 0) {
  console.error(
    unknown.length > 0
      ? `Not in versions.json: ${unknown.join(', ')}. Add new versions with versions:sync.`
      : 'Name versions to regenerate, or pass --all.',
  )
  process.exit(1)
}

const packument = await fetchPackument(config.package)
let trustedRoot: ReturnType<typeof loadTrustedRoot> | undefined
for (const version of requested) {
  const pkg = await fetchVerified(config, packument, version, () => (trustedRoot ??= loadTrustedRoot()))
  try {
    await refreshLine(config, pkg)
    await generateVersion(pkg, config)
    console.log(`${version}: regenerated`)
  } finally {
    pkg.remove()
  }
}
refreshSince()
refreshConfig()
await formatFiles(config.lines.map(line => paths.readme(line.line)))
