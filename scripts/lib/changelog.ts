/**
 * The library's release notes, per version: a section sliced from the CHANGELOG.md the tarball
 * ships, split into its entries, with links into the library's docs pointed at the site.
 */

import { storedHref } from './stored-links'

export interface ChangelogEntry {
  markdown: string
  /** A change to act on: listed under Major Changes, or linking the migration guide, as 4.x patches that break do. */
  breaking: boolean
}

export interface ChangelogSection {
  title: string
  entries: ChangelogEntry[]
}

export interface ChangelogDocument {
  version: string
  /** The day the registry published the version, `YYYY-MM-DD` in UTC, when it records one. */
  published?: string
  sections: ChangelogSection[]
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The body of `## <version>`, up to the next version heading. */
export function sliceChangelog(changelog: string, version: string): string {
  const start = new RegExp(`^## ${escape(version)}\\s*$`, 'm').exec(changelog)
  if (!start) throw new Error(`CHANGELOG.md has no "## ${version}" section.`)
  const rest = changelog.slice(start.index + start[0].length)
  const end = /^## /m.exec(rest)
  return (end ? rest.slice(0, end.index) : rest).trim()
}

const MIGRATING = /https:\/\/github\.com\/(?:l7aromeo|meocord)\/meocord\/blob\/[^/\s)]+\/docs\/MIGRATING\.md(#[\w-]+)?/g
const README = /https:\/\/github\.com\/(?:l7aromeo|meocord)\/meocord\/?(?:#([\w-]+))?(?=[)\s])/g

/**
 * Where a README anchor lands on a line's pages: the slug of the page holding it, keeping the anchor,
 * or a page and the anchor to use there, none for the page itself.
 */
export type AnchorTarget = string | { slug: string; anchor?: string }

/** The stored href a README anchor lands on, or undefined when no page of the line has it. */
export function anchorHref(line: string, anchors: Record<string, AnchorTarget>, anchor: string): string | undefined {
  const target = anchors[anchor]
  if (target === undefined) return undefined
  return typeof target === 'string'
    ? storedHref({ kind: 'guide', line, slug: target, anchor })
    : storedHref({ kind: 'guide', line, slug: target.slug, anchor: target.anchor })
}

/**
 * Points links at the library's migration guide and README to the site's pages for `line`.
 * README anchors resolve through `anchors`, which maps an anchor to where it lands.
 */
export function rewriteLibraryLinks(
  markdown: string,
  line: string,
  anchors: Record<string, AnchorTarget> = {},
): string {
  return markdown
    .replace(MIGRATING, (_match, anchor: string | undefined) =>
      storedHref({ kind: 'migrating', line, anchor: anchor?.slice(1) }),
    )
    .replace(README, (match, anchor: string | undefined) => {
      if (!anchor) return storedHref({ kind: 'line', line })
      return anchorHref(line, anchors, anchor) ?? match
    })
}

/**
 * Splits a version's section into its `### ` groups and their top-level `- ` entries, dated by
 * `published`, the registry's publish time for the version.
 */
export function parseChangelog(version: string, section: string, published?: string): ChangelogDocument {
  const sections: ChangelogSection[] = []
  let current: ChangelogSection | undefined
  let entry: string[] | undefined
  const flush = () => {
    if (entry && current) {
      const markdown = entry.join('\n').replace(/^- /, '').trimEnd()
      const breaking =
        current.title === 'Major Changes' || /\/docs\/[^/\s)]+\/migrating|docs\/MIGRATING\.md/.test(markdown)
      current.entries.push({ markdown, breaking })
    }
    entry = undefined
  }
  for (const text of section.split('\n')) {
    const heading = /^### (.+)$/.exec(text)
    if (heading) {
      flush()
      current = { title: heading[1].trim(), entries: [] }
      sections.push(current)
    } else if (text.startsWith('- ')) {
      flush()
      entry = [text]
    } else if (entry) {
      entry.push(text.replace(/^ {2}/, ''))
    }
  }
  flush()
  return published ? { version, published: published.slice(0, 10), sections } : { version, sections }
}
