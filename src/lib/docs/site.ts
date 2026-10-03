import { notFound } from 'next/navigation'
import { listPages, loadPage, migratingGuide, resolveExample, type PageEntry } from '../../../scripts/lib/pages'
import type { GlyphName } from '@/components/shell/icons'
import type { Crumb, NavGroup, TocEntry, VersionOption } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { lowerMarkdown, type Lowered } from '@/lib/prose/lower'
import { docsHref, olderLines } from '@/lib/urls'
import { resolveSiteHref } from '@/lib/docs/api-site'
import { versionOption, versionOptions } from '@/lib/version-options'
import { firstParagraph } from '@/lib/docs/page-metadata'
import { guideEnabled, guideEntries, guidePageHref, guideSidebar } from '@/lib/docs/guide-site'
import { counterpartIn, guidePath, pageKnownAs, type TopicPage } from '../../../scripts/lib/guide'

/** The lines the site renders pages for: every line versions.json lists, archived ones included. */
export function lines(): string[] {
  return VERSIONS.lines.map(entry => entry.line)
}

/** A docs route's params, or a 404 for a line versions.json does not list, before anything reads that line. */
export async function lineParams<P extends { line: string }>(params: Promise<P>): Promise<P> {
  const resolved = await params
  if (!lines().includes(resolved.line)) notFound()
  return resolved
}

const guideHref = (line: string, slug: string) => docsHref({ kind: 'guide', line, slug }, VERSIONS)

/** A page of a line as the site routes it: from its Guide, or from its README for a line without one. */
export interface LinePage {
  id: string
  /** Its path below the line: a slug, or `<group>/<slug>` for a recipe or coming-from page. */
  path: string
  title: string
  href: string
  since?: string
  /** The old slugs of this line that redirect to it. */
  formerly: string[]
  /** The ids of other lines' pages on its topic. */
  covers: string[]
}

/** A line's pages: its Guide in reading order where it is rendered, and its README's pages otherwise. */
export function linePages(line: string): LinePage[] {
  if (guideEnabled(line))
    return guideEntries(line).map(({ page }) => ({
      id: page.id,
      path: guidePath(page),
      title: page.title,
      href: guidePageHref(line, page),
      since: page.since,
      formerly: page.formerly,
      covers: page.covers,
    }))
  return listPages(line).map(page => ({
    id: page.id,
    path: page.slug,
    title: page.title,
    href: guideHref(line, page.slug),
    since: page.since,
    formerly: page.formerly,
    covers: [],
  }))
}

/** A page of a line, as the version switcher and the missing pages match it with the other lines' pages. */
export interface Topic {
  page: TopicPage
  line: string
}

/** A line's page known by an id of that line: its own, a retired one it covers, or an old slug it took over. */
export function linePageWithId(line: string, id: string): LinePage | undefined {
  return pageKnownAs(linePages(line), line, id)
}

/** A line's page on the topic of another line's page, at the section it covers where it names one. */
export function counterpart(line: string, topic: Topic): LinePage | undefined {
  const found = counterpartIn(linePages(line), line, topic.page, topic.line)
  return found && (found.anchor ? { ...found.page, href: `${found.page.href}#${found.anchor}` } : found.page)
}

/**
 * Where a path this line has no page at leads, as an old `latest` URL reaches the line once it is current: the line's
 * own page on the topic of another line's page at that path, the version switcher's way, or else the newest older
 * line's page at the path. Undefined for a path no other line has a page at.
 */
export function elsewhereHref(line: string, path: string): string | undefined {
  const holders = lines()
    .filter(other => other !== line)
    .flatMap(other =>
      linePages(other)
        .filter(page => page.path === path)
        .map(page => ({ page, line: other })),
    )
  const here = holders.map(topic => counterpart(line, topic)).find(page => page !== undefined)
  if (here) return here.href
  return olderLines(line, VERSIONS)
    .map(other => holders.find(holder => holder.line === other))
    .find(holder => holder !== undefined)?.page.href
}

/** Where the page a line's Guide lists an old slug for lives now; undefined for a slug no page held. */
export function movedPageHref(line: string, slug: string): string | undefined {
  return linePages(line).find(page => page.formerly.includes(slug))?.href
}

/** Every `{ line, slug }` a docs page is prerendered for. */
export function pageParams(): { line: string; slug: string[] }[] {
  return lines().flatMap(line => linePages(line).map(page => ({ line, slug: page.path.split('/') })))
}

