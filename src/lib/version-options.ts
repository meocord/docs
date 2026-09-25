import type { VersionOption, VersionStatus } from '@/components/shell/types'
import { docsHref, type LineStatus, type VersionsManifest } from '@/lib/urls'

const STATUS: Record<LineStatus, VersionStatus> = {
  current: 'latest',
  maintained: 'maintained',
  prerelease: 'prerelease',
  archived: 'archived',
}

/** The version switcher's choices: every line in versions.json, each linking to where it lands. */
export function versionOptions(versions: VersionsManifest): VersionOption[] {
  return versions.lines.map(({ line, status }) => ({
    label: line,
    href: docsHref({ kind: 'line', line }, versions),
    status: STATUS[status],
  }))
}

/** The option for one line; throws when versions.json does not list it. */
export function versionOption(line: string, versions: VersionsManifest): VersionOption {
  const option = versionOptions(versions).find(candidate => candidate.label === line)
  if (!option) throw new Error(`Line "${line}" is not in versions.json.`)
  return option
}
