import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Node, type NodeInstance } from '@meonode/ui'
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
    Node('h1', { key: 'title', children: `Changelog for ${line}` }),
    Node('p', {
      key: 'lead',
      children: [
        'Every release of the line, newest first. Entries marked Breaking change a working bot; the ',
        Node('a', {
          key: 'migrating',
          href: docsHref({ kind: 'migrating', line }, VERSIONS),
          children: 'migration guide',
        }),
        ' says what to do about them.',
      ],
    }),
  ]
  for (const changelog of changelogs) {
    const id = changelogAnchor(changelog.version)
    toc.push({ id, title: changelog.version, depth: 2 })
    nodes.push(Node('h2', { key: id, id, children: changelog.version }))
    if (changelog.sections.length === 0) {
      nodes.push(Node('p', { key: `${id}-none`, 'data-api-meta': true, children: 'No changes recorded.' }))
    }
    for (const section of changelog.sections) {
      const sectionId = `${id}-${slug(section.title)}`
      nodes.push(
        Node('h3', { key: sectionId, id: sectionId, children: section.title }),
        Node('ul', {
          key: `${sectionId}-list`,
          children: section.entries.map((entry, index) =>
            Node('li', {
              key: index,
              'data-breaking': entry.breaking || undefined,
              children: [
                ...(entry.breaking
                  ? [Node('span', { key: 'badge', 'data-badge': 'deprecated', children: 'Breaking' }), ' ']
                  : []),
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
    Node('h1', { key: 'title', children: `Not in ${line}` }),
    Node('p', {
      key: 'lead',
      children: [
        Node('strong', { key: 'page', children: title }),
        ` is not documented for MeoCord ${line}`,
        since ? `: it first appears in ${since}.` : '.',
      ],
    }),
    Node('h2', { key: 'elsewhere', id: 'elsewhere', children: 'Where it is documented' }),
    Node('ul', {
      key: 'elsewhere-list',
      children: elsewhere.map(found =>
        Node('li', {
          key: found.line,
          children: Node('a', {
            href: docsHref({ kind: 'guide', line: found.line, slug: found.page.slug }, VERSIONS),
            children: `${found.page.title} in ${found.line}`,
          }),
        }),
      ),
    }),
    Node('h2', { key: 'index', id: 'in-this-line', children: `What ${line} documents` }),
    ...sidebar(line).flatMap(group => [
      Node('h3', { key: `g-${group.title}`, children: group.title }),
      Node('ul', {
        key: `g-${group.title}-list`,
        children: group.items.map(item =>
          Node('li', { key: item.href, children: Node('a', { href: item.href, children: item.title }) }),
        ),
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