/** The glyph for each section of the guides; any other section gets the book. */
const SECTION_ICONS: Record<string, GlyphName> = {
  Start: 'start',
  Core: 'core',
  'Handling a call': 'pipeline',
  'Answering Discord': 'reply',
  'Beyond commands': 'layers',
  Shipping: 'ship',
  Testing: 'check',
  Reference: 'reference',
}

/** The sidebar: a line's pages in order, grouped by section in the order sections first appear, the one read marked. */
export function sidebar(line: string, currentSlug?: string): NavGroup[] {
  if (guideEnabled(line)) {
    return [...guideSidebar(line, currentSlug), referenceGroup(line, currentSlug)]
  }
  const groups: NavGroup[] = []
  for (const page of listPages(line)) {
    const title = page.section ?? 'Guides'
    let group = groups.find(candidate => candidate.title === title)
    if (!group) groups.push((group = { title, icon: SECTION_ICONS[title] ?? 'book', items: [] }))
    group.items.push({
      title: page.title,
      href: guideHref(line, page.slug),
      current: page.slug === currentSlug,
      badge: page.since && page.since.startsWith(`${line}.0`) ? 'New' : undefined,
    })
  }
  groups.push(referenceGroup(line, currentSlug))
  return groups
}

/** The line's reference pages: its migration guide, where it has one, and its changelog. */
function referenceGroup(line: string, currentSlug?: string): NavGroup {
  const reference = [
    ...(migratingGuide(line) !== undefined
      ? [
          {
            title: 'Migrating',
            href: docsHref({ kind: 'migrating', line }, VERSIONS),
            current: currentSlug === 'migrating',
          },
        ]
      : []),
    { title: 'Changelog', href: docsHref({ kind: 'changelog', line }, VERSIONS), current: currentSlug === 'changelog' },
  ]
  return { title: 'Reference', icon: SECTION_ICONS.Reference, items: reference }
}

/**
 * The version switcher's choices from a page: each line links to its page on the same topic when it has
 * one (see `counterpartIn`), and to its page saying it has none otherwise.
 */
export function versionChoices(line: string, topic?: Topic): { current: VersionOption; options: VersionOption[] } {
  const options = versionOptions(VERSIONS).map(option => {
    if (!topic) return option
    const match = counterpart(option.label, topic)
    if (match) return { ...option, href: match.href }
    // A line without the page says so, and where it is, rather than landing somewhere else.
    return option.label === line
      ? option
      : { ...option, href: docsHref({ kind: 'missing', line: option.label, id: topic.page.id }, VERSIONS) }
  })
  return { current: options.find(option => option.label === line) ?? versionOption(line, VERSIONS), options }
}

export interface GuidePage {
  entry: PageEntry
  lowered: Lowered
  crumbs: Crumb[]
  toc: TocEntry[]
  canonical: string
}

/** A page's title and canonical URL, without lowering it; undefined when the line has no such page. */
export function guideMeta(
  line: string,
  slug: string,
): { title: string; description: string; canonical: string } | undefined {
  if (guideEnabled(line)) {
    const view = guideEntries(line).find(entry => guidePath(entry.page) === slug)
    return view && { title: view.page.title, description: view.page.summary, canonical: guidePageHref(line, view.page) }
  }
  const entry = listPages(line).find(page => page.slug === slug)
  const page = entry && loadPage(line, slug)
  return (
    entry && { title: entry.title, description: firstParagraph(page?.body ?? ''), canonical: guideHref(line, slug) }
  )
}

/** One page of a line, lowered for Prose; undefined when the line has no such page. */
export function guidePage(line: string, slug: string): GuidePage | undefined {
  const entry = listPages(line).find(page => page.slug === slug)
  const page = entry && loadPage(line, slug)
  if (!entry || !page) return undefined

  const lowered = lowerMarkdown(page.body, {
    href: resolveSiteHref,
    example: (file, region, from) => resolveExample(from ?? line, file, region),
  })
  const toc = lowered.headings
    .filter(heading => heading.depth === 2 || heading.depth === 3)
    .map(heading => ({ id: heading.id, title: heading.title, depth: heading.depth as 2 | 3 }))
  const crumbs: Crumb[] = [
    { title: line, href: docsHref({ kind: 'line', line }, VERSIONS) },
    ...(entry.section ? [{ title: entry.section }] : []),
    { title: entry.title },
  ]
  return { entry, lowered, crumbs, toc, canonical: guideHref(line, slug) }
}

/** The version a README-imported page was taken from, from its `readme@<version>` source. */
export function readmeVersion(entry: PageEntry): string | undefined {
  return entry.source?.startsWith('readme@') ? entry.source.slice('readme@'.length) : undefined
}
