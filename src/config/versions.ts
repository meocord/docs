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

/** Lines whose releases npm deprecates for security advisories, which their archived notice warns of in red. */
const ADVISORY_LINES: ReadonlySet<string> = new Set(['4.0'])

/**
 * The tone of an archived line's notice: danger for a line whose releases carry security advisories, and a warning for
 * one a newer minor simply superseded, which upgrading replaces without changes.
 */
export const archivedTone = (line: string): 'warning' | 'danger' => (ADVISORY_LINES.has(line) ? 'danger' : 'warning')

/**
 * Whether search engines may index a line's pages: only the current line's, at `latest`. Other lines stay
 * readable and followed, but out of results, so a page of 4.0 never competes with its 4.1 counterpart.
 */
export function lineIndexed(line: string, manifest: VersionsManifest = VERSIONS): boolean {
  return manifest.lines.some(entry => entry.line === line && entry.status === 'current')
}

/**
 * The package spec a reader runs to install a line's newest version, `meocord@beta` for a line in beta;
 * with `version`, that version's.
 */
export const specFor = (line: string, version?: string): string =>
  version ? `${manifest.package}@${version}` : packageSpec(manifest as VersionsConfig, line)
