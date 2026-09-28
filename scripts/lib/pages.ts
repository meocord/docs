/**
 * The site's read side of the content: a line's pages, from whichever folder its `guides` selects,
 * with an authored line's generated configuration reference, and the code an ::example directive embeds. For server code only; it reads the repository's files.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { CONFIG_REFERENCE_SLUG, configReferencePage, type ConfigDocument } from './config-reference'
import { parsePage, type Frontmatter } from './content'
import { withPackageSpec } from './package-spec'
import { asOf } from './steps'
import { newestIn, type VersionsConfig } from './versions'

export interface PageEntry {
  id: string
  slug: string
  title: string
  section?: string
  order: number
  /** `readme@<version>` for a page imported from a README, which the site marks as such. */
  source?: string
  since?: string
  formerly: string[]
}

export interface Page {
  frontmatter: Frontmatter
  body: string
}

interface Options {
  /** The repository root; the site reads it at build time, from the working directory. */
  root?: string
}

interface ExampleOptions extends Options {
  /** The Guide page it is shown on, which decides the tutorial steps it shows; the finished file without one. */
  page?: string
}

function versions(root: string): VersionsConfig {
  return JSON.parse(readFileSync(path.join(root, 'versions.json'), 'utf8')) as VersionsConfig
}

/** The folder the site shows a line's guides from: content/<line> once authored, else its imported README. */
export function pagesDir(line: string, { root = process.cwd() }: Options = {}): string {
  const entry = versions(root).lines.find(candidate => candidate.line === line)
  if (!entry) throw new Error(`Line "${line}" is not in versions.json.`)
  return entry.guides === 'authored' ? path.join(root, 'content', line) : path.join(root, 'generated', 'readme', line)
}

/** A page file of a line as the site shows it, with the line's package spec in place of `{{meocord}}`. */
function readPageFile(file: string, line: string, config: VersionsConfig): string {
  return withPackageSpec(readFileSync(file, 'utf8'), config, line)
}

/** A line's migration guide, from content/migrating/<line>.md; undefined for a line without one. */
export function migratingGuide(line: string, { root = process.cwd() }: Options = {}): string | undefined {
  const file = path.join(root, 'content', 'migrating', `${line}.md`)
  return existsSync(file) ? readPageFile(file, line, versions(root)) : undefined
}

/**
 * The configuration reference page of an authored line, generated from its newest version's
 * `generated/config/<version>.json`; undefined for a line showing its README, or without the file.
 */
export function configPage(line: string, { root = process.cwd() }: Options = {}): string | undefined {
  const entry = versions(root).lines.find(candidate => candidate.line === line)
  if (entry?.guides !== 'authored' || entry.versions.length === 0) return undefined
  const file = path.join(root, 'generated', 'config', `${newestIn(entry)}.json`)
  if (!existsSync(file)) return undefined
  return configReferencePage(line, JSON.parse(readFileSync(file, 'utf8')) as ConfigDocument)
}

/** A line's pages, in sidebar order: by `order`, then title. */
export function listPages(line: string, options: Options = {}): PageEntry[] {
  const config = versions(options.root ?? process.cwd())
  const dir = pagesDir(line, options)
  const files: [string, string][] = existsSync(dir)
    ? readdirSync(dir)
        .filter(file => file.endsWith('.md'))
        .map(file => [file.replace(/\.md$/, ''), readPageFile(path.join(dir, file), line, config)])
    : []
  const reference = configPage(line, options)
  if (reference) files.push([CONFIG_REFERENCE_SLUG, reference])
  return files
    .map(([slug, text]) => {
      const { frontmatter } = parsePage(text)
      return {
        id: frontmatter.id ?? slug,
        slug,
        title: frontmatter.title ?? slug,
        section: frontmatter.section,
        order: frontmatter.order ?? Number.MAX_SAFE_INTEGER,
        source: frontmatter.source,
        since: frontmatter.since,
        formerly: frontmatter.formerly ?? [],
      }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

/** One page of a line, or undefined when the line has no page with that slug. */
export function loadPage(line: string, slug: string, options: Options = {}): Page | undefined {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return undefined
  if (slug === CONFIG_REFERENCE_SLUG) {
    const config = configPage(line, options)
    if (config) return parsePage(config)
  }
  const file = path.join(pagesDir(line, options), `${slug}.md`)
  return existsSync(file) ? parsePage(readPageFile(file, line, versions(options.root ?? process.cwd()))) : undefined
}

/**
 * The code an ::example embeds: a file under examples/<line>/src/, or its region. A tutorial file is
 * taken as it stands at the page shown on (see steps.ts).
 */
export function resolveExample(
  line: string,
  file: string,
  region?: string,
  { root = process.cwd(), page }: ExampleOptions = {},
): string {
  const base = path.join(root, 'examples', line, 'src')
  const full = path.resolve(base, file)
  if (!full.startsWith(base + path.sep)) throw new Error(`Example "${file}" is outside examples/${line}/src.`)
  if (!existsSync(full)) throw new Error(`examples/${line}/src/${file} does not exist.`)
  const code = excerpt(asOf(readFileSync(full, 'utf8'), page), region)
  if (code === undefined) throw new Error(`examples/${line}/src/${file} has no region "${region}".`)
  return code
}

/**
 * A file's code, or a region's: every block between its `// #region <name>` and `// #endregion <name>`
 * in file order, each dedented, with `// …` between them, since a step adds an import at the top and a
 * decorator further down. Other region markers are dropped; undefined when the region has no block.
 */
export function excerpt(source: string, region?: string): string | undefined {
  const lines = source.split('\n')
  const blocks: string[][] = region ? [] : [lines]
  let block: string[] | undefined
  if (region)
    for (const text of lines) {
      if (text.trim() === `// #region ${region}`) block = []
      else if (text.trim() === `// #endregion ${region}` && block) {
        blocks.push(block)
        block = undefined
      } else block?.push(text)
    }
  if (blocks.length === 0) return undefined
  return blocks.map(dedent).join('\n// …\n')
}

/** A block's code without region markers, dedented and trimmed. */
function dedent(block: string[]): string {
  const lines = block.filter(text => !/^\s*\/\/ #(end)?region\b/.test(text))
  const indent = Math.min(...lines.filter(text => text.trim()).map(text => /^\s*/.exec(text)![0].length))
  return lines
    .map(text => text.slice(Number.isFinite(indent) ? indent : 0))
    .join('\n')
    .trim()
}
