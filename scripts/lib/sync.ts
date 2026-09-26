/**
 * Brings the repository up to date with the registry: every published version from versions.json's
 * `since` on, verified, gets its API document and changelog, joins its line, and the lines it
 * touched get their guides, migration guide and example pin refreshed.
 */

import { readdirSync, readFileSync } from 'fs'
import semver from 'semver'
import type { TrustedRoot } from '@sigstore/protobuf-specs'
import { generateApi } from './api.js'
import { parseChangelog, rewriteLibraryLinks, sliceChangelog } from './changelog.js'
import { configReference } from './config-reference.js'
import {
  forkContent,
  forkExamples,
  importLineReadme,
  linkAnchors,
  paths,
  pinExamples,
  writeApi,
  writeChangelog,
  writeJson,
  writeText,
} from './layout.js'
import { fetchMigrating, migratingFile } from './migrating.js'
import type { Fetch, Packument } from './registry.js'
import { apiKeys, computeSince, type SinceEntry } from './since.js'
import { fetchVerified, type VerifiedPackage } from './verified-package.js'
import { addVersion, findLine, lineOf, newestIn, type VersionsConfig } from './versions.js'
import type { JSONOutput } from 'typedoc'

export interface SyncDeps {
  packument: Packument
  trustedRoot: () => Promise<TrustedRoot>
  fetch?: Fetch
  log?: (message: string) => void
}

export interface SyncResult {
  config: VersionsConfig
  added: string[]
  statusChanges: string[]
}

/** The published versions the site documents but has not generated yet, oldest first. */
export function missingVersions(config: VersionsConfig, packument: Packument): string[] {
  const known = new Set(config.lines.flatMap(line => line.versions))
  return Object.keys(packument.versions)
    .filter(version => semver.gte(version, config.since) && !known.has(version))
    .sort(semver.compare)
}

/** Generates a version's API document and changelog from its verified package. */
export async function generateVersion(pkg: VerifiedPackage, config: VersionsConfig): Promise<void> {
  const line = lineOf(pkg.version)
  writeApi(
    await generateApi(pkg.dir, {
      package: config.package,
      version: pkg.version,
      integrity: pkg.integrity,
      commit: pkg.provenance?.commit,
    }),
  )
  const section = rewriteLibraryLinks(sliceChangelog(pkg.changelog(), pkg.version), line, linkAnchors(config, line))
  writeChangelog(parseChangelog(pkg.version, section, pkg.published))
}

/** Rewrites since.json from every API document in the repository. */
export function refreshSince(): void {
  const keysByVersion: Record<string, Set<string>> = {}
  for (const file of readdirSync(paths.apiDir).filter(name => name.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(`${paths.apiDir}/${file}`, 'utf8')) as {
      meta: { version: string }
      project: JSONOutput.ProjectReflection
    }
    keysByVersion[doc.meta.version] = apiKeys(doc.project)
  }
  writeJson(paths.since, computeSince(keysByVersion))
}

/** Rewrites each version's configuration reference from its API document and since.json. */
export function refreshConfig(): void {
  const since = JSON.parse(readFileSync(paths.since, 'utf8')) as Record<string, SinceEntry>
  for (const file of readdirSync(paths.apiDir).filter(name => name.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(`${paths.apiDir}/${file}`, 'utf8')) as {
      meta: { version: string }
      project: JSONOutput.ProjectReflection
    }
    const reference = configReference(doc.meta.version, doc.project, since)
    if (reference) writeJson(paths.config(doc.meta.version), reference)
  }
}

/**
 * Refreshes what a line takes from its newest version: its imported guides, example pin and
 * migration guide. Does nothing when `pkg` is not the line's newest version.
 */
export async function refreshLine(
  config: VersionsConfig,
  pkg: VerifiedPackage,
  deps: Pick<SyncDeps, 'fetch' | 'log'> = {},
): Promise<void> {
  const line = findLine(config, lineOf(pkg.version))!
  if (newestIn(line) !== pkg.version) return
  if (line.guides === 'readme') importLineReadme(line.line, pkg.version, pkg.readme(), pkg.provenance?.commit)
  pinExamples(line.line, pkg.version)
  if (!pkg.provenance) {
    ;(deps.log ?? console.log)(`${line.line}: ${pkg.version} has no provenance, so its migration guide is not imported`)
    return
  }
  const migrating = await fetchMigrating(pkg.provenance.commit, deps.fetch)
  writeText(
    paths.migrating(line.line),
    migratingFile(migrating, {
      line: line.line,
      version: pkg.version,
      commit: pkg.provenance.commit,
      anchors: linkAnchors(config, line.line),
    }),
  )
}

export async function sync(config: VersionsConfig, deps: SyncDeps): Promise<SyncResult> {
  const log = deps.log ?? console.log
  const added: string[] = []
  const statusChanges: string[] = []
  const touched = new Map<string, VerifiedPackage>()

  for (const version of missingVersions(config, deps.packument)) {
    log(`${version}: verifying`)
    const pkg = await fetchVerified(config, deps.packument, version, deps.trustedRoot, deps.fetch)
    try {
      const result = addVersion(config, version)
      config = result.config
      statusChanges.push(...result.statusChanges)
      const line = findLine(config, lineOf(version))!
      if (result.forked?.from) {
        if (line.guides === 'authored') forkContent(result.forked.from, line.line)
        forkExamples(result.forked.from, line.line, version)
      }
      // The line's README is imported before its changelog, whose links resolve against it
      if (line.guides === 'readme' && newestIn(line) === version)
        importLineReadme(line.line, version, pkg.readme(), pkg.provenance?.commit)
      await generateVersion(pkg, config)
      added.push(version)
      log(`${version}: generated`)
    } finally {
      const previous = touched.get(lineOf(version))
      if (previous && previous !== pkg) previous.remove()
      touched.set(lineOf(version), pkg)
    }
  }

  for (const pkg of touched.values()) {
    try {
      await refreshLine(config, pkg, deps)
    } finally {
      pkg.remove()
    }
  }

  if (added.length > 0) {
    refreshSince()
    refreshConfig()
  }
  return { config, added, statusChanges }
}

/** The pull request body for a sync. */
export function syncSummary({ added, statusChanges }: SyncResult): string {
  return [
    `Adds ${added.map(version => `\`${version}\``).join(', ')}, each verified against its registry integrity and provenance.`,
    '',
    ...(statusChanges.length > 0 ? ['Line status:', ...statusChanges.map(change => `- ${change}`), ''] : []),
    'Review the generated API documents and changelogs for anything unexpected before merging.',
  ].join('\n')
}
