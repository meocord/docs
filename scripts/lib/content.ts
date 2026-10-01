/**
 * The rules the repository's content keeps: pages with an id and a title, examples that exist,
 * TypeScript only in typechecked example files, internal links and anchors that resolve, and
 * generated data for every version versions.json lists.
 */

import { type AnchorOptions, pageAnchorSet } from '../../src/lib/prose/anchors'
import { parse as parseYaml } from 'yaml'
import type { ChangelogDocument } from './changelog'
import { CONFIG_REFERENCE_SLUG, configReferencePage, type ConfigDocument } from './config-reference'
import { isKnownLanguage } from '../../src/lib/prose/languages'
import { markdownLinkNodes } from './markdown-links'
import type { Nodes } from 'mdast'
import { markdownTree, nodesOf } from './markdown-tree'
import { markdownAnchors } from './migrating'
import { parseStored } from './stored-links'
import { newestIn, type VersionsConfig } from './versions'

/** A line's API as the site renders it: a symbol's page by section and name, with the anchors on it. */
export interface ApiLookup {
  symbol(section: string, name: string): { anchors: string[] } | undefined
}

export interface SiteSnapshot {
  config: VersionsConfig
  /** Authored pages per line, from content/<line>/, keyed by slug, as written on disk. */
  authored: Record<string, Record<string, string>>
  /** Pages imported from a README per line, from generated/readme/<line>/, keyed by slug. */
  readme: Record<string, Record<string, string>>
  readmeAnchors: Record<string, Record<string, string>>
  migrating: Record<string, string | undefined>
  changelogs: Record<string, ChangelogDocument | undefined>
  apis: Set<string>
  /** Each version's configuration reference, from generated/config/<version>.json. */
  configs: Record<string, ConfigDocument | undefined>
  /** Example files per line, and for `compare`, keyed by their path under examples/<name>/. */
  examples: Record<string, Record<string, string>>
  /** A line's API, or an exact version's; undefined where there is none, or when API links go unchecked. */
  api?: (line: string, version?: string) => ApiLookup | undefined
}

export interface Frontmatter {
  id?: string
  title?: string
  /** The sidebar group the page belongs to. */
  section?: string
  order?: number
  /** For a page imported from a README, `readme@<version>`. */
  source?: string
  /** The first version the page's topic exists in. */
  since?: string
  /** Ids the page had in earlier lines, so the version switcher lands on it from them. */
  formerly?: string[]
  /** A Guide appendix page's group; a recipe's and a coming-from page's is part of its path. */
  group?: string
}

export function parsePage(text: string): { frontmatter: Frontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { frontmatter: {}, body: text }
  return { frontmatter: (parseYaml(match[1]) ?? {}) as Frontmatter, body: text.slice(match[0].length) }
}

/** Markdown with fenced and inline code blanked out, so links and directives inside code are not read. */
export function withoutCode(markdown: string): string {
  let fence: string | undefined
  return markdown
    .split('\n')
    .map(line => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker && (!fence || marker.startsWith(fence))) {
        fence = fence ? undefined : marker
        return ''
      }
      return fence ? '' : line.replace(/`[^`\n]*`/g, '')
    })
    .join('\n')
}

/** Whether an example's source has the region `// #region <name>` … `// #endregion <name>`. */
export function hasRegion(source: string, region: string): boolean {
  return source.includes(`// #region ${region}\n`) && source.includes(`// #endregion ${region}`)
}

export function markdownLinks(markdown: string): string[] {
  return markdownLinkNodes(markdown).map(link => link.url)
}

/** The width content wraps prose at; a line may run past it only where nothing in it could break sooner. */
export const PROSE_WIDTH = 120

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })
// Characters a terminal, and Prettier, give two columns: East Asian wide and fullwidth ones, and emoji
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{20000}-\u{3FFFD}]|\p{Extended_Pictographic}/u

/** How many columns a text takes, as Prettier counts them: two for a wide character or an emoji, one for any other. */
export function textWidth(text: string): number {
  let width = 0
  for (const { segment } of graphemes.segment(text)) width += WIDE.test(segment) ? 2 : 1
  return width
}

