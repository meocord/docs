/**
 * The library's migration guide as of a line's newest version. It is not in the tarball, so it is
 * read from the commit that version's provenance attests.
 */

import GithubSlugger from 'github-slugger'
import { rewriteLibraryLinks } from './changelog'
import type { Fetch } from './registry'
import { storedHref } from './stored-links'

export const LIBRARY_REPOSITORY = 'meocord/meocord'

export function migratingUrl(commit: string): string {
  return `https://raw.githubusercontent.com/${LIBRARY_REPOSITORY}/${commit}/docs/MIGRATING.md`
}

export async function fetchMigrating(commit: string, fetchImpl: Fetch = fetch): Promise<string> {
  const url = migratingUrl(commit)
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}.`)
  return response.text()
}

/** The anchors GitHub gives the guide's headings, which the library keeps stable for changelog links. */
export function markdownAnchors(markdown: string): string[] {
  const slugger = new GithubSlugger()
  const anchors: string[] = []
  let fence = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) fence = !fence
    const heading = !fence && /^#{1,6} (.+?)\s*#*\s*$/.exec(line)
    if (heading) anchors.push(slugger.slug(heading[1]))
  }
  return anchors
}

/** The guide as the site stores it: its source recorded, and links into the library pointed at the line's pages. */
export function migratingFile(
  markdown: string,
  {
    line,
    version,
    commit,
    readmeAnchors,
  }: { line: string; version: string; commit: string; readmeAnchors: Record<string, string> },
): string {
  // The guide sits in docs/, so it reaches the README as ../README.md
  const body = rewriteLibraryLinks(markdown, line, readmeAnchors).replace(
    /\]\(\.\.\/README\.md(?:#([\w-]+))?\)/g,
    (match, anchor?: string) => {
      if (!anchor) return `](${storedHref({ kind: 'line', line })})`
      const page = readmeAnchors[anchor]
      return page ? `](${storedHref({ kind: 'guide', line, slug: page, anchor })})` : match
    },
  )
  return `<!-- docs/MIGRATING.md from ${LIBRARY_REPOSITORY}@${commit} (${version}); generated, do not edit -->\n\n${body.trim()}\n`
}
