/**
 * A line's guides imported from the README a version shipped, for lines whose guides the site has
 * not written: one page per `## ` section, the text before the first as the overview, with links
 * between sections pointed at the pages that now hold them. Sections that are not guides are left
 * out, and links to them point at what the site has instead.
 */

import GithubSlugger from 'github-slugger'
import { rewriteLibraryLinks } from './changelog.js'
import { storedHref } from './stored-links.js'

export interface ImportedPage {
  slug: string
  title: string
  order: number
  body: string
}

export interface ImportedReadme {
  pages: ImportedPage[]
  /** Every heading's anchor, mapped to the page that holds it. */
  anchors: Record<string, string>
}

// The sidebar replaces the table of contents, the changelog page the release notes, and the
// repository's own files the contributing and license sections
const SKIPPED: Record<string, (line: string, commitUrl: string) => string | undefined> = {
  'table-of-contents': () => undefined,
  'release-notes': line => storedHref({ kind: 'changelog', line }),
  changelog: line => storedHref({ kind: 'changelog', line }),
  contributing: (_line, commitUrl) => `${commitUrl}/CONTRIBUTING.md`,
  license: (_line, commitUrl) => `${commitUrl}/LICENSE`,
}

interface Section {
  heading?: string
  lines: string[]
}

/** Splits at level-two headings, ignoring any inside a code fence. */
function sections(markdown: string): Section[] {
  const result: Section[] = [{ lines: [] }]
  let fence: string | undefined
  for (const line of markdown.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && (!fence || marker.startsWith(fence))) fence = fence ? undefined : marker
    const heading = !fence && /^## (.+?)\s*#*\s*$/.exec(line)
    if (heading) result.push({ heading: heading[1], lines: [] })
    else result[result.length - 1].lines.push(line)
  }
  return result
}

/** The anchors GitHub gives a section's headings, in order, sharing one slugger across the README. */
function headingAnchors(slugger: GithubSlugger, lines: string[]): string[] {
  const anchors: string[] = []
  let fence: string | undefined
  for (const line of lines) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && (!fence || marker.startsWith(fence))) fence = fence ? undefined : marker
    const heading = !fence && /^#{3,6} (.+?)\s*#*\s*$/.exec(line)
    if (heading) anchors.push(slugger.slug(heading[1]))
  }
  return anchors
}

export function importReadme(
  markdown: string,
  { line, commitUrl }: { line: string; commitUrl: string },
): ImportedReadme {
  const slugger = new GithubSlugger()
  const parts = sections(markdown)
  const anchors: Record<string, string> = {}
  // A skipped section's anchor, and each of its headings', mapped to where its links point instead
  const replaced: Record<string, string | undefined> = {}
  const pages: (ImportedPage & { anchor?: string })[] = []

  parts.forEach((part, index) => {
    const anchor = part.heading ? slugger.slug(part.heading) : undefined
    const slug = anchor ?? 'overview'
    const own = headingAnchors(slugger, part.lines)
    if (anchor && anchor in SKIPPED) {
      for (const key of [anchor, ...own]) replaced[key] = SKIPPED[anchor](line, commitUrl)
      return
    }
    for (const key of [anchor, ...own]) if (key) anchors[key] = slug
    const intro = part.lines.filter(text => !/^# /.test(text))
    pages.push({ slug, anchor, title: part.heading ?? 'Overview', order: index, body: intro.join('\n').trim() })
  })

  const rewrite = (body: string, slug: string) =>
    rewriteLibraryLinks(body, line, anchors)
      .replace(/\]\(#([\w-]+)\)/g, (match, anchor: string) => {
        if (replaced[anchor]) return `](${replaced[anchor]})`
        const page = anchors[anchor]
        if (!page) return match
        return page === slug ? `](#${anchor})` : `](${storedHref({ kind: 'guide', line, slug: page, anchor })})`
      })
      .replace(/\]\(\.\/CHANGELOG\.md\)/g, `](${storedHref({ kind: 'changelog', line })})`)
      .replace(
        /\]\(\.?\/?docs\/MIGRATING\.md(#[\w-]+)?\)/g,
        (_match, anchor?: string) => `](${storedHref({ kind: 'migrating', line, anchor: anchor?.slice(1) })})`,
      )
      .replace(/\]\(\.\/((?!docs\/)[^)#\s]+)\)/g, (_match, file: string) => `](${commitUrl}/${file})`)

  return {
    anchors,
    pages: pages.map(({ anchor: _anchor, ...page }) => ({ ...page, body: rewrite(page.body, page.slug) })),
  }
}

/** A page file as check-content reads it: front matter, then the body. */
export function pageFile(page: ImportedPage, source: string): string {
  const title = JSON.stringify(page.title)
  return `---\nid: ${page.slug}\ntitle: ${title}\norder: ${page.order}\nsource: ${source}\n---\n\n${page.body}\n`
}
