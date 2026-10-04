/**
 * since.json: the first documented version each public symbol, member and parameter appears in,
 * and the version it disappeared in, derived from the API documents rather than written by hand.
 */

import semver from 'semver'
import type { JSONOutput } from 'typedoc'

type Node = JSONOutput.DeclarationReflection | JSONOutput.SignatureReflection | JSONOutput.ProjectReflection

/**
 * Every key a document declares: `meocord/decorator:Defer`, a member as `meocord/core:ShardContext.call`,
 * and a parameter as `meocord/decorator:Defer(options)`.
 */
export function apiKeys(project: JSONOutput.ProjectReflection): Set<string> {
  const keys = new Set<string>()
  const visit = (node: Node, prefix: string) => {
    for (const child of ('children' in node ? node.children : undefined) ?? []) {
      const key = prefix.endsWith(':') ? `${prefix}${child.name}` : `${prefix}.${child.name}`
      keys.add(key)
      for (const signature of child.signatures ?? []) {
        for (const parameter of signature.parameters ?? []) keys.add(`${key}(${parameter.name})`)
      }
      visit(child, key)
    }
  }
  for (const entry of project.children ?? []) visit(entry, `${entry.name}:`)
  return keys
}

export interface SinceEntry {
  since: string
  removed?: string
}

/** The since map across versions, given each version's keys. Keys that come back after removal keep their first version. */
export function computeSince(keysByVersion: Record<string, Set<string>>): Record<string, SinceEntry> {
  const versions = Object.keys(keysByVersion).sort(semver.compare)
  const since: Record<string, SinceEntry> = {}
  let previous = new Set<string>()
  for (const version of versions) {
    const keys = keysByVersion[version]
    for (const key of keys) {
      if (!since[key]) since[key] = { since: version }
      else if (since[key].removed && !previous.has(key)) delete since[key].removed
    }
    for (const key of previous) if (!keys.has(key) && !since[key].removed) since[key].removed = version
    previous = keys
  }
  return Object.fromEntries(Object.entries(since).sort(([a], [b]) => a.localeCompare(b)))
}

/** Every documented release, prereleases left out: the versions a prerelease's `since` can be shown as. */
export function releasesOf(config: { lines: readonly { versions: readonly string[] }[] }): ReadonlySet<string> {
  return new Set(config.lines.flatMap(line => line.versions).filter(version => !semver.prerelease(version)))
}

/**
 * The first version a reader of `version` is shown for a key: a prerelease as its release once that release is
 * documented, so a symbol from 4.1.0-beta.5 reads as since 4.1.0, except on a page of a version older than the
 * release, which keeps the prerelease it came in. Without `version`, the page is its line's newest.
 */
export function shownSince(since: string, releases: ReadonlySet<string>, version?: string): string {
  const parsed = semver.parse(since)
  if (!parsed || parsed.prerelease.length === 0) return since
  const release = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  if (!releases.has(release)) return since
  return version && semver.lt(version, release) ? since : release
}
