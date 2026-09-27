import { CHAPTERS, guidePath, guideRendered, readGuide, type GuidePage } from '../../../scripts/lib/guide'
import { resolveExample } from '../../../scripts/lib/pages'
import type { Crumb, NavGroup, NavTab, TocEntry } from '@/components/shell/types'
import type { GlyphName } from '@/components/shell/icons'
import { VERSIONS } from '@/config/versions'
import { apiLandingHref, apiModel } from '@/lib/docs/api-site'
import { lowerMarkdown, type Lowered } from '@/lib/prose/lower'
import { docsHref, resolveStoredHref } from '@/lib/urls'

/** Whether the site renders a line's Guide: in a build with DOCS_NEXT=1, for a line that has one. */
export const guideEnabled = guideRendered

interface Entry {
  page: GuidePage
  body: string
}

const entries = new Map<string, Entry[]>()

/** A line's Guide in reading order; a page whose front matter fails content:check is left out. */
export function guideEntries(line: string): Entry[] {
  if (!entries.has(line)) entries.set(line, readGuide(line))
  return entries.get(line)!
}

/** Where a Guide page lives: `/docs/<line>/<id>`, or under its group for recipes and coming-from pages. */
export function guidePageHref(line: string, page: Pick<GuidePage, 'id' | 'group'>, anchor?: string): string {
  const group = page.group === 'recipes' || page.group === 'coming-from' ? page.group : undefined
  return docsHref({ kind: 'guide', line, slug: page.id, group, anchor }, VERSIONS)
}

/**
 * The href a Guide page's link renders with. `guide:<path>[#anchor]` names a Guide page by its path,
 * or the line's `migrating` and `changelog` pages; `api:<kind>/<Symbol>[#member]` names an API symbol,
 * found in the entry point that exports it. Anything else is a stored link or a URL outside the docs.
 */
export function resolveGuideLink(line: string, url: string): string {
  const [base, anchor] = url.split('#', 2)
  if (base.startsWith('guide:')) {
    const target = base.slice('guide:'.length)
    if (target === 'migrating') return docsHref({ kind: 'migrating', line, anchor }, VERSIONS)
    if (target === 'changelog') return docsHref({ kind: 'changelog', line }, VERSIONS)
    const entry = guideEntries(line).find(candidate => guidePath(candidate.page) === target)
    if (entry) return guidePageHref(line, entry.page, anchor)
    // A planned page not written yet: where it will be, which content:check requires before the switch.
    const [group, id] = target.includes('/') ? target.split('/', 2) : [undefined, target]
    return guidePageHref(line, { id: id!, group: group as GuidePage['group'] }, anchor)
  }
  if (base.startsWith('api:')) {
    const symbol = base.slice('api:'.length).split('/')[1]
    const model = apiModel(line)
    const found = model?.entries().find(({ symbols }) => symbols.some(candidate => candidate.name === symbol))
    return found && model ? model.href({ entry: found.entry, symbol, member: anchor }) : url
  }
  return resolveStoredHref(url, VERSIONS)
}

/** The glyph beside each chapter in the sidebar. */
const CHAPTER_ICONS: Record<string, GlyphName> = {
  start: 'start',
  interactions: 'reply',
  messages: 'layers',
  structure: 'core',
  pipeline: 'pipeline',
  testing: 'check',
  shipping: 'ship',
  appendix: 'book',
}

const GROUP_TITLES: Record<string, string> = { recipes: 'Recipes', 'coming-from': 'Coming from', help: 'Help' }

/** The Guide's sidebar: a group per chapter in reading order, and the appendices by group. */
export function guideSidebar(line: string, current?: GuidePage): NavGroup[] {
  const groups: NavGroup[] = []
  for (const { page } of guideEntries(line)) {
    const title =
      page.chapter === 'appendix'
        ? GROUP_TITLES[page.group!]
        : CHAPTERS.find(chapter => chapter.id === page.chapter)!.title
    let group = groups.find(candidate => candidate.title === title)
    if (!group) groups.push((group = { title, icon: CHAPTER_ICONS[page.chapter], items: [] }))
    group.items.push({
      title: page.title,
      href: guidePageHref(line, page),
      current: current?.id === page.id && current.group === page.group,
    })
  }
  return groups
}

export interface GuideView {
  page: GuidePage
  lowered: Lowered
  crumbs: Crumb[]
  toc: TocEntry[]
  canonical: string
  /** The pages before and after it in reading order, over the chapters; the appendices stand apart. */
  previous?: { title: string; href: string }
  next?: { title: string; href: string }
  /** Where the page sits in the chapters, for a page of one: `{ index: 3, total: 41 }`, counted from 1. */
  progress?: { index: number; total: number }
  requires: { title: string; href: string }[]
}

/** One Guide page of a line, lowered for Prose, by its path; undefined when the Guide has no such page. */
export function guideView(line: string, pagePath: string): GuideView | undefined {
  const all = guideEntries(line)
  const entry = all.find(candidate => guidePath(candidate.page) === pagePath)
  if (!entry) return undefined
  const { page, body } = entry

  const lowered = lowerMarkdown(body, {
    href: url => resolveGuideLink(line, url),
    example: (file, region, from) => resolveExample(from ?? line, file, region, { page: pagePath }),
  })
  const toc = lowered.headings
    .filter(heading => heading.depth === 2 || heading.depth === 3)
    .map(heading => ({ id: heading.id, title: heading.title, depth: heading.depth as 2 | 3 }))
  const chapter = CHAPTERS.find(candidate => candidate.id === page.chapter)!
  const crumbs: Crumb[] = [
    { title: line, href: docsHref({ kind: 'line', line }, VERSIONS) },
    { title: page.chapter === 'appendix' ? GROUP_TITLES[page.group!] : chapter.title },
    { title: page.title },
  ]

  // Reading order runs through the chapters; an appendix page links its own group's neighbours.
  const sequence = all.filter(candidate =>
    page.chapter === 'appendix'
      ? candidate.page.chapter === 'appendix' && candidate.page.group === page.group
      : candidate.page.chapter !== 'appendix',
  )
  const at = sequence.indexOf(entry)
  const link = (neighbour?: Entry) =>
    neighbour && { title: neighbour.page.title, href: guidePageHref(line, neighbour.page) }
  const byId = new Map(all.map(candidate => [candidate.page.id, candidate.page]))

  return {
    page,
    lowered,
    crumbs,
    toc,
    canonical: guidePageHref(line, page),
    previous: link(sequence[at - 1]),
    next: link(sequence[at + 1]),
    progress: page.chapter === 'appendix' ? undefined : { index: at + 1, total: sequence.length },
    requires: page.requires.flatMap(id => {
      const required = byId.get(id)
      return required ? [{ title: required.title, href: guidePageHref(line, required) }] : []
    }),
  }
}

/** The sidebar's tabs where the Guide is rendered: the Guide's first page, and the line's API reference. */
export function guideTabs(line: string, current: 'guide' | 'api'): NavTab[] {
  const [first] = guideEntries(line)
  const api = apiLandingHref(line)
  return [
    ...(first ? [{ title: 'Guide', href: guidePageHref(line, first.page), current: current === 'guide' }] : []),
    ...(api ? [{ title: 'API', href: api, current: current === 'api' }] : []),
  ]
}
