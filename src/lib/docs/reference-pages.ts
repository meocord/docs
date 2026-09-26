import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { A, H1, H2, H3, Li, type NodeInstance, P, Span, Strong, Time, Ul } from '@meonode/ui'
import { listPages, type PageEntry } from '../../../scripts/lib/pages'
import { Prose } from '@/components/nodes'
import { Window } from '@/components/shell/Window'
import type { TocEntry } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { lineVersions } from '@/lib/docs/api-site'
import { REPOSITORY } from '@/lib/docs/render'
import { lines, sidebar, versionChoices } from '@/lib/docs/site'
import { lowerMarkdown } from '@/lib/prose/lower'
import { changelogSectionAnchor, docsHref, resolveStoredHref } from '@/lib/urls'

type Child = NodeInstance | string

interface ChangelogEntry {
  markdown: string
  breaking: boolean
}

interface Changelog {
  version: string
  /** The day the registry published it, `YYYY-MM-DD`. */
  published?: string
  sections: { title: string; entries: ChangelogEntry[] }[]
}

const generated = (...parts: string[]) => path.join(process.cwd(), 'generated', ...parts)
const lower = (markdown: string) => lowerMarkdown(markdown, { href: url => resolveStoredHref(url, VERSIONS) })
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** A line's changelog, newest version first, from the versions that have one. */
export function lineChangelog(line: string): Changelog[] {
  return lineVersions(line).flatMap(version => {
    const file = generated('changelog', `${version}.json`)
    return existsSync(file) ? [JSON.parse(readFileSync(file, 'utf8')) as Changelog] : []
  })
}

/** A line's changelog for one version, or undefined when the line has none for it. */
export function versionChangelog(line: string, version: string): Changelog | undefined {
  return lineChangelog(line).find(changelog => changelog.version === version)
}

/** Every `{ line, version }` with a changelog, for the release pages to prerender. */
export function changelogParams(): { line: string; version: string }[] {
  return lines().flatMap(line => lineChangelog(line).map(changelog => ({ line, version: changelog.version })))
}

const releaseHref = (line: string, version: string) => docsHref({ kind: 'changelog', line, version }, VERSIONS)

/** A publish day as readers see it, such as 25 September 2026, the same wherever the site is built. */
const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/** When a version was published, as a paragraph, or nothing for one the registry gave no date. */
function publishedLine(changelog: Changelog, key: string): Child[] {
  if (!changelog.published) return []
  return [
    P(['Published ', Time(formatDay(changelog.published), { key: 'day', dateTime: changelog.published })], {
      key,
      'data-api-meta': true,
    }),
  ]
}

const KINDS: Record<string, string> = { 'Major Changes': 'major', 'Minor Changes': 'minor', 'Patch Changes': 'patch' }

/**
 * A release in one line, from its sections: `2 minor changes and 3 patch changes, 1 breaking`, or
 * `No changes recorded.` for a release with none.
 */
export function changelogSummary(changelog: Changelog): string {
  const counts = changelog.sections.map(section => {
    const count = section.entries.length
    const kind = KINDS[section.title]
    const noun = kind ? `${kind} change` : section.title.toLowerCase().replace(/s$/, '')
    return `${count} ${noun}${count === 1 ? '' : 's'}`
  })
  if (counts.length === 0) return 'No changes recorded.'
  const listed = counts.length === 1 ? counts[0] : `${counts.slice(0, -1).join(', ')} and ${counts.at(-1)}`
  const breaking = changelog.sections.flatMap(section => section.entries).filter(entry => entry.breaking).length
  return breaking > 0 ? `${listed}, ${breaking} breaking` : listed
}

