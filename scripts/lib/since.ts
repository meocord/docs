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
  for (const module of project.children ?? []) visit(module, `${module.name}:`)
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
