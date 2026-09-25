/**
 * versions.json: which MeoCord versions the site documents, how each line of them stands, and whose
 * signature a published version must carry.
 */

import { readFileSync, writeFileSync } from 'fs'
import semver from 'semver'

export type LineStatus = 'prerelease' | 'current' | 'maintained' | 'archived'

/** Where a line's guides come from: imported from that version's README, or written for the site. */
export type GuideSource = 'readme' | 'authored'

export interface Line {
  line: string
  status: LineStatus
  guides: GuideSource
  versions: string[]
}

export interface IdentityRule {
  /** The versions this identity signed, as a semver range. */
  range: string
  /** The exact certificate identity: a workflow at a ref, never a pattern. */
  identity: string
}

export interface VersionsConfig {
  package: string
  /** The oldest version the site documents; older releases are never picked up. */
  since: string
  provenance: {
    issuer: string
    identities: IdentityRule[]
    /** Versions published without an attestation, accepted on their registry integrity alone. */
    integrityOnly: string[]
  }
  lines: Line[]
}

const STATUSES: LineStatus[] = ['prerelease', 'current', 'maintained', 'archived']

/** The minor line a version belongs to: `4.1.0-beta.0` belongs to `4.1`. */
export function lineOf(version: string): string {
  const parsed = semver.parse(version)
  if (!parsed) throw new Error(`"${version}" is not a semver version.`)
  return `${parsed.major}.${parsed.minor}`
}

const byLine = (a: string, b: string) => semver.compare(`${a}.0`, `${b}.0`)

/** Throws, listing every problem, when the config does not have the shape the pipeline relies on. */
export function validateVersions(config: VersionsConfig): VersionsConfig {
  const problems: string[] = []
  if (!config.package) problems.push('package is missing')
  if (!semver.valid(config.since)) problems.push(`since "${config.since}" is not a version`)
  if (!config.provenance?.issuer) problems.push('provenance.issuer is missing')
  for (const rule of config.provenance?.identities ?? []) {
    if (!semver.validRange(rule.range)) problems.push(`identity range "${rule.range}" is not a semver range`)
    if (
      !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/\.github\/workflows\/[\w.-]+\.ya?ml@refs\/(heads|tags)\/[\w./-]+$/.test(
        rule.identity,
      )
    ) {
      problems.push(`identity "${rule.identity}" is not an exact GitHub workflow identity`)
    }
  }
  const seen = new Set<string>()
  for (const line of config.lines ?? []) {
    if (!STATUSES.includes(line.status)) problems.push(`line ${line.line} has an unknown status "${line.status}"`)
    if (!['readme', 'authored'].includes(line.guides))
      problems.push(`line ${line.line} has an unknown guide source "${line.guides}"`)
    for (const version of line.versions) {
      if (!semver.valid(version)) problems.push(`line ${line.line} lists "${version}", which is not a version`)
      else if (lineOf(version) !== line.line) problems.push(`${version} is listed under line ${line.line}`)
      if (seen.has(version)) problems.push(`${version} is listed twice`)
      seen.add(version)
    }
  }
  if ((config.lines ?? []).filter(line => line.status === 'current').length > 1)
    problems.push('more than one line is current')
  if ((config.lines ?? []).filter(line => line.status === 'prerelease').length > 1)
    problems.push('more than one line is in prerelease')
  if (problems.length > 0) throw new Error(`versions.json is invalid:\n  ${problems.join('\n  ')}`)
  return config
}

export function readVersions(path: string): VersionsConfig {
  return validateVersions(JSON.parse(readFileSync(path, 'utf8')) as VersionsConfig)
}

export function writeVersions(path: string, config: VersionsConfig): void {
  writeFileSync(path, `${JSON.stringify(validateVersions(config), null, 2)}\n`)
}

/** Every documented version, oldest first. */
export function allVersions(config: VersionsConfig): string[] {
  return config.lines.flatMap(line => line.versions).sort(semver.compare)
}

export function findLine(config: VersionsConfig, line: string): Line | undefined {
  return config.lines.find(entry => entry.line === line)
}

/** The newest version of a line. */
export function newestIn(line: Line): string {
  return [...line.versions].sort(semver.rcompare)[0]
}

/** The lines the aliases point at: `latest` is the current line, `next` the one in prerelease, if any. */
export function aliases(config: VersionsConfig): { latest?: string; next?: string } {
  return {
    latest: config.lines.find(line => line.status === 'current')?.line,
    next: config.lines.find(line => line.status === 'prerelease')?.line,
  }
}

/** Whose signature a version must carry, or `'integrity-only'` for a version listed as having none. */
export function identityFor(config: VersionsConfig, version: string): string | 'integrity-only' {
  if (config.provenance.integrityOnly.includes(version)) return 'integrity-only'
  const matches = config.provenance.identities.filter(rule =>
    semver.satisfies(version, rule.range, { includePrerelease: true }),
  )
  if (matches.length !== 1) {
    throw new Error(
      `${version} matches ${matches.length} provenance identities; versions.json must give it exactly one.`,
    )
  }
  return matches[0].identity
}

export interface AddResult {
  config: VersionsConfig
  /** The line created for this version, and the line its guides start from. */
  forked?: { line: string; from?: string }
  /** Lines whose status changed, as `4.0: current -> maintained`. */
  statusChanges: string[]
}

/**
 * Adds a published version: to its line, or to a new line forked from the newest one. A stable
 * version makes its line current, the previous current line maintained, and a maintained line with
 * two newer lines that are current or maintained archived. A new prerelease line archives an older
 * one still in prerelease.
 */
export function addVersion(config: VersionsConfig, version: string): AddResult {
  if (allVersions(config).includes(version)) return { config, statusChanges: [] }
  const next: VersionsConfig = structuredClone(config)
  const name = lineOf(version)
  const stable = semver.prerelease(version) === null
  const statusChanges: string[] = []
  const setStatus = (line: Line, status: LineStatus) => {
    if (line.status === status) return
    statusChanges.push(`${line.line}: ${line.status} -> ${status}`)
    line.status = status
  }

  let forked: AddResult['forked']
  let line = findLine(next, name)
  if (!line) {
    const newest = [...next.lines].sort((a, b) => byLine(b.line, a.line))[0]
    line = { line: name, status: stable ? 'current' : 'prerelease', guides: newest?.guides ?? 'readme', versions: [] }
    statusChanges.push(`${name}: new, ${line.status}`)
    // A line still in prerelease when a newer one starts will never be released: `next` moves on
    if (!stable) for (const other of next.lines) if (other.status === 'prerelease') setStatus(other, 'archived')
    next.lines.push(line)
    forked = { line: name, from: newest?.line }
  }
  line.versions = [...line.versions, version].sort(semver.compare)

  if (stable) {
    for (const other of next.lines) if (other !== line && other.status === 'current') setStatus(other, 'maintained')
    setStatus(line, 'current')
  }

  const ordered = [...next.lines].sort((a, b) => byLine(b.line, a.line))
  ordered.forEach((entry, index) => {
    const newerSupported = ordered
      .slice(0, index)
      .filter(newer => newer.status === 'current' || newer.status === 'maintained').length
    if (entry.status === 'maintained' && newerSupported >= 2) setStatus(entry, 'archived')
  })
  next.lines = ordered
  return { config: validateVersions(next), forked, statusChanges }
}
