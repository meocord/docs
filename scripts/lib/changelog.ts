/**
 * The library's release notes, per version: a section sliced from the CHANGELOG.md the tarball
 * ships, split into its entries, with links into the library's docs pointed at the site.
 */

import { storedHref } from './stored-links.js'

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
 * Points links at the library's migration guide and README to the site's pages for `line`.
 * README anchors resolve through `readmeAnchors`, which maps an anchor to the page holding it.
 */
export function rewriteLibraryLinks(
  markdown: string,
  line: string,
  readmeAnchors: Record<string, string> = {},
): string {
  return markdown
    .replace(MIGRATING, (_match, anchor: string | undefined) =>
      storedHref({ kind: 'migrating', line, anchor: anchor?.slice(1) }),
    )
    .replace(README, (match, anchor: string | undefined) => {
      if (!anchor) return storedHref({ kind: 'line', line })
      const page = readmeAnchors[anchor]
      return page ? storedHref({ kind: 'guide', line, slug: page, anchor }) : match
    })
}

/** Splits a version's section into its `### ` groups and their top-level `- ` entries. */
export function parseChangelog(version: string, section: string): ChangelogDocument {
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
  return { version, sections }
}
