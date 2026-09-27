/**
 * The Guide: a line's pages in reading order, chapter by chapter, from content/<line>-next/. Each page
 * follows one template (fixed sections in a fixed order), links other pages and the API by `guide:`
 * and `api:` targets that the check resolves, and pulls every code block from the line's examples.
 */

import { parse as parseYaml } from 'yaml'
import { EXAMPLE_SOURCE, fenceLanguages, markdownLinks, pageAnchors, withoutCode } from './content'

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
  formerly: string[]
}

export function parseGuidePage(text: string): { frontmatter: GuideFrontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { frontmatter: {}, body: text }
  return { frontmatter: (parseYaml(match[1]) ?? {}) as GuideFrontmatter, body: text.slice(match[0].length) }
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
/** The fences a page may carry; code comes from examples/, so these are commands, data and output. */
const FENCES = new Set(['bash', 'json', 'yaml', 'text'])
const TYPESCRIPT_FENCE = /^\s*(`{3,}|~{3,})\s*(ts|typescript|tsx|mts|cts|js|javascript)\b/m
const EXAMPLE = /::example\{([^}]*)\}/g

/** What the check reads besides the pages: the line's example files and the API's symbol names. */
export interface GuideContext {
  line: string
  /** Example files per folder, keyed by their path under examples/<folder>/. */
  examples: Record<string, Record<string, string>>
  /**
   * Every symbol the line's newest version exports, by name. Only the name is checked: a symbol's kind
   * comes from its `@group` tag, which the API documents do not carry yet.
   */
  apiSymbols: Set<string>
}

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
  }
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
    if (h2.join('\n') !== RECIPE_SECTIONS.filter(heading => h2.includes(heading)).join('\n'))
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

function checkExamples(where: string, body: string, context: GuideContext, problems: string[]): void {
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
    else if (
      attributes.region &&
      !(source.includes(`// #region ${attributes.region}\n`) && source.includes(`// #endregion ${attributes.region}`))
    )
      problems.push(`${where}: examples/${folder}/src/${attributes.file} has no region "${attributes.region}"`)
  }
}

/** Checks every `guide:` and `api:` link; any other page link is written as one of those. */
function checkLinks(
  where: string,
  body: string,
  pages: Map<string, { page: GuidePage; anchors: Set<string> }>,
  context: GuideContext,
  ownAnchors: Set<string>,
  problems: string[],
): void {
  const byPath = new Map([...pages.values()].map(entry => [guidePath(entry.page), entry]))
  for (const target of markdownLinks(body)) {
    const [base, anchor] = target.split('#', 2)
    if (target.startsWith('#')) {
      if (!ownAnchors.has(target.slice(1))) problems.push(`${where}: no heading for ${target}`)
    } else if (base.startsWith('guide:')) {
      const entry = byPath.get(base.slice('guide:'.length))
      if (!entry) problems.push(`${where}: ${target} names no Guide page`)
      else if (anchor && !entry.anchors.has(anchor)) problems.push(`${where}: ${target} names no heading of that page`)
    } else if (base.startsWith('api:')) {
      const [kind, symbol, ...rest] = base.slice('api:'.length).split('/')
      if (rest.length > 0 || !(API_KINDS as readonly string[]).includes(kind) || !symbol)
        problems.push(`${where}: ${target} is not api:<kind>/<Symbol>`)
      else if (!context.apiSymbols.has(symbol)) problems.push(`${where}: ${target} names no symbol of the API`)
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
export function checkGuide(files: Record<string, string>, context: GuideContext): string[] {
  const problems: string[] = []
  const folder = `content/${context.line}-next`
  const pages = new Map<string, { page: GuidePage; body: string; anchors: Set<string> }>()
  for (const [slug, text] of Object.entries(files)) {
    const where = `${folder}/${slug}.md`
    const { frontmatter, body } = parseGuidePage(text)
    const page = readFrontmatter(where, slug, frontmatter, problems)
    if (page) pages.set(slug, { page, body, anchors: pageAnchors(body) })
  }

  const orders = new Map<string, string>()
  const known = new Set(pages.keys())
  for (const [slug, { page, body, anchors }] of pages) {
    const where = `${folder}/${slug}.md`
    const place = `${page.chapter}/${page.group ?? ''}/${page.order}`
    if (orders.has(place)) problems.push(`${where}: order ${page.order} is also ${orders.get(place)}'s`)
    orders.set(place, slug)
    for (const id of page.requires) if (!known.has(id)) problems.push(`${where}: requires "${id}", which is no page`)
    for (const entry of page.api)
      if (!context.apiSymbols.has(entry.split('/')[1].split('#')[0]))
        problems.push(`${where}: api entry "${entry}" names no symbol of the API`)
    checkSections(where, page, body, problems)
    for (const language of fenceLanguages(body))
      if (!FENCES.has(language) && !TYPESCRIPT_FENCE.test(`\`\`\`${language}`))
        problems.push(`${where}: a code fence is marked "${language}"; a page's fences are ${[...FENCES].join(', ')}`)
    if (TYPESCRIPT_FENCE.test(body))
      problems.push(
        `${where}: TypeScript belongs in examples/${context.line} and an ::example directive, not a code fence`,
      )
    checkExamples(where, body, context, problems)
    checkLinks(where, body, pages, context, anchors, problems)
  }
  // A link or region used more than once on a page is reported once.
  return [...new Set(problems)]
}
