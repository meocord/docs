import type { SearchLine } from '@/lib/search-manifest'
import { rankResults } from '@/lib/search-rank'

/** One entry of a line's palette index: a guide page or an API symbol. */
export interface PaletteEntry {
  name: string
  kind: string
  url: string
  entry?: string
  since?: string
  deprecated?: true
}

/** A search result as the palette shows it, with the sections Pagefind matched inside it. */
export interface Hit {
  url: string
  title: string
  kind: string
  excerpt: string
  sections: { url: string; title: string }[]
  score: number
}

export interface HitGroup {
  kind: 'jump' | 'guide' | 'api' | 'changelog'
  title: string
  hits: Hit[]
}

const GROUPS: { kind: HitGroup['kind']; title: string }[] = [
  { kind: 'jump', title: 'Jump to' },
  { kind: 'guide', title: 'Guides' },
  { kind: 'api', title: 'API' },
  { kind: 'changelog', title: 'Changelog' },
]

/**
 * The line a page belongs to, from its path: `/docs/<line>/…` or `/docs/latest/…` for the current
 * line; the current line for any other page, such as the home page.
 */
export function lineOf(pathname: string, lines: readonly SearchLine[]): SearchLine | undefined {
  const current = lines.find(line => line.status === 'current') ?? lines[0]
  const segment = /^\/docs\/([^/]+)/.exec(pathname)?.[1]
  if (!segment || segment === 'latest') return current
  return lines.find(line => line.line === segment) ?? current
}

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Symbols and pages whose name starts with the query, an exact name first, for jumping straight to
 * them. Nothing for a query of fewer than two characters.
 */
export function jumps(entries: readonly PaletteEntry[], query: string, limit = 5): Hit[] {
  const wanted = normalise(query)
  if (wanted.length < 2) return []
  return entries
    .filter(entry => normalise(entry.name).startsWith(wanted))
    .map(entry => ({ entry, exact: normalise(entry.name) === wanted }))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || a.entry.name.length - b.entry.name.length)
    .slice(0, limit)
    .map(({ entry }) => ({
      url: entry.url,
      title: entry.name,
      kind: entry.kind,
      excerpt: entry.kind === 'guide' ? 'Guide' : `${entry.kind.replace('-', ' ')} in meocord/${entry.entry}`,
      sections: [],
      score: 0,
    }))
}

/**
 * Ranked search results grouped as the palette lists them: jumps, then guides, API and the
 * changelog, each in rank order, with a result already offered as a jump left out of its group.
 */
export function groupHits(query: string, hits: readonly Hit[], jumpHits: readonly Hit[] = []): HitGroup[] {
  const jumped = new Set(jumpHits.map(hit => hit.url))
  const ranked = rankResults(query, hits).filter(hit => !jumped.has(hit.url))
  return GROUPS.map(group => ({
    ...group,
    hits: group.kind === 'jump' ? [...jumpHits] : ranked.filter(hit => hit.kind === group.kind),
  })).filter(group => group.hits.length > 0)
}

/** The options a keyboard moves through, in the order the palette shows them. */
export function flatten(groups: readonly HitGroup[]): Hit[] {
  return groups.flatMap(group => group.hits)
}

/** The words of a text, lowercased, as a search compares them. */
const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []

/** How many leading characters two words share. */
const shared = (a: string, b: string) => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * Whether a marked word matches a query term: it is the term or extends it, or they share a stem, a common prefix
 * of at least 3 characters that leaves at most 2 of the shorter word over. `test` for `testing` and `configure`
 * for `configuration` match; the `z` Pagefind marks for `zero`, because `zero` starts with it, does not.
 */
const matches = (mark: string, term: string) =>
  mark.startsWith(term) || shared(mark, term) >= Math.max(3, Math.min(mark.length, term.length) - 2)

/**
 * Whether a result's excerpt shows a real match for every term of the query, as Pagefind requires every term.
 * Pagefind also marks a word a term merely starts with, such as the `z` of `import { z }` for `zqxjvw`; a term
 * whose marked words are all such is not matched. A term with no marked word of its own, matched outside the
 * excerpt, and an excerpt with no marks, a match in the title, count.
 */
export function marksAMatch(query: string, excerptHtml: string): boolean {
  const marks = [...excerptHtml.matchAll(/<mark>([^<]*)<\/mark>/g)].flatMap(match => wordsOf(match[1]))
  return wordsOf(query).every(term => {
    const related = marks.filter(mark => term.startsWith(mark) || matches(mark, term))
    return related.length === 0 || related.some(mark => matches(mark, term))
  })
}
