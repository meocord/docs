/**
 * The Guide: a line's pages in reading order, chapter by chapter, from content/<line>/. Each page
 * follows one template (fixed sections in a fixed order), links other pages and the API by `guide:`
 * and `api:` targets that the check resolves, and pulls every code block from the line's examples.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import { CONFIG_REFERENCE_SLUG, configReferencePage, type ConfigDocument } from './config-reference'
import { EXAMPLE_SOURCE, fenceLanguages, hasRegion, markdownLinks, pageAnchors, withoutCode } from './content'
import { withPackageSpec } from './package-spec'
import { newestIn, readVersions, type VersionsConfig } from './versions'
import { memberAnchor } from '../../src/lib/urls'
import { displacedTerms } from '../../src/lib/prose/anchors'
import { parseDispatchList } from '../../src/playground/dispatch-list'
import { outsideModules, READER_MODULES } from '../../src/playground/runtime/modules'

/** The Guide's chapters, in reading order, then the appendices. */
export const CHAPTERS = [
  { id: 'start', title: 'Start' },
  { id: 'interactions', title: 'Handling interactions' },
  { id: 'messages', title: 'Messages and events' },
  { id: 'structure', title: 'Structuring your app' },
  { id: 'pipeline', title: 'The request pipeline' },
  { id: 'testing', title: 'Testing' },
  { id: 'shipping', title: 'Shipping' },
  { id: 'appendix', title: 'Appendices' },
] as const

export type ChapterId = (typeof CHAPTERS)[number]['id']