/**
 * The lines of a Markdown file that run past PROSE_WIDTH though they could have wrapped: a paragraph's line with a
 * space within the width to break at. Only paragraphs are prose, so headings, code, tables, HTML and link
 * definitions are left alone; a code span, a link, an image or inline HTML is no place to break, so a line that is
 * one long URL, link or code span passes; and a line's quote markers and indent are not its text.
 */
export function overlongLines(markdown: string, width = PROSE_WIDTH): { line: number; length: number }[] {
  const { tree, body } = markdownTree(markdown)
  const unbreakable: [number, number][] = []
  const paragraphs: { start: number; end: number; startLine: number; endLine: number }[] = []
  for (const node of nodesOf(tree)) {
    if (!node.position) continue
    const { start, end } = node.position
    if (node.type === 'paragraph')
      paragraphs.push({ start: start.offset!, end: end.offset!, startLine: start.line, endLine: end.line })
    else if (['inlineCode', 'link', 'linkReference', 'image', 'imageReference', 'html'].includes(node.type))
      unbreakable.push([start.offset!, end.offset!])
  }
  const lines = body.split('\n')
  const lineStart: number[] = []
  lines.reduce((offset, text, index) => ((lineStart[index] = offset), offset + text.length + 1), 0)
  const found = new Map<number, number>()
  for (const paragraph of paragraphs)
    for (let line = paragraph.startLine; line <= paragraph.endLine; line++) {
      const text = lines[line - 1]
      const length = textWidth(text)
      if (length <= width || found.has(line)) continue
      const base = lineStart[line - 1]
      // The paragraph's own text on the line: after its first line's start, or a later line's quote markers and indent
      const from = line === paragraph.startLine ? paragraph.start - base : /^[\s>]*/.exec(text)![0].length
      for (let column = from; column < text.length; column++) {
        const offset = base + column
        if (text[column] !== ' ' || unbreakable.some(([a, b]) => offset >= a && offset < b)) continue
        if (textWidth(text.slice(0, column)) <= width) found.set(line, length)
        break
      }
    }
  return [...found].sort(([a], [b]) => a - b).map(([line, length]) => ({ line, length }))
}

/** A gendered third-person pronoun, as a whole word in any case; content says they, them and their. */
const GENDERED = /\b(she|her|hers|herself|he|him|his|himself)\b/gi

