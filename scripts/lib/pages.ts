/**
 * The site's read side of the content: a line's pages, from whichever folder its `guides` selects,
 * and the code an ::example directive embeds. For server code only; it reads the repository's files.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { parsePage, type Frontmatter } from './content.js'
import type { VersionsConfig } from './versions.js'

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

function versions(root: string): VersionsConfig {
  return JSON.parse(readFileSync(path.join(root, 'versions.json'), 'utf8')) as VersionsConfig
}

/** The folder the site shows a line's guides from: content/<line> once authored, else its imported README. */
export function pagesDir(line: string, { root = process.cwd() }: Options = {}): string {
  const entry = versions(root).lines.find(candidate => candidate.line === line)
  if (!entry) throw new Error(`Line "${line}" is not in versions.json.`)
  return entry.guides === 'authored' ? path.join(root, 'content', line) : path.join(root, 'generated', 'readme', line)
}

/** A line's pages, in sidebar order: by `order`, then title. */
export function listPages(line: string, options: Options = {}): PageEntry[] {
  const dir = pagesDir(line, options)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const { frontmatter } = parsePage(readFileSync(path.join(dir, file), 'utf8'))
      const slug = file.replace(/\.md$/, '')
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
  const file = path.join(pagesDir(line, options), `${slug}.md`)
  return existsSync(file) ? parsePage(readFileSync(file, 'utf8')) : undefined
}

/**
 * The code an ::example embeds: a file under examples/<line>/src/, or the lines between its
 * `// #region <name>` and `// #endregion <name>`, dedented, with any other region markers dropped.
 */
export function resolveExample(
  line: string,
  file: string,
  region?: string,
  { root = process.cwd() }: Options = {},
): string {
  const base = path.join(root, 'examples', line, 'src')
  const full = path.resolve(base, file)
  if (!full.startsWith(base + path.sep)) throw new Error(`Example "${file}" is outside examples/${line}/src.`)
  if (!existsSync(full)) throw new Error(`examples/${line}/src/${file} does not exist.`)
  let lines = readFileSync(full, 'utf8').split('\n')
  if (region) {
    const start = lines.findIndex(text => text.trim() === `// #region ${region}`)
    const end = lines.findIndex(text => text.trim() === `// #endregion ${region}`)
    if (start === -1 || end <= start) throw new Error(`examples/${line}/src/${file} has no region "${region}".`)
    lines = lines.slice(start + 1, end)
  }
  lines = lines.filter(text => !/^\s*\/\/ #(end)?region\b/.test(text))
  const indent = Math.min(...lines.filter(text => text.trim()).map(text => /^\s*/.exec(text)![0].length))
  return lines
    .map(text => text.slice(Number.isFinite(indent) ? indent : 0))
    .join('\n')
    .trim()
}
