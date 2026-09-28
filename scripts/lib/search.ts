/**
 * What the site's search and command palette know about a line: one search document per guide,
 * API symbol and changelog, each with sections that become Pagefind sub-results, and a small
 * symbol index for the palette. Built from the committed content and generated data, never from
 * rendered pages, and linked through src/lib/urls.ts.
 */

import { pageSlugger } from '../../src/lib/page-ids'
import { ReflectionKind, type JSONOutput } from 'typedoc'
import { changelogSectionAnchor, docsHref, entrySegment, memberAnchor, resolveStoredHref } from '../../src/lib/urls.js'
import type { ApiDocument } from './api.js'
import type { ChangelogDocument } from './changelog.js'
import { parsePage } from './content.js'
import { guidePath, type GuidePage } from './guide.js'
import type { Page } from './pages.js'
import type { SinceEntry } from './since.js'
import type { VersionsConfig } from './versions.js'
import type { CliCommand, CliManifest } from './cli.js'

export type SearchKind = 'guide' | 'api' | 'changelog'

export interface SearchSection {
  /** The id of the section's heading on the page; the page itself when absent. */
  anchor?: string
  heading?: string
  text: string
}

export interface SearchDocument {
  url: string
  title: string
  kind: SearchKind
  line: string
  sections: SearchSection[]
}

export interface PaletteEntry {
  name: string
  kind: string
  url: string
  /** The entry point, as its URL segment: `core`, `decorator`. */
  entry?: string
  since?: string
  deprecated?: true
}

/** Resolves `::example{file region}` to the code it embeds, or undefined when it cannot be read. */
export type ExampleSource = (file: string, region?: string) => string | undefined

const EXAMPLE = /^::example\{([^}]*)\}\s*$/
const ATTRIBUTE = /(\w+)="([^"]*)"/g

/** Markdown as the words a reader sees: markup dropped, code and embedded examples kept as text. */
export function markdownText(markdown: string, examples: ExampleSource = () => undefined): string {
  const out: string[] = []
  let fence: string | undefined
  for (const line of markdown.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && (!fence || marker.startsWith(fence))) {
      fence = fence ? undefined : marker
      continue
    }
    if (fence) {
      out.push(line)
      continue
    }
    // A table's separator row carries no words.
    if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)) continue
    const example = EXAMPLE.exec(line.trim())
    if (example) {
      const attributes = Object.fromEntries([...example[1].matchAll(ATTRIBUTE)].map(([, key, value]) => [key, value]))
      const code = attributes.file ? examples(attributes.file, attributes.region) : undefined
      if (code) out.push(code)
      continue
    }
    out.push(
      line
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, '$1$2')
        .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/, '')
        .replace(/\s*\|\s*/g, ' ')
        .trim(),
    )
  }
  return out
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A page body split at its section headings: the highest level below the title it uses, `##` on an
 * authored page and `###` on one imported from a README. Anchors are slugged across every heading in
 * order, as the page's own heading ids and content:check's anchors are, so `#anchor` lands on it.
 */
export function splitSections(body: string, examples?: ExampleSource): SearchSection[] {
  const level = sectionLevel(body)
  const slugger = pageSlugger()
  const sections: { anchor?: string; heading?: string; lines: string[] }[] = [{ lines: [] }]
  let fence: string | undefined
  for (const line of body.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && (!fence || marker.startsWith(fence))) fence = fence ? undefined : marker
    const heading = fence || marker ? undefined : /^(#{1,6}) (.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      const anchor = slugger.slug(heading[2])
      if (heading[1].length === level) {
        sections.push({ anchor, heading: markdownText(heading[2]), lines: [] })
        continue
      }
    }
    sections[sections.length - 1].lines.push(line)
  }
  return sections
    .map(({ anchor, heading, lines }) => ({ anchor, heading, text: markdownText(lines.join('\n'), examples) }))
    .filter(section => section.heading || section.text)
}

