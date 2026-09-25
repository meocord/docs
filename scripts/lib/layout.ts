/**
 * Where the pipeline's files live in the repository, and the writes that keep a line's content,
 * examples and generated data in step with versions.json.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import type { ApiDocument } from './api.js'
import type { ChangelogDocument } from './changelog.js'
import { importReadme, pageFile } from './readme.js'

/** The repository root; the pipeline's tests point it at a scratch directory. */
export const ROOT = process.env.MEOCORD_DOCS_ROOT ?? path.resolve(import.meta.dirname, '..', '..')

export const paths = {
  versions: path.join(ROOT, 'versions.json'),
  api: (version: string) => path.join(ROOT, 'generated', 'api', `${version}.json`),
  apiDir: path.join(ROOT, 'generated', 'api'),
  changelog: (version: string) => path.join(ROOT, 'generated', 'changelog', `${version}.json`),
  migrating: (line: string) => path.join(ROOT, 'generated', 'migrating', `${line}.md`),
  since: path.join(ROOT, 'generated', 'since.json'),
  readmeAnchors: (line: string) => path.join(ROOT, 'generated', 'readme-anchors', `${line}.json`),
  content: (line: string) => path.join(ROOT, 'content', line),
  examples: (line: string) => path.join(ROOT, 'examples', line),
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

/** Replaces a line's guides with the pages imported from a version's README; returns its anchors. */
export function importLineReadme(
  line: string,
  version: string,
  readme: string,
  commit: string | undefined,
): Record<string, string> {
  const commitUrl = `https://github.com/meocord/meocord/blob/${commit ?? `v${version}`}`
  const { pages, anchors } = importReadme(readme, { line, commitUrl })
  const dir = paths.content(line)
  rmSync(dir, { recursive: true, force: true })
  for (const page of pages) write(path.join(dir, `${page.slug}.md`), pageFile(page, `readme@${version}`))
  writeJson(paths.readmeAnchors(line), anchors)
  return anchors
}

/** The README anchors of a line whose guides were imported: which page holds each heading. */
export function lineAnchors(line: string): Record<string, string> {
  const file = paths.readmeAnchors(line)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {}
}

/** Starts a line's guides from another line's, for a line whose guides are written for the site. */
export function forkContent(from: string, to: string): void {
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
