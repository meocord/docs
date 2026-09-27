import { listPages, loadPage, migratingGuide, resolveExample, type PageEntry } from '../../../scripts/lib/pages'
import type { GlyphName } from '@/components/shell/icons'
import type { Crumb, NavGroup, TocEntry, VersionOption } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { lowerMarkdown, type Lowered } from '@/lib/prose/lower'
import { docsHref } from '@/lib/urls'
import { resolveSiteHref } from '@/lib/docs/api-site'
import { versionOption, versionOptions } from '@/lib/version-options'
import { firstParagraph } from '@/lib/docs/page-metadata'
import { guideEnabled, guideEntries, guidePageHref, guideSidebar } from '@/lib/docs/guide-site'
import { guidePath } from '../../../scripts/lib/guide'

/** The lines the site renders pages for: every line versions.json lists, archived ones included. */
export function lines(): string[] {
  return VERSIONS.lines.map(entry => entry.line)
}

/** Every `{ line, slug }` a docs page is prerendered for. */
export function pageParams(): { line: string; slug: string[] }[] {
  return lines().flatMap(line =>
    guideEnabled(line)
      ? guideEntries(line).map(({ page }) => ({ line, slug: guidePath(page).split('/') }))
      : listPages(line).map(page => ({ line, slug: [page.slug] })),
  )
}

const guideHref = (line: string, slug: string) => docsHref({ kind: 'guide', line, slug }, VERSIONS)

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

/** The sidebar: a line's pages in order, grouped by section in the order sections first appear. */
export function sidebar(line: string, currentSlug?: string): NavGroup[] {
  if (guideEnabled(line)) return [...guideSidebar(line), referenceGroup(line, currentSlug)]
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
 * The version switcher's choices from a page: each line links to the same page when it has one
 * (matched by page id, or an id the page was formerly known by), and to where the line lands otherwise.
 */
export function versionChoices(line: string, id?: string): { current: VersionOption; options: VersionOption[] } {
  const options = versionOptions(VERSIONS).map(option => {
    if (!id) return option
    const match = listPages(option.label).find(page => page.id === id || page.formerly.includes(id))
    if (match) return { ...option, href: guideHref(option.label, match.slug) }
    // A line without the page says so, and where it is, rather than landing somewhere else.
    return option.label === line
      ? option
      : { ...option, href: docsHref({ kind: 'missing', line: option.label, id }, VERSIONS) }
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
