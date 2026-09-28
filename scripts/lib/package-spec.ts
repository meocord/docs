/**
 * The package a page tells a reader to run, as `npx {{meocord}} create my-bot`: the placeholder
 * stands for the spec that installs the line the page documents, so a prerelease line's pages run
 * its prerelease and a stable line's need no tag.
 */

import semver from 'semver'
import type { Packument } from './registry'
import { findLine, lineOf, newestIn, type Line, type VersionsConfig } from './versions'

/** What a page writes for the package spec. */
export const PACKAGE_SPEC = '{{meocord}}'

/** The dist-tag that installs a line's newest version, or undefined when none is expected to. */
function tagFor(line: Line): string | undefined {
  if (line.status === 'current') return 'latest'
  const id = line.status === 'prerelease' && line.versions.length > 0 && semver.prerelease(newestIn(line))?.[0]
  return typeof id === 'string' ? id : undefined
}

/**
 * The spec that installs a line's newest version: the package's name for the current line, its
 * prerelease tag for a line in prerelease (`meocord@beta`), and the exact version for any other.
 */
export function packageSpec(config: VersionsConfig, name: string): string {
  const line = findLine(config, name)
  if (!line || line.versions.length === 0) return config.package
  const tag = tagFor(line)
  if (tag === 'latest') return config.package
  return `${config.package}@${tag ?? newestIn(line)}`
}

/** A line's page text with its package spec in place of the placeholder. */
export function withPackageSpec(text: string, config: VersionsConfig, line: string): string {
  return text.includes(PACKAGE_SPEC) ? text.replaceAll(PACKAGE_SPEC, packageSpec(config, line)) : text
}

/**
 * Each line whose package spec the registry would not resolve to a version of that line: the
 * current line's `latest`, or a prerelease line's tag, missing or pointing at another line.
 */
export function distTagProblems(config: VersionsConfig, packument: Packument): string[] {
  const problems: string[] = []
  for (const line of config.lines) {
    const tag = tagFor(line)
    if (!tag) continue
    const tagged = packument['dist-tags'][tag]
    const spec = packageSpec(config, line.line)
    if (!tagged) problems.push(`${line.line}'s pages run ${spec}, but the registry has no "${tag}" tag`)
    else if (lineOf(tagged) !== line.line)
      problems.push(`${line.line}'s pages run ${spec}, but the registry's "${tag}" tag points at ${tagged}`)
  }
  return problems
}

/** `meocord create`, with or without a tag or version: a create command written without the placeholder. */
const LITERAL_CREATE = /\bmeocord(?:@\S+)?\s+create\b/g

/** Each create command a page writes with the package's name rather than the placeholder, by its 1-based line. */
export function literalCreates(text: string): { line: number; command: string }[] {
  return [...text.matchAll(LITERAL_CREATE)].map(match => ({
    line: text.slice(0, match.index).split('\n').length,
    command: match[0].replace(/\s+/g, ' '),
  }))
}
