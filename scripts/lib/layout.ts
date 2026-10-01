/**
 * Where the pipeline's files live in the repository, and the writes that keep a line's content,
 * examples and generated data in step with versions.json.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import type { ApiDocument } from './api.js'
import type { AnchorTarget, ChangelogDocument } from './changelog.js'
import { pageAnchors } from './content.js'
import { readGuide } from './guide.js'
import { withPlaceholder } from './package-spec.js'
import { importReadme, pageFile } from './readme.js'
import type { VersionsConfig } from './versions.js'
import { README_SECTIONS } from '../../src/config/readme-sections.js'

/** The repository root; the pipeline's tests point it at a scratch directory. */
export const ROOT = process.env.MEOCORD_DOCS_ROOT ?? path.resolve(import.meta.dirname, '..', '..')

export const paths = {
  versions: path.join(ROOT, 'versions.json'),
  api: (version: string) => path.join(ROOT, 'generated', 'api', `${version}.json`),
  apiDir: path.join(ROOT, 'generated', 'api'),
  changelog: (version: string) => path.join(ROOT, 'generated', 'changelog', `${version}.json`),
  config: (version: string) => path.join(ROOT, 'generated', 'config', `${version}.json`),
  cli: (version: string) => path.join(ROOT, 'generated', 'cli', `${version}.json`),
  /** A line's migration guide, written by people; a line without one has no Migrating page. */
  migrating: (line: string) => path.join(ROOT, 'content', 'migrating', `${line}.md`),
  since: path.join(ROOT, 'generated', 'since.json'),
  readmeAnchors: (line: string) => path.join(ROOT, 'generated', 'readme-anchors', `${line}.json`),
  /** A line's Guide, written by people; the pipeline only creates a new line's folder. */
  content: (line: string) => path.join(ROOT, 'content', line),
  /** A line's guides imported from its README, which the site shows until the line's guides are authored. */
  readme: (line: string) => path.join(ROOT, 'generated', 'readme', line),
  examples: (line: string) => path.join(ROOT, 'examples', line),
  /** The URLs the deployed site answers, which scripts/live-routes.ts records from a build of it. */
  liveRoutes: path.join(ROOT, 'e2e', 'fixtures', 'live-routes.json'),
}

function write(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

/** API documents are indented by one space: reviewable in a diff, without doubling their size. */
export function writeApi(doc: ApiDocument): void {
  write(paths.api(doc.meta.version), `${JSON.stringify(doc, null, 1)}\n`)
}

export function writeChangelog(doc: ChangelogDocument): void {
  write(paths.changelog(doc.version), `${JSON.stringify(doc, null, 2)}\n`)
}

export function writeJson(file: string, value: unknown): void {
  write(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeText(file: string, text: string): void {
  write(file, text)
}

/** Replaces a line's imported guides with the pages of a version's README; returns its anchors. */
export function importLineReadme(
  line: string,
  version: string,
  readme: string,
  commit: string | undefined,
): Record<string, string> {
  const commitUrl = `https://github.com/meocord/meocord/blob/${commit ?? `v${version}`}`
  const { pages, anchors } = importReadme(readme, { line, commitUrl })
  const dir = paths.readme(line)
  rmSync(dir, { recursive: true, force: true })
  // Its create commands install the line's version, as a written page's do
  for (const page of pages)
    write(path.join(dir, `${page.slug}.md`), withPlaceholder(pageFile(page, `readme@${version}`)))
  writeJson(paths.readmeAnchors(line), anchors)
  return anchors
}

/** The README anchors of a line whose guides were imported: which page holds each heading. */
export function lineAnchors(line: string): Record<string, string> {
  const file = paths.readmeAnchors(line)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {}
}

/**
 * Where README anchors land in a line's Guide: a README section's anchor on the page with that id, or
 * that id among its `formerly`; any other anchor on the page with a heading of that name.
 */
export function authoredAnchors(line: string): Record<string, AnchorTarget> {
  const pages = readGuide(line, ROOT).map(({ page, body }) => ({
    target: { slug: page.id, group: page.group === 'help' ? undefined : page.group },
    ids: [page.id, ...page.formerly],
    body,
    terms: page.terms,
  }))
  const anchors: Record<string, AnchorTarget> = {}
  for (const { target, ids } of pages) for (const id of ids) anchors[id] = target
  for (const { target, body, terms } of pages)
    for (const anchor of pageAnchors(body, { terms })) anchors[anchor] ??= { ...target, anchor }
  return anchors
}

/**
 * The anchor map a line's changelogs resolve README links through: for an authored line, its pages' ids
 * and headings, with the sections README_SECTIONS places over them.
 */
export function linkAnchors(config: VersionsConfig, line: string): Record<string, AnchorTarget> {
  const entry = config.lines.find(candidate => candidate.line === line)
  return entry?.guides === 'authored' ? { ...authoredAnchors(line), ...README_SECTIONS[line] } : lineAnchors(line)
}

/** Starts a new line's authored guides from another line's; an existing line's folder is never touched. */
export function forkContent(from: string, to: string): void {
  if (existsSync(paths.content(to)))
    throw new Error(`content/${to} already exists; a line's guides are forked only once.`)
  cpSync(paths.content(from), paths.content(to), { recursive: true })
}

/** Starts a line's example workspace from another's, pinned to `version`. */
export function forkExamples(from: string, to: string, version: string): void {
  if (!existsSync(paths.examples(from))) return
  cpSync(paths.examples(from), paths.examples(to), {
    recursive: true,
    filter: source => !source.includes('node_modules'),
  })
  pinExamples(to, version)
}

/** Pins a line's example workspace to the exact version its examples are checked against. */
export function pinExamples(line: string, version: string): void {
  const file = path.join(paths.examples(line), 'package.json')
  if (!existsSync(file)) return
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  manifest.name = `examples-${line.replace('.', '-')}`
  manifest.dependencies = { ...manifest.dependencies, meocord: version }
  writeJson(file, manifest)
}
