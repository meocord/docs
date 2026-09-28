import manifest from '../../versions.json'
import { packageSpec } from '../../scripts/lib/package-spec'
import type { VersionsConfig } from '../../scripts/lib/versions'
import type { LineStatus, VersionsManifest } from '@/lib/urls'

const STATUSES: readonly string[] = ['prerelease', 'current', 'maintained', 'archived'] satisfies LineStatus[]

/** versions.json as the site reads it at build: each line and its standing. */
export const VERSIONS: VersionsManifest = {
  lines: manifest.lines.map(({ line, status }) => {
    if (!STATUSES.includes(status)) throw new Error(`versions.json: line ${line} has an unknown status "${status}".`)
    return { line, status: status as LineStatus }
  }),
}

/** The line in force, which the site addresses as `latest`. */
export const CURRENT_LINE = VERSIONS.lines.find(entry => entry.status === 'current')?.line ?? VERSIONS.lines[0].line

/**
 * The package spec a reader runs to install a line's newest version, `meocord@beta` for a line in beta;
 * with `version`, that version's.
 */
export const specFor = (line: string, version?: string): string =>
  version ? `${manifest.package}@${version}` : packageSpec(manifest as VersionsConfig, line)