/** A URL, with a scheme or from `www.`: an address, not prose. */
const ADDRESS = /\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)[^\s<>"'`]+/gi

/** Each gendered pronoun in a text, by its 1-based line, with the word as written; URLs are not read. */
export function gendered(text: string, lineOf: (offset: number) => number): { line: number; word: string }[] {
  // Blanked rather than removed, so each match keeps its offset
  const prose = text.replace(ADDRESS, address => ' '.repeat(address.length))
  return [...prose.matchAll(GENDERED)].map(match => ({ line: lineOf(match.index), word: match[0] }))
}

/**
 * The gendered pronouns of a Markdown file, by line: in its front matter, in the text of its prose as the site
 * parses it, and in the alt text and titles readers see. Code, URLs, link labels and HTML are not read.
 */
export function genderedInMarkdown(markdown: string): { line: number; word: string }[] {
  const { tree, frontMatterLines } = markdownTree(markdown)
  const found = markdown
    .split('\n')
    .slice(0, frontMatterLines)
    .flatMap((text, index) => gendered(text, () => index + 1))
  // An autolink or a bare URL shows its address as its text; a written link's text is prose
  const address = (node: Nodes) =>
    node.type === 'link' &&
    node.children.length === 1 &&
    node.children[0].type === 'text' &&
    node.url.replace(/^mailto:/, '').endsWith(node.children[0].value.replace(/^mailto:/, ''))
  const visit = (node: Nodes) => {
    if (address(node)) return
    if (node.type === 'text' && node.position) {
      const first = node.position.start.line
      found.push(...gendered(node.value, index => first + node.value.slice(0, index).split('\n').length - 1))
    }
    // An image's alt text, and a link's, image's or definition's title, reported at the node's first line
    const { alt, title } = node as { alt?: unknown; title?: unknown }
    for (const value of [alt, title])
      if (typeof value === 'string' && node.position) found.push(...gendered(value, () => node.position!.start.line))
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(tree)
  return found.sort((a, b) => a.line - b.line)
}

/** The language each opening code fence names, in order; an unmarked fence names none. */
export function fenceLanguages(markdown: string): string[] {
  const languages: string[] = []
  let fence: string | undefined
  for (const line of markdown.split('\n')) {
    const match = /^\s*(`{3,}|~{3,})\s*([^\s`{]*)/.exec(line)
    if (!match) continue
    if (!fence) {
      fence = match[1]
      if (match[2]) languages.push(match[2])
    } else if (match[1].startsWith(fence) && !match[2]) fence = undefined
  }
  return languages
}

const TYPESCRIPT_FENCE = /^\s*(`{3,}|~{3,})\s*(ts|typescript|tsx|mts|cts|js|javascript)\b/m
const EXAMPLE = /::example\{([^}]*)\}/g
const GITHUB_MIGRATING = /^https:\/\/github\.com\/meocord\/meocord\/(?:blob|tree)\/[^/]+\/docs\/MIGRATING\.md(#.*)?$/
// A link to the site's docs by its address, which content stores as the path its checks read
const SELF_LINK = /^https?:\/\/(?:www\.)?meocord\.dev(\/docs(?:[/#].*)?)$/
// A section of the library's README, which the site's pages cover
const GITHUB_README =
  /^https:\/\/github\.com\/(?:l7aromeo|meocord)\/meocord(?:\/blob\/[^/]+\/README\.md(?:#.*)?|\/?#.+)$/
/** The one examples folder an ::example may name with `from`, beside its own line's. */
export const EXAMPLE_SOURCE = 'compare'

/**
 * The anchors of a page's headings, as GitHub and the site give them, and of its terms on a page that
 * defines terms, such as the glossary.
 */
export function pageAnchors(body: string, options: AnchorOptions = {}): Set<string> {
  return pageAnchorSet(body, options)
}

type PageSet = 'authored' | 'readme'

const folder = (set: PageSet, line: string) => (set === 'authored' ? `content/${line}` : `generated/readme/${line}`)

export function checkSite(snapshot: SiteSnapshot): string[] {
  const problems: string[] = []
  const lines = new Map(snapshot.config.lines.map(line => [line.line, line]))
  // An authored line shows its newest version's configuration reference as one of its pages
  const authored = { ...snapshot.authored }
  for (const line of snapshot.config.lines) {
    const doc = snapshot.configs[newestIn(line)]
    if (line.guides !== 'authored' || !doc) continue
    if (authored[line.line]?.[CONFIG_REFERENCE_SLUG] !== undefined)
      problems.push(`content/${line.line}/${CONFIG_REFERENCE_SLUG}.md: the configuration reference is generated`)
    authored[line.line] = { ...authored[line.line], [CONFIG_REFERENCE_SLUG]: configReferencePage(line.line, doc) }
  }
  const site = { ...snapshot, authored }

  // A symbol's page, and its member's anchor, as the site renders the API the link names
  const apiLinkProblem = (
    link: { line: string; section: string; symbol: string; member?: string; version?: string },
    versions: string[],
  ): string | undefined => {
    if (link.version !== undefined && !versions.includes(link.version)) return `names no version of ${link.line}`
    const api = site.api?.(link.line, link.version)
    if (!api) return undefined
    const symbol = api.symbol(link.section, link.symbol)
    if (!symbol) return `names no symbol of ${link.version ?? link.line}'s API`
    if (link.member && !symbol.anchors.includes(link.member)) return `names no member of ${link.symbol}`
    return undefined
  }
  // An authored line's pages by the path the site serves each at, its group's folder first for a recipe or a
  // coming-from page, and by each old slug its front matter says redirects to it
  const served = new Map<string, Map<string, string>>()
  const servedAt = (line: string): Map<string, string> => {
    if (!served.has(line)) {
      const paths = new Map<string, string>()
      for (const [file, text] of Object.entries(site.authored[line] ?? {})) {
        const { frontmatter } = parsePage(text)
        const id = frontmatter.id ?? file
        const group =
          frontmatter.group === 'recipes' || frontmatter.group === 'coming-from' ? frontmatter.group : undefined
        paths.set(group ? `${group}/${id}` : id, file)
        for (const old of frontmatter.formerly ?? []) if (!paths.has(old)) paths.set(old, file)
      }
      served.set(line, paths)
    }
    return served.get(line)!
  }

  // The set the site shows for a line: its imported pages until its guides are authored
  const shown = (line: string): PageSet => (lines.get(line)?.guides === 'authored' ? 'authored' : 'readme')

  const anchorsOf = (set: PageSet, line: string, slug: string): Set<string> => {
    const text = site[set][line]?.[slug]
    const anchors = text ? pageAnchors(parsePage(text).body) : new Set<string>()
    if (set === 'readme')
      for (const [anchor, page] of Object.entries(site.readmeAnchors[line] ?? {}))
        if (page === slug) anchors.add(anchor)
    return anchors
  }

  /**
   * Checks a text's links. A link into the text's own line resolves in the text's own set, so pages
   * authored ahead of a line's switch link each other; any other link resolves in what the site shows.
   */
  const checkLinks = (
    where: string,
    markdown: string,
    from: { line: string; set: PageSet } | undefined,
    ownAnchors: () => Set<string>,
  ) => {
    for (const target of markdownLinks(markdown)) {
      // The site serves each line's migration guide; linking its copy lets the anchor be checked.
      const migrating = GITHUB_MIGRATING.exec(target)
      if (migrating && from?.set === 'authored') {
        problems.push(
          `${where}: ${target} links the migration guide on GitHub; write /docs/${from.line}/migrating${migrating[1] ?? ''}`,
        )
        continue
      }
      const self = SELF_LINK.exec(target)
      if (self) {
        problems.push(`${where}: ${target} links the site by its address; write ${self[1]}`)
        continue
      }
      if (GITHUB_README.test(target)) {
        problems.push(`${where}: ${target} links a section of meocord's README; link the site's page for it`)
        continue
      }
      if (target.startsWith('#')) {
        if (!ownAnchors().has(target.slice(1))) problems.push(`${where}: no heading for ${target}`)
        continue
      }
      if (!target.startsWith('/docs/') && target !== '/docs') {
        const relative = !/^[a-z][\w+.-]*:/i.test(target)
        if (relative && (target.startsWith('/') || /^\.\.?\//.test(target) || /\.md(#|$)/.test(target))) {
          problems.push(`${where}: ${target} does not point at a page of the site`)
        }
        continue
      }
      const parsed = parseStored(target, [...lines.keys()])
      if ('problem' in parsed) {
        problems.push(`${where}: ${target} ${parsed.problem}`)
        continue
      }
      const link = parsed.target
      const line = lines.get(link.line)!
      if (link.kind === 'line' || link.kind === 'missing' || link.kind === 'api-index') continue
      // A playground exists for a line whose guides the site writes, the lines the build makes a runtime for
      if (link.kind === 'playground') {
        if (line.guides !== 'authored')
          problems.push(`${where}: ${target} links a playground ${link.line} does not have`)
        continue
      }
      if (link.kind === 'api') {
        const problem = apiLinkProblem(link, line.versions)
        if (problem) problems.push(`${where}: ${target} ${problem}`)
        continue
      }
      if (link.kind === 'changelog') {
        if (link.version !== undefined && !line.versions.includes(link.version))
          problems.push(`${where}: ${target} names no version of ${link.line}`)
        continue
      }
      if (link.kind === 'migrating') {
        const guide = site.migrating[link.line]
        if (!guide) problems.push(`${where}: ${target} links a migration guide ${link.line} does not have`)
        else if (link.anchor && !markdownAnchors(guide).includes(link.anchor))
          problems.push(`${where}: ${target} names no heading of the migration guide`)
        continue
      }
      const set = from?.line === link.line ? from.set : shown(link.line)
      const path = link.group ? `${link.group}/${link.slug}` : link.slug
      const file = set === 'authored' ? servedAt(link.line).get(path) : path
      if (!file || !site[set][link.line]?.[file]) {
        problems.push(`${where}: ${target} names no page of ${folder(set, link.line)}`)
        continue
      }
      if (link.anchor && !anchorsOf(set, link.line, file).has(link.anchor))
        problems.push(`${where}: ${target} names no heading of that page`)
    }
  }

  const checkPages = (set: PageSet, name: string) => {
    const ids = new Map<string, string>()
    for (const [slug, text] of Object.entries(site[set][name] ?? {})) {
      const where = `${folder(set, name)}/${slug}.md`
      const { frontmatter, body } = parsePage(text)
      if (!frontmatter.id) problems.push(`${where}: front matter has no id`)
      if (!frontmatter.title) problems.push(`${where}: front matter has no title`)
      if (frontmatter.id) {
        if (ids.has(frontmatter.id))
          problems.push(`${where}: id "${frontmatter.id}" is also used by ${ids.get(frontmatter.id)}`)
        ids.set(frontmatter.id, where)
      }
      for (const language of fenceLanguages(body))
        if (!isKnownLanguage(language))
          problems.push(`${where}: a code fence is marked "${language}", which the site does not highlight`)
      if (set === 'authored') {
        if (frontmatter.source?.startsWith('readme@'))
          problems.push(`${where}: a page imported from a README belongs in generated/readme/${name}`)
        if (TYPESCRIPT_FENCE.test(body) && !frontmatter.source?.startsWith('config@'))
          problems.push(`${where}: TypeScript belongs in examples/${name} and an ::example directive, not a code fence`)
      }

      // The playground runs only in a Guide page; a page imported from a README would show it as bare text
      if (set === 'readme' && /::playground\b/.test(withoutCode(body)))
        problems.push(`${where}: ::playground is a Guide directive`)

      for (const match of withoutCode(body).matchAll(EXAMPLE)) {
        const attributes = Object.fromEntries(
          [...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
        )
        // `from="compare"` reads the other frameworks' code in examples/compare, shared by every line
        const from = attributes.from ?? name
        if (attributes.from !== undefined && attributes.from !== EXAMPLE_SOURCE) {
          problems.push(
            `${where}: an ::example reads from "${attributes.from}", but only "${EXAMPLE_SOURCE}" can be named`,
          )
          continue
        }
        const source = attributes.file ? site.examples[from]?.[`src/${attributes.file}`] : undefined
        if (!attributes.file) problems.push(`${where}: an ::example names no file`)
        else if (source === undefined) problems.push(`${where}: examples/${from}/src/${attributes.file} does not exist`)
        else if (attributes.region && !hasRegion(source, attributes.region)) {
          problems.push(`${where}: examples/${from}/src/${attributes.file} has no region "${attributes.region}"`)
        }
      }
      checkLinks(where, body, { line: name, set }, () => anchorsOf(set, name, slug))
    }
  }

  for (const [name, line] of lines) {
    const readmePages = Object.keys(site.readme[name] ?? {}).length
    if (line.guides === 'readme') {
      if (readmePages === 0) problems.push(`generated/readme/${name} has no pages`)
      if (!site.readmeAnchors[name])
        problems.push(`line ${name} imports its README but has no generated/readme-anchors/${name}.json`)
    } else {
      if (Object.keys(snapshot.authored[name] ?? {}).length === 0) problems.push(`content/${name} has no pages`)
      if (readmePages > 0)
        problems.push(`generated/readme/${name} is still there, though ${name}'s guides are authored`)
    }
    checkPages('readme', name)
    checkPages('authored', name)

    const guide = site.migrating[name]
    if (guide) checkLinks(`content/migrating/${name}.md`, guide, undefined, () => new Set(markdownAnchors(guide)))
  }

  for (const line of site.config.lines) {
    for (const version of line.versions) {
      if (!site.apis.has(version)) problems.push(`${version} has no generated/api/${version}.json`)
      if (!site.configs[version]) problems.push(`${version} has no generated/config/${version}.json`)
      const changelog = site.changelogs[version]
      if (!changelog) {
        problems.push(`${version} has no generated/changelog/${version}.json`)
        continue
      }
      changelog.sections.forEach(section =>
        section.entries.forEach(entry =>
          checkLinks(`generated/changelog/${version}.json`, entry.markdown, undefined, () => new Set()),
        ),
      )
    }
  }
  return problems
}