/** A release's sections, each a heading of `level` over its entries, breaking entries marked. */
function releaseNodes(changelog: Changelog, level: 2 | 3, idPrefix: string): { nodes: Child[]; toc: TocEntry[] } {
  const Heading = level === 2 ? H2 : H3
  const nodes: Child[] = []
  const toc: TocEntry[] = []
  if (changelog.sections.length === 0) {
    nodes.push(P('No changes recorded.', { key: `${idPrefix}none`, 'data-api-meta': true }))
  }
  for (const section of changelog.sections) {
    const id = `${idPrefix}${changelogSectionAnchor(section.title)}`
    toc.push({ id, title: section.title, depth: level })
    nodes.push(
      Heading(section.title, { key: id, id, 'data-group': true }),
      Ul({
        key: `${id}-list`,
        children: section.entries.map(entry =>
          Li({
            key: entry.markdown,
            'data-breaking': entry.breaking || undefined,
            children: [
              ...(entry.breaking ? [Span('Breaking', { key: 'badge', 'data-badge': 'deprecated' }), ' '] : []),
              ...lower(entry.markdown).nodes,
            ],
          }),
        ),
      }),
    )
  }
  return { nodes, toc }
}

const migratingLink = (line: string) =>
  A({ key: 'migrating', href: docsHref({ kind: 'migrating', line }, VERSIONS), children: 'migration guide' })

/**
 * The changelog page's content: the newest release in full, then every earlier one as a line with
 * its day and what it holds, linking its own page, so the page stays one release long as the line
 * grows.
 */
export function changelogArticle(line: string): { nodes: Child[]; toc: TocEntry[] } | undefined {
  const [newest, ...earlier] = lineChangelog(line)
  if (!newest) return undefined
  const newestId = slug(newest.version)
  const release = releaseNodes(newest, 3, `${newestId}-`)
  const nodes: Child[] = [
    H1(`Changelog for ${line}`, { key: 'title' }),
    P(
      [
        'The newest release in full, and every earlier one on a page of its own. Entries marked Breaking change a working bot; the ',
        migratingLink(line),
        ' says what to do about them.',
      ],
      { key: 'lead' },
    ),
    H2(A({ href: releaseHref(line, newest.version), children: newest.version }), { key: newestId, id: newestId }),
    ...publishedLine(newest, `${newestId}-published`),
    ...release.nodes,
  ]
  const toc: TocEntry[] = [{ id: newestId, title: newest.version, depth: 2 }]
  if (earlier.length > 0) {
    nodes.push(
      H2('Earlier releases', { key: 'earlier', id: 'earlier-releases' }),
      Ul({
        key: 'earlier-list',
        'data-releases': true,
        children: earlier.map(changelog =>
          Li({
            key: changelog.version,
            children: [
              A({ key: 'version', href: releaseHref(line, changelog.version), children: changelog.version }),
              ...(changelog.published
                ? [' · ', Time(formatDay(changelog.published), { key: 'day', dateTime: changelog.published })]
                : []),
              ' · ',
              changelogSummary(changelog),
            ],
          }),
        ),
      }),
    )
    toc.push({ id: 'earlier-releases', title: 'Earlier releases', depth: 2 })
  }
  return { nodes, toc }
}

/** One release's page content: its day, then its sections, breaking entries marked. */
export function releaseArticle(line: string, version: string): { nodes: Child[]; toc: TocEntry[] } | undefined {
  const changelog = versionChangelog(line, version)
  if (!changelog) return undefined
  const release = releaseNodes(changelog, 2, '')
  const nodes: Child[] = [
    H1(`${version} changelog`, { key: 'title' }),
    ...publishedLine(changelog, 'published'),
    P(
      [
        'Entries marked Breaking change a working bot; the ',
        migratingLink(line),
        ' says what to do about them. Every release of the line is in the ',
        A({ key: 'changelog', href: docsHref({ kind: 'changelog', line }, VERSIONS), children: 'changelog' }),
        '.',
      ],
      { key: 'lead' },
    ),
    ...release.nodes,
  ]
  return { nodes, toc: release.toc }
}

/** The migration guide's content, as the library ships it for the line. */
/** Whether a line has a migration guide, without lowering it. */
export function hasMigrating(line: string): boolean {
  return existsSync(generated('migrating', `${line}.md`))
}