/** The shallowest heading depth from `##` down that a body uses outside code, or 2 without any. */
function sectionLevel(body: string): number {
  let fence: string | undefined
  let level = 7
  for (const line of body.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && (!fence || marker.startsWith(fence))) {
      fence = fence ? undefined : marker
      continue
    }
    const depth = fence ? 0 : (/^(#{2,6}) /.exec(line)?.[1].length ?? 0)
    if (depth > 0) level = Math.min(level, depth)
  }
  return level === 7 ? 2 : level
}

/** A guide page's search document, from the page as pages.ts reads it. */
export function guideDocument(
  line: string,
  slug: string,
  { frontmatter, body }: Page,
  versions: VersionsConfig,
  examples?: ExampleSource,
): SearchDocument {
  return {
    url: docsHref({ kind: 'guide', line, slug }, versions),
    title: frontmatter.title ?? slug,
    kind: 'guide',
    line,
    sections: splitSections(body, examples),
  }
}

/**
 * A line's Guide pages as search documents, at the paths the site renders them, each with its examples
 * as they stand at that page (`examples` is given the page's path).
 */
export function guidePageDocuments(
  line: string,
  pages: { page: GuidePage; body: string }[],
  versions: VersionsConfig,
  examples: (page: string) => ExampleSource = () => () => undefined,
): SearchDocument[] {
  return pages.map(({ page, body }) => ({
    url: docsHref(
      {
        kind: 'guide',
        line,
        slug: page.id,
        group: page.group === 'recipes' || page.group === 'coming-from' ? page.group : undefined,
      },
      versions,
    ),
    title: page.title,
    kind: 'guide',
    line,
    sections: splitSections(body, examples(guidePath(page))),
  }))
}

/** The migration guide's search document. */
export function migratingDocument(line: string, markdown: string, versions: VersionsConfig): SearchDocument {
  const { body } = parsePage(markdown)
  return {
    url: docsHref({ kind: 'migrating', line }, versions),
    title: 'Migrating',
    kind: 'guide',
    line,
    sections: splitSections(body),
  }
}

/**
 * A document per release of a line, at the release's own page: one section per group of its notes,
 * at the anchor the page gives that group's heading.
 */
export function changelogDocuments(
  line: string,
  changelogs: ChangelogDocument[],
  versions: VersionsConfig,
): SearchDocument[] {
  return changelogs.map(changelog => ({
    url: docsHref({ kind: 'changelog', line, version: changelog.version }, versions),
    title: `${changelog.version} changelog`,
    kind: 'changelog',
    line,
    sections:
      changelog.sections.length === 0
        ? [{ text: 'No changes recorded.' }]
        : changelog.sections.map(section => ({
            anchor: changelogSectionAnchor(section.title),
            heading: section.title,
            text: section.entries.map(entry => markdownText(entry.markdown)).join('\n\n'),
          })),
  }))
}

type Declaration = JSONOutput.DeclarationReflection
type Comment = JSONOutput.Comment | undefined

function commentText(comment: Comment): string {
  if (!comment) return ''
  const parts = [...comment.summary, ...(comment.blockTags ?? []).flatMap(tag => tag.content)]
  return parts
    .map(part => part.text)
    .join('')
    .replace(/`/g, '')
}

function isDeprecated(declaration: Declaration): boolean {
  const comments = [declaration.comment, ...(declaration.signatures ?? []).map(signature => signature.comment)]
  return comments.some(comment => comment?.blockTags?.some(tag => tag.tag === '@deprecated'))
}

/** A declaration's words: its comment, and each signature's comment and parameters. */
function declarationText(declaration: Declaration): string {
  const parts = [commentText(declaration.comment)]
  for (const signature of declaration.signatures ?? []) {
    parts.push(commentText(signature.comment))
    for (const parameter of signature.parameters ?? []) {
      parts.push(`${parameter.name} ${commentText(parameter.comment)}`)
    }
  }
  return parts
    .filter(Boolean)
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** A reflection kind as a word: `class`, `function`, `type-alias`. */
const kindName = (kind: number) => (ReflectionKind[kind] ?? 'unknown').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

/** What a line's API holds: each entry point's top-level symbols, with their own members. */
function symbols(api: ApiDocument): { entry: string; symbol: Declaration; members: Declaration[] }[] {
  return (api.project.children ?? []).flatMap(module =>
    (module.children ?? []).map(symbol => ({
      entry: module.name,
      symbol,
      members: (symbol.children ?? []).filter(member => !member.flags?.isInherited),
    })),
  )
}

const SAFE_NAME = /^[A-Za-z_$][\w$]*$/

/** Where the page of a symbol an entry point exports is, as the site arranges the line's API. */
export type ApiHref = (entry: string, name: string) => string | undefined

/** A symbol's page by its entry point, as a line whose API is arranged by entry point has it. */
export const entryHref =
  (line: string, versions: VersionsConfig): ApiHref =>
  (entry, name) =>
    docsHref({ kind: 'api', line, section: entry, symbol: name }, versions)

/**
 * One search document per API symbol, its members as sections at their anchors. A symbol two entry
 * points export is one page, where the API is arranged by kind, and one document.
 */
export function apiDocuments(
  line: string,
  api: ApiDocument,
  versions: VersionsConfig,
  hrefOf: ApiHref = entryHref(line, versions),
): SearchDocument[] {
  const seen = new Set<string>()
  return symbols(api)
    .filter(({ symbol }) => SAFE_NAME.test(symbol.name))
    .flatMap(({ entry, symbol, members }) => {
      const url = hrefOf(entry, symbol.name)
      if (!url || seen.has(url)) return []
      seen.add(url)
      return {
        url,
        title: symbol.name,
        kind: 'api' as const,
        line,
        sections: [
          { text: [`${kindName(symbol.kind)} ${symbol.name} ${entry}`, declarationText(symbol)].join('\n') },
          ...members
            .filter(member => SAFE_NAME.test(member.name))
            .map(member => ({
              anchor: memberAnchor(member.name),
              heading: `${symbol.name}.${member.name}`,
              text: declarationText(member) || `${kindName(member.kind)} ${member.name}`,
            })),
        ],
      }
    })
}

/** Where a CLI command's page is, or with `sub` one of its subcommands on it. */
export type CliHref = (command: string, sub?: string) => string

/** The words of a command after `meocord`, and what it does, as search reads them. */
const commandText = (command: CliCommand) =>
  [
    `meocord ${command.path.join(' ')}`,
    command.summary ?? command.description ?? '',
    ...command.options.map(option => `${option.flags} ${option.description ?? ''}`),
    ...command.arguments.map(argument => `${argument.name} ${argument.description ?? ''}`),
  ].join('\n')

/** One search document per top-level CLI command, its subcommands as sections at their anchors. */
export function cliDocuments(line: string, manifest: CliManifest, hrefOf: CliHref): SearchDocument[] {
  return manifest.commands.map(command => ({
    url: hrefOf(command.name),
    title: `meocord ${command.name}`,
    kind: 'api' as const,
    line,
    sections: [
      { text: commandText(command) },
      ...command.commands.map(sub => ({
        anchor: memberAnchor(sub.name),
        heading: `meocord ${sub.path.join(' ')}`,
        text: commandText(sub),
      })),
    ],
  }))
}

/** The palette's entries for the CLI: each command and subcommand, by its words after `meocord`. */
export function cliPaletteEntries(manifest: CliManifest, hrefOf: CliHref): PaletteEntry[] {
  return manifest.commands.flatMap(command => [
    { name: command.name, kind: 'command', url: hrefOf(command.name) },
    ...command.commands.map(sub => ({
      name: sub.path.join(' '),
      kind: 'command',
      url: hrefOf(command.name, sub.name),
    })),
  ])
}

/** The palette's index for a line: every guide page and every API symbol, in a stable order. */
export function paletteIndex(
  line: string,
  guides: SearchDocument[],
  api: ApiDocument | undefined,
  since: Record<string, SinceEntry>,
  versions: VersionsConfig,
  hrefOf: ApiHref = entryHref(line, versions),
  extra: PaletteEntry[] = [],
): PaletteEntry[] {
  const entries: PaletteEntry[] = [
    ...guides.map(guide => ({ name: guide.title, kind: 'guide', url: guide.url })),
    ...extra,
  ]
  const seen = new Set<string>()
  for (const { entry, symbol } of api ? symbols(api) : []) {
    const url = SAFE_NAME.test(symbol.name) ? hrefOf(entry, symbol.name) : undefined
    if (!url || seen.has(url)) continue
    seen.add(url)
    const record: PaletteEntry = {
      name: symbol.name,
      kind: kindName(symbol.kind),
      url,
      entry: entrySegment(entry),
    }
    const first = since[`${entry}:${symbol.name}`]?.since
    if (first) record.since = first
    if (isDeprecated(symbol)) record.deprecated = true
    entries.push(record)
  }
  return entries.sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.url.localeCompare(b.url),
  )
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The document as the HTML Pagefind indexes: its title and filters as Pagefind attributes, and each
 * section under a heading with its anchor as the id, which Pagefind turns into a sub-result. Links
 * stored in the text are rendered as the site emits them.
 */
export function searchHtml(document: SearchDocument, versions: VersionsConfig): string {
  const text = (value: string) =>
    escape(value.replace(/\/docs\/\d+\.\d+[^\s)]*/g, href => resolveStoredHref(href, versions)))
  const body = document.sections
    .map(section =>
      section.anchor
        ? `<h2 id="${escape(section.anchor)}">${text(section.heading ?? '')}</h2><p>${text(section.text)}</p>`
        : `<p>${text(section.text)}</p>`,
    )
    .join('')
  return (
    `<html lang="en"><body><main data-pagefind-body>` +
    `<h1 data-pagefind-meta="title">${escape(document.title)}</h1>` +
    `<span data-pagefind-filter="line" hidden>${escape(document.line)}</span>` +
    `<span data-pagefind-filter="kind" hidden>${document.kind}</span>` +
    `${body}</main></body></html>`
  )
}
