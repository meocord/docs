import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { A, H1, H2, H3, Li, type NodeInstance, P, Span, Strong, Ul } from '@meonode/ui'
import { listPages, type PageEntry } from '../../../scripts/lib/pages'
import { Prose } from '@/components/prose/Prose'
import { Window } from '@/components/shell/Window'
import type { TocEntry } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { lineVersions } from '@/lib/docs/api-site'
import { REPOSITORY } from '@/lib/docs/render'
import { lines, sidebar, versionChoices } from '@/lib/docs/site'
import { lowerMarkdown } from '@/lib/prose/lower'
import { changelogAnchor, docsHref, resolveStoredHref } from '@/lib/urls'

type Child = NodeInstance | string

interface ChangelogEntry {
  markdown: string
  breaking: boolean
}

interface Changelog {
  version: string
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

/** The changelog page's content: a section per version at its anchor, breaking entries marked. */
export function changelogArticle(line: string): { nodes: Child[]; toc: TocEntry[] } | undefined {
  const changelogs = lineChangelog(line)
  if (changelogs.length === 0) return undefined
  const toc: TocEntry[] = []
  const nodes: Child[] = [
    H1(`Changelog for ${line}`, { key: 'title' }),
    P(
      [
        'Every release of the line, newest first. Entries marked Breaking change a working bot; the ',
        A({ key: 'migrating', href: docsHref({ kind: 'migrating', line }, VERSIONS), children: 'migration guide' }),
        ' says what to do about them.',
      ],
      { key: 'lead' },
    ),
  ]
  for (const changelog of changelogs) {
    const id = changelogAnchor(changelog.version)
    toc.push({ id, title: changelog.version, depth: 2 })
    nodes.push(H2(changelog.version, { key: id, id }))
    if (changelog.sections.length === 0) {
      nodes.push(P('No changes recorded.', { key: `${id}-none`, 'data-api-meta': true }))
    }
    for (const section of changelog.sections) {
      const sectionId = `${id}-${slug(section.title)}`
      nodes.push(
        H3(section.title, { key: sectionId, id: sectionId, 'data-group': true }),
        Ul({
          key: `${sectionId}-list`,
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
  }
  return { nodes, toc }
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

/** A reference page in the docs window. */
function page(
  line: string,
  title: string,
  nodes: Child[],
  toc: TocEntry[],
  options: { id?: string; current?: string } = {},
) {
  return Window({
    crumbs: [{ title: line, href: docsHref({ kind: 'line', line }, VERSIONS) }, { title }],
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

export function renderMigrating(line: string) {
  const article = migratingArticle(line)
  return article && page(line, 'Migrating', article.nodes, article.toc, { current: 'migrating' })
}

export function renderMissing(line: string, id: string) {
  const article = missingArticle(line, id)
  return article && page(line, `Not in ${line}`, article.nodes, [], { id })
}