export function migratingArticle(line: string): { nodes: Child[]; toc: TocEntry[] } | undefined {
  const file = generated('migrating', `${line}.md`)
  if (!existsSync(file)) return undefined
  const lowered = lower(readFileSync(file, 'utf8'))
  const toc = lowered.headings
    .filter(heading => heading.depth === 2 || heading.depth === 3)
    .map(heading => ({ id: heading.id, title: heading.title, depth: heading.depth as 2 | 3 }))
  return { nodes: lowered.nodes, toc }
}

/** A page id's entries in every line that has it, by line. */
function pagesWithId(id: string): { line: string; page: PageEntry }[] {
  return lines().flatMap(line => {
    const page = listPages(line).find(entry => entry.id === id || entry.formerly.includes(id))
    return page ? [{ line, page }] : []
  })
}

/** Every `{ line, id }` a missing page is prerendered for: each id a line lacks that another line has. */
export function missingParams(): { line: string; id: string }[] {
  const all = new Set(lines().flatMap(line => listPages(line).map(page => page.id)))
  return lines().flatMap(line => {
    const here = new Set(listPages(line).flatMap(page => [page.id, ...page.formerly]))
    return [...all].filter(id => !here.has(id)).map(id => ({ line, id }))
  })
}

/** The page a reader lands on when a line has no page with this id: where it is, and what this line has. */
export function missingArticle(line: string, id: string): { nodes: Child[]; title: string } | undefined {
  const elsewhere = pagesWithId(id).filter(found => found.line !== line)
  if (elsewhere.length === 0 || !lines().includes(line)) return undefined
  const title = elsewhere[0].page.title
  const since = elsewhere.map(found => found.page.since).find(Boolean)
  const nodes: Child[] = [
    H1(`Not in ${line}`, { key: 'title' }),
    P(
      [
        Strong(title, { key: 'page' }),
        ` is not documented for MeoCord ${line}`,
        since ? `: it first appears in ${since}.` : '.',
      ],
      { key: 'lead' },
    ),
    H2('Where it is documented', { key: 'elsewhere', id: 'elsewhere' }),
    Ul({
      key: 'elsewhere-list',
      children: elsewhere.map(({ line: other, page: { slug, title } }) =>
        Li({
          key: other,
          children: A({
            href: docsHref({ kind: 'guide', line: other, slug }, VERSIONS),
            children: `${title} in ${other}`,
          }),
        }),
      ),
    }),
    H2(`What ${line} documents`, { key: 'index', id: 'in-this-line' }),
    ...sidebar(line).flatMap(group => [
      H3(group.title, { key: `g-${group.title}` }),
      Ul({
        key: `g-${group.title}-list`,
        children: group.items.map(({ href, title }) => Li({ key: href, children: A({ href, children: title }) })),
      }),
    ]),
  ]
  return { nodes, title }
}

/** A reference page in the docs window, under `parent` in the crumbs when it has one. */
function page(
  line: string,
  title: string,
  nodes: Child[],
  toc: TocEntry[],
  options: { id?: string; current?: string; parent?: { title: string; href: string } } = {},
) {
  return Window({
    crumbs: [
      { title: line, href: docsHref({ kind: 'line', line }, VERSIONS) },
      ...(options.parent ? [options.parent] : []),
      { title },
    ],
    groups: sidebar(line, options.current),
    version: versionChoices(line, options.id),
    repository: REPOSITORY,
    toc,
    children: Prose({ children: nodes }),
  })
}

export function renderChangelog(line: string) {
  const article = changelogArticle(line)
  return article && page(line, 'Changelog', article.nodes, article.toc, { current: 'changelog' })
}

export function renderRelease(line: string, version: string) {
  const article = releaseArticle(line, version)
  const parent = { title: 'Changelog', href: docsHref({ kind: 'changelog', line }, VERSIONS) }
  return article && page(line, version, article.nodes, article.toc, { current: 'changelog', parent })
}

export function renderMigrating(line: string) {
  const article = migratingArticle(line)
  return article && page(line, 'Migrating', article.nodes, article.toc, { current: 'migrating' })
}

export function renderMissing(line: string, id: string) {
  const article = missingArticle(line, id)
  return article && page(line, `Not in ${line}`, article.nodes, [], { id })
}