/** The paths under `/docs/<line>/` the site already routes, from src/app/docs/[line]/'s folders. */
export function routedSlugs(root: string): string[] {
  return readdirSync(path.join(root, 'src', 'app', 'docs', '[line]'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('['))
    .map(entry => entry.name)
}

/**
 * Guide paths that take one of the site's own: a routed path, or one below it. An appendix
 * group's folder, `recipes/…` or `coming-from/…`, is a Guide path's own, and only the folder itself is taken.
 */
export function reservedProblems(root: string, plan = GUIDE_PLAN): string[] {
  const reserved = new Set(routedSlugs(root))
  // The groups whose pages sit in a folder of their own, as guidePath places them
  const folders = new Set(['recipes', 'coming-from'])
  return Object.values(plan)
    .flat()
    .filter(page => reserved.has(page.split('/')[0]!) || folders.has(page))
    .map(page => `The Guide's plan has "${page}", a path the site routes itself`)
}

/**
 * The Guide as approved: every page's path, by chapter. It is the one list of the Guide's slugs; a page
 * must be on it, and a link to a page on it that is not written yet counts as planned, not broken.
 */
export const GUIDE_PLAN: Readonly<Record<ChapterId, readonly string[]>> = {
  start: ['overview', 'getting-started', 'first-command', 'project-structure'],
  interactions: [
    'slash-commands',
    'subcommands',
    'components',
    'autocomplete',
    'context-menus',
    'responses',
    'defer',
    'presenters',
    'install-contexts',
  ],
  messages: ['message-commands', 'message-params', 'reactions', 'gateway-events', 'lifecycle-hooks'],
  structure: ['services', 'configuration', 'theming', 'localisation', 'handler-discovery'],
  pipeline: [
    'how-a-call-runs',
    'guards',
    'validation',
    'interceptors',
    'cooldowns',
    'exception-filters',
    'observers',
    'custom-decorators',
  ],
  testing: ['testing', 'invoke-and-dispatch', 'mocks', 'testing-recipes'],
  shipping: ['cli', 'self-contained-builds', 'deployment', 'sharding', 'security', 'eslint'],
  appendix: [
    'recipes/pagination',
    'recipes/database',
    'recipes/moderation',
    'recipes/tickets',
    'recipes/scheduled',
    'recipes/i18n-bot',
    'recipes/select-menus',
    'recipes/cooldown-stores',
    'coming-from/discordjs',
    'coming-from/sapphire',
    'coming-from/discordx',
    'coming-from/necord',
    'what-can-i-build',
    'config-reference',
    'troubleshooting',
    'faq',
    'glossary',
    'whats-new',
  ],
}

/** The appendices' groups; recipes and coming-from pages take their group in the URL. */
export const APPENDIX_GROUPS = ['recipes', 'coming-from', 'help'] as const
export type AppendixGroup = (typeof APPENDIX_GROUPS)[number]

/** The API's kinds, each a segment of `/docs/<line>/api/<kind>/<Symbol>`. */
export const API_KINDS = [
  'controllers',
  'decorators',
  'responses',
  'utilities',
  'testing',
  'configuration',
  'cli',
  'types',
] as const

export interface GuideFrontmatter {
  id?: string
  title?: string
  chapter?: string
  order?: number
  group?: string
  summary?: string
  learn?: string[]
  requires?: string[]
  api?: string[]
  since?: string
  formerly?: string[]
  covers?: string[]
  terms?: boolean
}

export interface GuidePage {
  id: string
  title: string
  chapter: ChapterId
  order: number
  group?: AppendixGroup
  summary: string
  learn: string[]
  requires: string[]
  api: string[]
  since?: string
  /** The old slugs of this line that redirect to the page. */
  formerly: string[]
  /** The ids of other lines' pages on the same topic, such as 4.0's `command-types` for slash commands. */
  covers: string[]
  /** Whether the page defines terms, each an anchor of its own; see `anchorIds`. */
  terms: boolean
}

/** The repository root the Guide is read from (the tests point it at a scratch directory). */
const docsRoot = (root?: string) => root ?? process.env.MEOCORD_DOCS_ROOT ?? process.cwd()

/** Where a line's Guide is written, below the repository root. */
export function guideFolder(line: string, root?: string): string {
  return path.join(docsRoot(root), 'content', line)
}

// The lines whose guides are authored, by versions.json's path and modification time: read again only once
// the file changes, as under `next dev`, where a line's pages call this for every link they resolve
const authoredLines = new Map<string, { modified: number; lines: ReadonlySet<string> }>()

/** Whether the site renders a line's Guide: a line whose guides are authored, as versions.json lists it. */
export function guideRendered(line: string, root?: string): boolean {
  const file = path.resolve(docsRoot(root), 'versions.json')
  const modified = existsSync(file) ? statSync(file).mtimeMs : -1
  let known = authoredLines.get(file)
  if (known?.modified !== modified) {
    const lines = modified < 0 ? [] : readVersions(file).lines.filter(entry => entry.guides === 'authored')
    known = { modified, lines: new Set(lines.map(entry => entry.line)) }
    authoredLines.set(file, known)
  }
  return known.lines.has(line)
}

export function parseGuidePage(text: string): { frontmatter: GuideFrontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { frontmatter: {}, body: text }
  return { frontmatter: (parseYaml(match[1]) ?? {}) as GuideFrontmatter, body: text.slice(match[0].length) }
}

/**
 * A page file as the site reads it: its entry, or undefined when its front matter would fail the check,
 * which `content:check` reports.
 */
export function readGuidePage(slug: string, text: string): { page?: GuidePage; body: string } {
  const { frontmatter, body } = parseGuidePage(text)
  return { page: readFrontmatter('', slug, frontmatter, []), body }
}

/** A page as the lines' pages are matched: its id, the old slugs it took over, and the pages it covers. */
export interface TopicPage {
  id: string
  formerly: readonly string[]
  /** `<line>/<id>[#<anchor>]`: a page of a line on this page's topic, or a retired one of its own line. */
  covers?: readonly string[]
}

/** A `covers` entry, `<line>/<id>[#<anchor>]`, or undefined when it isn't one. */
export function parseCover(entry: string): { line: string; id: string; anchor?: string } | undefined {
  const match = /^(\d+\.\d+)\/([a-z0-9][a-z0-9-]*)(?:#([a-z0-9][a-z0-9-]*))?$/.exec(entry)
  return match ? { line: match[1], id: match[2], anchor: match[3] } : undefined
}

/**
 * The page of `line` on the same topic as a page of `from`, and the section to land at: the page with its
 * id; else the page it covers in `line`; else a page of `line` that covers it; else one it took an old slug
 * of, or that took an old slug of its. The version switcher, the missing pages and the alias redirects all
 * decide it here.
 */
export function counterpartIn<T extends TopicPage>(
  pages: readonly T[],
  line: string,
  page: TopicPage,
  from: string,
): { page: T; anchor?: string } | undefined {
  const exact = pages.find(candidate => candidate.id === page.id)
  if (exact) return { page: exact }
  for (const cover of (page.covers ?? []).map(parseCover)) {
    const covered = cover?.line === line ? pages.find(candidate => candidate.id === cover.id) : undefined
    if (covered) return { page: covered, anchor: cover!.anchor }
  }
  const covering = pages.find(candidate =>
    (candidate.covers ?? []).some(entry => {
      const cover = parseCover(entry)
      return cover?.line === from && cover.id === page.id
    }),
  )
  if (covering) return { page: covering }
  const renamed = pages.find(candidate => page.formerly.includes(candidate.id) || candidate.formerly.includes(page.id))
  return renamed && { page: renamed }
}

/** The page of `line` known by an id of that line: its own, a retired one it covers, or an old slug it took over. */
export function pageKnownAs<T extends TopicPage>(pages: readonly T[], line: string, id: string): T | undefined {
  return (
    pages.find(page => page.id === id) ??
    pages.find(page =>
      (page.covers ?? []).some(entry => parseCover(entry)?.line === line && parseCover(entry)?.id === id),
    ) ??
    pages.find(page => page.formerly.includes(id))
  )
}

/** A page's path below `/docs/<line>/`: its id, under its group for recipes and coming-from pages. */
export function guidePath(page: Pick<GuidePage, 'id' | 'group'>): string {
  return page.group === 'recipes' || page.group === 'coming-from' ? `${page.group}/${page.id}` : page.id
}

/** The Guide in reading order: chapter by chapter, then by `order` within a chapter and its group. */
export function readingOrder(pages: GuidePage[]): GuidePage[] {
  const chapter = (page: GuidePage) => CHAPTERS.findIndex(entry => entry.id === page.chapter)
  const group = (page: GuidePage) => (page.group ? APPENDIX_GROUPS.indexOf(page.group) : -1)
  return [...pages].sort(
    (a, b) => chapter(a) - chapter(b) || group(a) - group(b) || a.order - b.order || a.id.localeCompare(b.id),
  )
}

/**
 * A line's configuration reference, an appendix page generated from its newest version's generated/config
 * file; undefined without one.
 */
export function configReferenceText(line: string, config: VersionsConfig, root?: string): string | undefined {
  const entry = config.lines.find(candidate => candidate.line === line)
  if (!entry || entry.versions.length === 0) return undefined
  const file = path.join(docsRoot(root), 'generated', 'config', `${newestIn(entry)}.json`)
  return existsSync(file)
    ? configReferencePage(line, JSON.parse(readFileSync(file, 'utf8')) as ConfigDocument)
    : undefined
}

/** A line's Guide in reading order, each page with its body; a page whose front matter fails content:check is left out. */
export function readGuide(line: string, root?: string): { page: GuidePage; body: string }[] {
  const dir = guideFolder(line, root)
  if (!existsSync(dir)) return []
  const config = JSON.parse(readFileSync(path.join(docsRoot(root), 'versions.json'), 'utf8')) as VersionsConfig
  const files: [string, string][] = readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(file => [file.replace(/\.md$/, ''), withPackageSpec(readFileSync(path.join(dir, file), 'utf8'), config, line)])
  const reference = configReferenceText(line, config, root)
  if (reference) files.push([CONFIG_REFERENCE_SLUG, reference])
  const read = files.flatMap(([slug, text]) => {
    const { page, body } = readGuidePage(slug, text)
    return page ? [{ page, body }] : []
  })
  return readingOrder(read.map(entry => entry.page)).map(page => read.find(entry => entry.page === page)!)
}

/** The sections a chapter page has, in order; `required` ones must be there. */
const SECTIONS = [
  { heading: 'When to use it', required: true },
  { heading: 'Example', required: true },
  { heading: 'How it works', required: true },
  { heading: 'Gotchas', required: false },
  { heading: 'Build it', required: false },
  { heading: 'Next steps', required: true },
] as const
const FIXED = new Set<string>(SECTIONS.map(section => section.heading))

/** A recipe's sections, in order, all required. */
const RECIPE_SECTIONS = ['The code', 'How it works', 'Variations', 'Next steps']

const SUMMARY_LIMIT = 160
/**
 * The fences a page may carry. Code comes from examples/, where it's typechecked, so these are commands, data,
 * output, and the files a deployment writes that nothing typechecks: a Dockerfile, a service unit, `.env`, TOML.
 */
const FENCES = new Set(['bash', 'json', 'yaml', 'text', 'dotenv', 'dockerfile', 'ini', 'toml'])
const TYPESCRIPT_FENCE = /^\s*(`{3,}|~{3,})\s*(ts|typescript|tsx|mts|cts|js|javascript)\b/m
const EXAMPLE = /::example\{([^}]*)\}/g
const PLAYGROUND = /^::playground\{([^}]*)\}\s*$/gm
const PLAYGROUND_ATTRIBUTES = ['file', 'region', 'dispatch', 'expect']
const NOT_AN_API_REF = 'is not api:<kind>/<Symbol>'

/** A link to the site by its address, which a page writes as a guide: or api: link instead. */
const SELF_LINK = /^https?:\/\/(?:www\.)?meocord\.dev(?:\/|$)/

/**
 * What is wrong with an API reference, `<kind>/<Symbol>[#member]`, or undefined: a form other than that, a
 * symbol the API lacks, a kind other than the one its `@group` files it under, or a member it lacks.
 */
function apiRefProblem(ref: string, symbols: GuideContext['apiSymbols']): string | undefined {
  const [path, member] = ref.split('#', 2)
  const [kind, name, ...rest] = path.split('/')
  if (rest.length > 0 || !(API_KINDS as readonly string[]).includes(kind) || !name) return NOT_AN_API_REF
  const symbol = symbols.get(name)
  if (!symbol) return 'names no symbol of the API'
  if (symbol.kinds.length > 0 && !symbol.kinds.includes(kind))
    return `names a symbol filed under ${symbol.kinds.join(' and ')}, not ${kind}`
  // A member is written as named, `#cooldownStore`, and linked by its anchor, as the page renders it
  if (member !== undefined && !symbol.members.includes(memberAnchor(member))) return `names no member of ${name}`
  return undefined
}

const GITHUB_MIGRATING = /^https:\/\/github\.com\/meocord\/meocord\/(?:blob|tree)\/[^/]+\/docs\/MIGRATING\.md$/

/** What the check reads besides the pages: the line's example files and the API's symbol names. */
/** The pages a `covers` entry may name, by line. */
export interface Coverable {
  /** The lines versions.json lists. */
  lines: readonly string[]
  /** Each line's current pages, by id, with their headings' anchors where known. */
  pages: Record<string, Record<string, readonly string[] | undefined>>
  /** Each line's pages the deployed site served, by id. */
  deployed: Record<string, readonly string[]>
}

export interface GuideContext {
  line: string
  /** Example files per folder, keyed by their path under examples/<folder>/. */
  examples: Record<string, Record<string, string>>
  /**
   * Every symbol the line's newest version exports, by name: the kinds its `@group` tags file it under,
   * lowercased, and its members' anchors. A symbol with no `@group` has no kind to check.
   */
  apiSymbols: Map<string, { kinds: string[]; members: string[] }>
  /** The headings of the line's migration guide, which `guide:migrating#…` links. */
  migratingAnchors?: Set<string>
  /** What a `covers` entry may name; without it, only its form is checked. */
  coverable?: Coverable
  /** The line's generated pages, by slug: pages others link, held to no template. */
  generated?: Record<string, string>
  /**
   * Whether the Guide is complete, as it must be once it replaces the line's guides: a link to a
   * planned page not yet written then fails instead of being counted.
   */
  complete?: boolean
}

/** What the check finds: the problems, and the links to planned pages not written yet. */
export interface GuideReport {
  problems: string[]
  planned: string[]
}

const PLANNED = new Set(Object.values(GUIDE_PLAN).flat())

function headingsOf(body: string): { level: number; text: string }[] {
  return withoutCode(body)
    .split('\n')
    .flatMap(line => {
      const match = /^(#{1,6}) (.+?)\s*#*\s*$/.exec(line)
      return match ? [{ level: match[1].length, text: match[2] }] : []
    })
}

/** A page's front matter as a GuidePage, or the problems that keep it from being one. */
function readFrontmatter(where: string, slug: string, fm: GuideFrontmatter, problems: string[]): GuidePage | undefined {
  const before = problems.length
  if (!fm.id) problems.push(`${where}: front matter has no id`)
  else if (fm.id !== slug) problems.push(`${where}: id "${fm.id}" is not the file's name`)
  if (!fm.title) problems.push(`${where}: front matter has no title`)
  const chapter = CHAPTERS.find(entry => entry.id === fm.chapter)?.id
  if (!chapter)
    problems.push(`${where}: chapter "${fm.chapter ?? ''}" is none of ${CHAPTERS.map(entry => entry.id).join(', ')}`)
  if (!Number.isInteger(fm.order) || (fm.order ?? 0) < 1) problems.push(`${where}: order is not a whole number from 1`)
  const group = APPENDIX_GROUPS.find(entry => entry === fm.group)
  if (chapter === 'appendix' && !group)
    problems.push(`${where}: an appendix page has a group, one of ${APPENDIX_GROUPS.join(', ')}`)
  if (chapter !== 'appendix' && fm.group !== undefined) problems.push(`${where}: only an appendix page has a group`)
  if (!fm.summary) problems.push(`${where}: front matter has no summary`)
  else if (fm.summary.length > SUMMARY_LIMIT)
    problems.push(`${where}: the summary is ${fm.summary.length} characters, over ${SUMMARY_LIMIT}`)
  const learn = fm.learn ?? []
  if (chapter && chapter !== 'appendix' && (learn.length < 2 || learn.length > 4))
    problems.push(`${where}: learn has ${learn.length} item(s), not two to four`)
  for (const entry of fm.api ?? []) {
    const [kind, symbol, ...rest] = entry.split('/')
    if (rest.length > 0 || !symbol || !(API_KINDS as readonly string[]).includes(kind))
      problems.push(`${where}: api entry "${entry}" is not <kind>/<Symbol>, with a kind of ${API_KINDS.join(', ')}`)
  }
  if (fm.terms !== undefined && typeof fm.terms !== 'boolean') problems.push(`${where}: terms is true or false`)
  if (problems.length > before) return undefined
  return {
    id: fm.id!,
    title: fm.title!,
    chapter: chapter!,
    order: fm.order!,
    group,
    summary: fm.summary!,
    learn,
    requires: fm.requires ?? [],
    api: fm.api ?? [],
    since: fm.since,
    formerly: fm.formerly ?? [],
    covers: fm.covers ?? [],
    terms: fm.terms === true,
  }
}

/**
 * The paths below `/docs/<line>/` the Guide takes, which no old slug can redirect from: every page's of
 * the plan and of the pages given, and the appendix groups' folders, whose pages sit below them.
 */
export function guideTaken(pages: readonly Pick<GuidePage, 'id' | 'group'>[] = []): Set<string> {
  return new Set([...PLANNED, 'recipes', 'coming-from', ...pages.map(guidePath)])
}

/**
 * Checks each old slug a page redirects from: a slug of its own, claimed by one page, and no path the Guide
 * or its plan takes, which the redirect would never reach.
 */
function checkFormerly(
  folder: string,
  pages: Map<string, { page: GuidePage }>,
  problems: string[],
  coverable?: Coverable,
): void {
  const taken = guideTaken([...pages.values()].map(({ page }) => page))
  const claimed = new Map<string, string>()
  for (const [slug, { page }] of pages)
    for (const old of page.formerly) {
      const where = `${folder}/${slug}.md`
      if (!/^[a-z0-9][a-z0-9-]*$/.test(old)) problems.push(`${where}: formerly "${old}" is not a page slug`)
      else if (taken.has(old)) problems.push(`${where}: formerly "${old}" is a path the Guide takes`)
      // Named once, with both pages, since neither is the one to change
      else if (claimed.has(old))
        problems.push(`${folder}: formerly "${old}" is claimed by ${claimed.get(old)} and ${slug}; one page only`)
      claimed.set(old, slug)
    }
  // A page covers another line's page on its topic, many pages one, as 4.1's slash-commands and context-menus
  // both cover 4.0/command-types; or a page its own line retired, which no current page is known by.
  // A retired page of its own line is claimed by one page only, which pageKnownAs finds by it.
  const current = new Set([...pages.values()].flatMap(({ page }) => [page.id, ...page.formerly]))
  const retired = new Map<string, string>()
  for (const [slug, { page }] of pages)
    for (const entry of page.covers) {
      const where = `${folder}/${slug}.md: covers "${entry}"`
      const cover = parseCover(entry)
      const line = folder.slice('content/'.length)
      if (cover?.line === line && !current.has(cover.id)) {
        const claimant = retired.get(cover.id)
        if (claimant && claimant !== slug)
          problems.push(`${folder}: covers "${entry}" is claimed by ${claimant} and ${slug}; one page only`)
        else retired.set(cover.id, slug)
      }
      if (!cover) problems.push(`${where} is not <line>/<id>, with an optional #anchor`)
      else if (!coverable) continue
      else if (!coverable.lines.includes(cover.line)) problems.push(`${where} names a line versions.json doesn't list`)
      else if (cover.line === line && cover.id === page.id) problems.push(`${where} is the page itself`)
      else if (cover.line === line && current.has(cover.id))
        problems.push(`${where} is a current page of this line, where only a retired one can be covered`)
      else if (cover.line === line && !coverable.deployed[line]?.includes(cover.id))
        problems.push(`${where} names no page this line's deployed site served`)
      else if (
        cover.line !== line &&
        !(cover.id in (coverable.pages[cover.line] ?? {})) &&
        !coverable.deployed[cover.line]?.includes(cover.id)
      )
        problems.push(`${where} names no page of ${cover.line}`)
      else if (cover.anchor && !coverable.pages[cover.line]?.[cover.id]?.includes(cover.anchor))
        problems.push(`${where} names no heading of that page`)
    }
}

/**
 * The regions of an examples folder that nothing shows: no `::example` or `::playground` of the pages
 * given embeds them, and they are not among `shown`, what the site embeds by itself. `from` is how an
 * embed names the folder, as `from="compare"`; a line's own folder has none. A tutorial's `step:` regions
 * mark the steps of a file shown whole, and are not embedded by name.
 */
export function unembeddedRegions(
  folder: string,
  examples: Record<string, string>,
  pages: readonly string[],
  { from, shown = [] }: { from?: string; shown?: readonly { file: string; region: string }[] } = {},
): string[] {
  const embedded = new Set(shown.map(({ file, region }) => `${file}#${region}`))
  for (const body of pages)
    for (const match of withoutCode(body).matchAll(/::(?:example|playground)\{([^}]*)\}/g)) {
      const attributes = Object.fromEntries(
        [...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
      )
      if (attributes.from === from && attributes.region) embedded.add(`${attributes.file}#${attributes.region}`)
    }
  return Object.entries(examples).flatMap(([file, text]) => {
    if (!file.startsWith('src/')) return []
    const path = file.slice('src/'.length)
    return [...text.matchAll(/\/\/ #region (\S+)/g)]
      .map(([, region]) => region)
      .filter(region => !region.startsWith('step:') && !embedded.has(`${path}#${region}`))
      .map(region => `examples/${folder}/${file}: region "${region}" is embedded by no page; embed it, or remove it`)
  })
}

/** Checks the sections: the template's headings present and in order, no H1, nothing below `###`. */
function checkSections(where: string, page: GuidePage, body: string, problems: string[]): void {
  const headings = headingsOf(body)
  if (headings.some(heading => heading.level === 1)) problems.push(`${where}: the body has an H1; the title is the H1`)
  if (headings.some(heading => heading.level > 3)) problems.push(`${where}: a heading is deeper than ###`)
  const h2 = headings.filter(heading => heading.level === 2).map(heading => heading.text)
  if (page.chapter === 'appendix') {
    if (page.group !== 'recipes') return
    for (const heading of RECIPE_SECTIONS)
      if (!h2.includes(heading)) problems.push(`${where}: a recipe has a "## ${heading}" section`)
    for (const heading of h2)
      if (!RECIPE_SECTIONS.includes(heading))
        problems.push(`${where}: "## ${heading}" is no recipe section; use ### under one of them`)
    const found = h2.filter(heading => RECIPE_SECTIONS.includes(heading))
    if (found.join('\n') !== RECIPE_SECTIONS.filter(heading => found.includes(heading)).join('\n'))
      problems.push(`${where}: a recipe's sections run ${RECIPE_SECTIONS.join(', ')}`)
    return
  }
  for (const section of SECTIONS)
    if (section.required && !h2.includes(section.heading))
      problems.push(`${where}: the page has no "## ${section.heading}" section`)
  const fixed = h2.filter(text => FIXED.has(text))
  const expected = SECTIONS.map(section => section.heading).filter(heading => fixed.includes(heading))
  if (fixed.join('\n') !== expected.join('\n'))
    problems.push(`${where}: the fixed sections run ${SECTIONS.map(section => section.heading).join(', ')}`)
  // Topic sections sit after How it works and before the closing sections: Gotchas, Build it, Next steps.
  const at = (heading: string) => h2.indexOf(heading)
  const closing = ['Gotchas', 'Build it', 'Next steps'].map(at).find(index => index >= 0) ?? h2.length
  const topics = h2.filter(text => !FIXED.has(text))
  if (topics.some(text => at(text) < at('How it works') || at(text) > closing))
    problems.push(`${where}: a topic section sits outside How it works … Gotchas, Build it and Next steps`)
  if (at('Build it') >= 0 && at('Build it') !== at('Next steps') - 1)
    problems.push(`${where}: Build it comes right before Next steps`)
  if (new Set(h2).size !== h2.length) problems.push(`${where}: two sections share a heading`)
}

/** The callouts a page may carry. */
const CALLOUTS = new Set(['NOTE', 'TIP', 'WARNING'])

/** Checks the callouts: `> [!NOTE]`, `> [!TIP]` or `> [!WARNING]`, and at most one in a section. */
function checkCallouts(where: string, body: string, problems: string[]): void {
  let section = '(the lead)'
  let count = 0
  for (const line of withoutCode(body).split('\n')) {
    const heading = /^## (.+?)\s*$/.exec(line)
    if (heading) {
      section = heading[1]
      count = 0
      continue
    }
    const callout = /^>\s*\[!(\w+)\]/.exec(line)
    if (!callout) continue
    if (!CALLOUTS.has(callout[1]))
      problems.push(`${where}: a [!${callout[1]}] callout; a page's callouts are NOTE, TIP and WARNING`)
    if (++count === 2) problems.push(`${where}: "${section}" has more than one callout`)
  }
}

/** The figures a page can draw with `::figure{name="…"}`; src/lib/docs/figures.ts draws each. */
export const GUIDE_FIGURES = ['pipeline'] as const

function checkExamples(where: string, body: string, context: GuideContext, problems: string[]): void {
  for (const match of withoutCode(body).matchAll(/^::figure\{([^}]*)\}\s*$/gm)) {
    const name = /^name="([\w-]+)"$/.exec(match[1].trim())?.[1]
    if (!name || !(GUIDE_FIGURES as readonly string[]).includes(name))
      problems.push(`${where}: ::figure{${match[1]}} names no figure; a page can draw ${GUIDE_FIGURES.join(', ')}`)
  }
  for (const match of withoutCode(body).matchAll(EXAMPLE)) {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    )
    if (attributes.from !== undefined && attributes.from !== EXAMPLE_SOURCE) {
      problems.push(`${where}: an ::example reads from "${attributes.from}", but only "${EXAMPLE_SOURCE}" can be named`)
      continue
    }
    const folder = attributes.from ?? context.line
    if (!attributes.file) {
      problems.push(`${where}: an ::example names no file`)
      continue
    }
    const source = context.examples[folder]?.[`src/${attributes.file}`]
    if (source === undefined) problems.push(`${where}: examples/${folder}/src/${attributes.file} does not exist`)
    else if (attributes.region && !hasRegion(source, attributes.region))
      problems.push(`${where}: examples/${folder}/src/${attributes.file} has no region "${attributes.region}"`)
  }
  // Lowered only as a paragraph of its own; anywhere else it would show as its text
  const lines = withoutCode(body).split('\n')
  const blank = (at: number) => (lines[at] ?? '').trim() === ''
  for (const [at, line] of lines.entries())
    if (/::playground\b/.test(line) && !(/^::playground\{[^}]*\}\s*$/.test(line) && blank(at - 1) && blank(at + 1)))
      problems.push(`${where}: a ::playground stands alone in its paragraph, not in "${line.trimEnd()}"`)
  for (const match of withoutCode(body).matchAll(PLAYGROUND)) checkPlayground(where, match[1], context, problems)
}

/**
 * A `::playground{file region dispatch expect}`: the region shows as an ::example does, and Run runs the whole
 * file, so the file imports only what the playground's runtime carries, and the dispatch parses. `expect="refused"`
 * says its last input is refused, as a cooldown or a user error refuses one.
 */
function checkPlayground(where: string, written: string, context: GuideContext, problems: string[]): void {
  const pairs = [...written.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value] as const)
  const attributes: Record<string, string> = Object.fromEntries(pairs)
  const unknown = pairs.map(([key]) => key).filter(key => !PLAYGROUND_ATTRIBUTES.includes(key))
  if (unknown.length > 0)
    problems.push(`${where}: a ::playground takes ${PLAYGROUND_ATTRIBUTES.join(', ')}, not ${unknown.join(', ')}`)
  if (!attributes.file) {
    problems.push(`${where}: a ::playground names no file`)
    return
  }
  const file = `examples/${context.line}/src/${attributes.file}`
  const source = context.examples[context.line]?.[`src/${attributes.file}`]
  if (source === undefined) problems.push(`${where}: ${file} does not exist`)
  else {
    if (attributes.region && !hasRegion(source, attributes.region))
      problems.push(`${where}: ${file} has no region "${attributes.region}"`)
    const outside = outsideModules(source)
    if (outside.length > 0)
      problems.push(
        `${where}: ${file} imports ${outside.map(specifier => `'${specifier}'`).join(', ')}; a playground runs one file, which imports only ${READER_MODULES.join(', ')}`,
      )
  }
  if (attributes.dispatch === undefined) problems.push(`${where}: a ::playground names no dispatch`)
  else {
    const list = parseDispatchList(attributes.dispatch)
    if (typeof list === 'string') problems.push(`${where}: ${list}`)
  }
  if (attributes.expect !== undefined && attributes.expect !== 'refused')
    problems.push(`${where}: a ::playground expects "refused" or nothing, not "${attributes.expect}"`)
}

/** Checks every `guide:` and `api:` link; any other page link is written as one of those. */
function checkLinks(
  where: string,
  body: string,
  pages: Map<string, { page: GuidePage; anchors: Set<string> }>,
  context: GuideContext,
  ownAnchors: Set<string>,
  problems: string[],
  planned: string[],
): void {
  const byPath = new Map([...pages.values()].map(entry => [guidePath(entry.page), entry]))
  for (const target of markdownLinks(body)) {
    const [base, anchor] = target.split('#', 2)
    if (target.startsWith('#')) {
      if (!ownAnchors.has(target.slice(1))) problems.push(`${where}: no heading for ${target}`)
    } else if (base.startsWith('guide:')) {
      const targetPath = base.slice('guide:'.length)
      const entry = byPath.get(targetPath)
      if (targetPath === 'changelog') continue
      if (targetPath === 'migrating') {
        if (anchor && context.migratingAnchors && !context.migratingAnchors.has(anchor))
          problems.push(`${where}: ${target} names no heading of the migration guide`)
      } else if (entry) {
        if (anchor && !entry.anchors.has(anchor))
          problems.push(`${where}: ${target} names no ${entry.page.terms ? 'heading or term' : 'heading'} of that page`)
      } else if (PLANNED.has(targetPath) && !context.complete) planned.push(`${where}: ${target}`)
      else problems.push(`${where}: ${target} names no Guide page`)
    } else if (base.startsWith('api:')) {
      const problem = apiRefProblem(target.slice('api:'.length), context.apiSymbols)
      if (problem) problems.push(`${where}: ${target} ${problem}`)
    } else if (SELF_LINK.test(target)) {
      problems.push(`${where}: ${target} links the site by its address; write guide:<id> or api:<kind>/<Symbol>`)
    } else if (GITHUB_MIGRATING.test(base)) {
      problems.push(
        `${where}: ${target} links the migration guide on GitHub; write guide:migrating${anchor ? `#${anchor}` : ''}`,
      )
    } else if (
      !/^[a-z][\w+.-]*:/i.test(base) &&
      (base.startsWith('/') || /^\.\.?\//.test(base) || /\.md$/.test(base))
    ) {
      problems.push(`${where}: ${target} links a page by path; write guide:<id> or api:<kind>/<Symbol>`)
    }
  }
}

/**
 * Checks a line's Guide against the template: front matter, sections, examples and links, plus each
 * chapter's orders and the prerequisites it names. Pages are keyed by their file's name.
 */
export function checkGuide(files: Record<string, string>, context: GuideContext): GuideReport {
  const problems: string[] = []
  const planned: string[] = []
  const folder = `content/${context.line}`
  const pages = new Map<string, { page: GuidePage; body: string; anchors: Set<string> }>()
  for (const [slug, text] of Object.entries(files)) {
    const where = `${folder}/${slug}.md`
    const { frontmatter, body } = parseGuidePage(text)
    const page = readFrontmatter(where, slug, frontmatter, problems)
    if (page) pages.set(slug, { page, body, anchors: pageAnchors(body, page) })
  }
  // A generated page, such as the configuration reference, is linked like any other but written by no one
  const generated = new Set<string>()
  for (const [slug, text] of Object.entries(context.generated ?? {})) {
    const { frontmatter, body } = parseGuidePage(text)
    const page = readFrontmatter(`generated ${slug}`, slug, frontmatter, problems)
    if (page) pages.set(slug, { page, body, anchors: pageAnchors(body, page) })
    generated.add(slug)
  }

  const orders = new Map<string, string>()
  const known = new Set(pages.keys())
  for (const [slug, { page, body, anchors }] of pages) {
    if (generated.has(slug)) continue
    const where = `${folder}/${slug}.md`
    const place = `${page.chapter}/${page.group ?? ''}/${page.order}`
    if (orders.has(place)) problems.push(`${where}: order ${page.order} is also ${orders.get(place)}'s`)
    orders.set(place, slug)
    if (!PLANNED.has(guidePath(page))) problems.push(`${where}: ${guidePath(page)} is not a page of the Guide's plan`)
    for (const id of page.requires) {
      if (known.has(id)) continue
      if (PLANNED.has(id) && !context.complete) planned.push(`${where}: requires "${id}"`)
      else problems.push(`${where}: requires "${id}", which is no page`)
    }
    // An entry of the wrong form is reported with the front matter
    for (const entry of page.api) {
      const problem = apiRefProblem(entry, context.apiSymbols)
      if (problem && problem !== NOT_AN_API_REF) problems.push(`${where}: api entry "${entry}" ${problem}`)
    }
    checkSections(where, page, body, problems)
    for (const language of fenceLanguages(body))
      if (!FENCES.has(language) && !TYPESCRIPT_FENCE.test(`\`\`\`${language}`))
        problems.push(`${where}: a code fence is marked "${language}"; a page's fences are ${[...FENCES].join(', ')}`)
    if (TYPESCRIPT_FENCE.test(body))
      problems.push(
        `${where}: TypeScript belongs in examples/${context.line} and an ::example directive, not a code fence`,
      )
    // A term keeps its own anchor, so a link to it holds whatever order the page lists its terms in
    if (page.terms)
      for (const { term, own, id } of displacedTerms(body))
        problems.push(`${where}: the term "${term}" would be #${id}, since #${own} is already taken`)
    checkCallouts(where, body, problems)
    checkExamples(where, body, context, problems)
    checkLinks(where, body, pages, context, anchors, problems, planned)
  }
  checkFormerly(folder, pages, problems, context.coverable)
  // A link or region used more than once on a page is reported once.
  return { problems: [...new Set(problems)], planned: [...new Set(planned)] }
}
