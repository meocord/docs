import {
  A,
  Blockquote,
  Code,
  Div,
  H1,
  H2,
  H3,
  Li,
  Node,
  type NodeInstance,
  P,
  Pre,
  Span,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Ul,
} from '@meonode/ui'
import { Prose } from '@/components/nodes'
import { Window } from '@/components/shell/Window'
import type { Crumb, NavGroup, TocEntry, VersionOption } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { decoratorSummary, highlightSource, layoutKey, type LayoutForm, type Layouts } from '@/lib/docs/api-layout'
import type { ApiListing, ApiMember, ApiModel, ApiParam, ApiSignature, ApiSymbol, Token } from '@/lib/docs/api-model'
import { apiLayouts, apiModel, resolveSiteHref } from '@/lib/docs/api-site'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { guideEnabled, guideTabs } from '@/lib/docs/guide-site'
import { highlightTokens } from '@/lib/prose/highlight'
import { lowerMarkdown } from '@/lib/prose/lower'
import { docsHref } from '@/lib/urls'

type Child = NodeInstance | string

/** Markdown from a doc comment, lowered as a guide's is. */
const markdown = (text: string, key: string): Child[] =>
  text
    ? [
        Div({
          key,
          'data-doc': true,
          children: lowerMarkdown(text, { href: resolveSiteHref }).nodes,
        }),
      ]
    : []

const tokensText = (tokens: Token[]) => tokens.map(token => token.text).join('')

/** Where each linked token lands in the display, found by name in order: formatting moves only spaces. */
function linkRanges(tokens: Token[], display: string): { start: number; end: number; href: string }[] {
  const ranges: { start: number; end: number; href: string }[] = []
  let cursor = 0
  for (const token of tokens) {
    if (!token.href) continue
    const escaped = token.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const found = new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`, 'g')
    found.lastIndex = cursor
    const match = found.exec(display)
    if (!match) continue
    ranges.push({ start: match.index, end: match.index + token.text.length, href: token.href })
    cursor = match.index + token.text.length
  }
  return ranges
}

// Every page shows the same types again, across versions too: each source is highlighted once.
const highlighted = new Map<string, (string | undefined)[]>()

/** The colours of each character of a source, as the highlighter draws it. */
function sourceStyles(source: string) {
  let styles = highlighted.get(source)
  if (!styles) {
    styles = []
    for (const token of highlightTokens(source, 'ts') ?? []) {
      const style = Object.entries(token.style)
        .map(([name, value]) => `${name}:${value}`)
        .join(';')
      for (let index = 0; index < token.length; index += 1) styles[token.offset + index] = style
    }
    highlighted.set(source, styles)
  }
  return styles
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttribute = (text: string) => escapeHtml(text).replace(/"/g, '&quot;')

/**
 * Code as TypeScript, as HTML for the inside of a `<code>`: formatted over lines when `bun run
 * api:layout` laid it out, highlighted as a guide's code is, each documented symbol it names linked.
 * Markup rather than nodes, as for a guide's code: a long signature draws hundreds of runs.
 */
function typeCode(tokens: Token[], form: LayoutForm, layouts: Layouts): string {
  const display = layouts[layoutKey(form, tokensText(tokens))] ?? tokensText(tokens)
  const { source, start } = highlightSource(form, display)
  const styles = sourceStyles(source)
  const links = linkRanges(tokens, display)
  // Runs of one colour within one link; a space joins the run before it, whatever its colour.
  const runs: { text: string; style?: string; href?: string }[] = []
  for (let index = 0; index < display.length; index += 1) {
    const char = display[index]
    const href = links.find(link => index >= link.start && index < link.end)?.href
    const style = styles[start[index]]
    const last = runs.at(-1)
    if (last && last.href === href && (last.style === style || /\s/.test(char))) last.text += char
    else runs.push({ text: char, style, href })
  }
  let html = ''
  runs.forEach((run, index) => {
    if (run.href && runs[index - 1]?.href !== run.href) html += `<a href="${escapeAttribute(run.href)}">`
    html += run.style ? `<span style="${run.style}">${escapeHtml(run.text)}</span>` : escapeHtml(run.text)
    if (run.href && runs[index + 1]?.href !== run.href) html += '</a>'
  })
  return html
}

/** Declarations as a code block, one per overload, a blank line between them once any runs over lines. */
function signatureBlock(lines: Token[][], form: LayoutForm, layouts: Layouts, key: string) {
  const tall = lines.some(line => layouts[layoutKey(form, tokensText(line))] !== undefined)
  const html = lines.map(line => typeCode(line, form, layouts)).join(tall ? '\n\n' : '\n')
  return Pre(Code(null, { dangerouslySetInnerHTML: { __html: html } }), {
    key,
    'data-signature': true, // It scrolls sideways, so it takes focus for keyboard readers to scroll it.
    tabIndex: 0,
  })
}

const badge = (text: string, tone: 'since' | 'deprecated', key: string) => Span(text, { key, 'data-badge': tone })

function paramsTable(params: ApiParam[], layouts: Layouts, key: string, ownerSince?: string) {
  // A parameter's version is shown only when it came later than what it belongs to.
  const later = (param: ApiParam) => (param.since && param.since !== ownerSince ? param.since : undefined)
  const since = params.some(param => later(param))
  const defaults = params.some(param => param.defaultValue !== undefined)
  const header = ['Name', 'Type', ...(defaults ? ['Default'] : []), ...(since ? ['Since'] : []), 'Description']
  return Div({
    key,
    'data-table': true,
    'data-params': true,
    children: Table({
      children: [
        Thead({ key: 'head', children: Tr({ children: header.map(title => Th({ key: title, children: title })) }) }),
        Tbody({
          key: 'body',
          children: params.map(param =>
            Tr({
              key: param.name,
              id: param.anchor,
              children: [
                Td({ key: 'name', children: Code(`${param.name}${param.optional ? '?' : ''}`) }),
                Td({
                  key: 'type',
                  children: param.type.length
                    ? Code(null, {
                        'data-type': true,
                        dangerouslySetInnerHTML: { __html: typeCode(param.type, 'param', layouts) },
                      })
                    : '',
                }),
                ...(defaults
                  ? [Td({ key: 'default', children: param.defaultValue ? Code(param.defaultValue) : '' })]
                  : []),
                ...(since ? [Td({ key: 'since', 'data-since': true, children: later(param) ?? '' })] : []),
                Td({ key: 'description', children: markdown(param.description, 'd') }),
              ],
            }),
          ),
        }),
      ],
    }),
  })
}

/** The anchors a page's own sections use, kept clear of its members' and options' anchors. */
function sectionIds(anchors: string[]) {
  const taken = new Set(anchors)
  const id = (name: string) => (taken.has(name) ? `${name}-section` : name)
  return {
    parameters: id('parameters'),
    returns: id('returns'),
    throws: id('throws'),
    examples: id('examples'),
    members: id('members'),
    seeAlso: id('see-also'),
  }
}

/** A signature's parameters, returns, throws and examples, under headings of `level`. */
function signatureDetails(
  signature: ApiSignature,
  layouts: Layouts,
  level: 'h2' | 'h4',
  ids: ReturnType<typeof sectionIds> | undefined,
  key: string,
  toc: TocEntry[],
  ownerSince?: string,
): Child[] {
  const heading = (title: string, id: string | undefined) => {
    if (level === 'h2' && id) toc.push({ id, title, depth: 2 })
    return Node(level, { key: `${key}-${title}`, id, children: title })
  }
  const out: Child[] = []
  if (signature.params.length > 0) {
    out.push(
      heading('Parameters', ids?.parameters),
      paramsTable(signature.params, layouts, `${key}-params`, ownerSince),
    )
    // Each option under its parameters, where it has an anchor to go to
    if (level === 'h2') {
      for (const param of signature.params)
        if (param.anchor) toc.push({ id: param.anchor, title: param.name.split('.').pop()!, depth: 3 })
    }
  }
  if (signature.returns) {
    out.push(
      heading('Returns', ids?.returns),
      ...(signature.returns.decorates
        ? [P(decoratorSummary(signature.returns.decorates), { key: `${key}-returns-kind` })]
        : []),
      signatureBlock([signature.returns.type], 'returns', layouts, `${key}-returns`),
      ...markdown(signature.returns.description, `${key}-returns-d`),
    )
  }
  if (signature.throws.length > 0) {
    out.push(
      heading('Throws', ids?.throws),
      Ul({
        key: `${key}-throws`,
        children: signature.throws.map(text => Li({ key: text, children: markdown(text, 'd') })),
      }),
    )
  }
  if (signature.examples.length > 0) {
    out.push(
      heading('Examples', ids?.examples),
      ...signature.examples.flatMap((text, index) => markdown(text, `${key}-ex-${index}`)),
    )
  }
  return out
}

function memberSection(member: ApiMember, layouts: Layouts, toc: TocEntry[], symbolSince?: string): Child[] {
  const since = member.since && member.since !== symbolSince ? member.since : undefined
  toc.push({ id: member.anchor, title: member.name, depth: 3 })
  return [
    H3(
      [
        Code(member.name, { key: 'name' }),
        ...(since ? [' ', badge(`Since ${since}`, 'since', 'since')] : []),
        ...(member.deprecated ? [' ', badge('Deprecated', 'deprecated', 'deprecated')] : []),
      ],
      { key: `m-${member.anchor}`, id: member.anchor },
    ),
    signatureBlock(member.code, 'member', layouts, `m-${member.anchor}-code`),
    ...(member.deprecated
      ? [Blockquote({ key: `m-${member.anchor}-dep`, children: markdown(member.deprecated, 'd') })]
      : []),
    ...markdown(member.description, `m-${member.anchor}-d`),
    ...(member.defaultValue
      ? [P(['Default: ', Code(member.defaultValue, { key: 'v' })], { key: `m-${member.anchor}-default` })]
      : []),
    ...member.signatures.flatMap((signature, index) =>
      signatureDetails(signature, layouts, 'h4', undefined, `m-${member.anchor}-s${index}`, toc, member.since),
    ),
    ...member.examples.flatMap((text, index) => markdown(text, `m-${member.anchor}-ex-${index}`)),
  ]
}

/**
 * The page's content: the symbol's declaration, documentation and members, their long code laid
 * out as `layouts` formats it.
 */
export function apiArticle(symbol: ApiSymbol, layouts: Layouts = {}): { nodes: Child[]; toc: TocEntry[] } {
  const toc: TocEntry[] = []
  const ids = sectionIds(symbol.anchors)
  const nodes: Child[] = [
    H1(symbol.name, { key: 'title' }),
    P(
      [
        Span(symbol.kind.replace('-', ' '), { key: 'kind' }),
        ' in ',
        // Every entry point it can be imported from, the declaring one first
        ...symbol.imports.flatMap((entry, index) => [
          ...(index > 0 ? [index === symbol.imports.length - 1 ? ' and ' : ', '] : []),
          Code(entry, { key: `entry-${entry}` }),
        ]),
        ...(symbol.since ? [' ', badge(`Since ${symbol.since}`, 'since', 'since')] : []),
        ...(symbol.deprecated ? [' ', badge('Deprecated', 'deprecated', 'deprecated')] : []),
      ],
      { key: 'meta', 'data-api-meta': true },
    ),
    ...(symbol.deprecated ? [Blockquote({ key: 'deprecated', children: markdown(symbol.deprecated, 'd') })] : []),
    signatureBlock(symbol.code, 'declaration', layouts, 'code'),
    ...markdown(symbol.description, 'description'),
  ]

  const [first, ...overloads] = symbol.signatures
  if (first) {
    nodes.push(
      ...signatureDetails(
        { ...first, examples: [...first.examples, ...symbol.examples] },
        layouts,
        'h2',
        ids,
        's0',
        toc,
        symbol.since,
      ),
    )
  }
  overloads.forEach((signature, index) =>
    nodes.push(...signatureDetails(signature, layouts, 'h4', undefined, `s${index + 1}`, toc, symbol.since)),
  )
  if (!first && symbol.examples.length > 0) {
    toc.push({ id: ids.examples, title: 'Examples', depth: 2 })
    nodes.push(
      H2('Examples', { key: 'examples', id: ids.examples }),
      ...symbol.examples.flatMap((text, index) => markdown(text, `ex-${index}`)),
    )
  }
  if (symbol.members.length > 0) {
    toc.push({ id: ids.members, title: 'Members', depth: 2 })
    nodes.push(H2('Members', { key: 'members', id: ids.members }))
    for (const member of symbol.members) nodes.push(...memberSection(member, layouts, toc, symbol.since))
  }
  if (symbol.seeAlso.length > 0) {
    toc.push({ id: ids.seeAlso, title: 'See also', depth: 2 })
    nodes.push(
      H2('See also', { key: 'see-also', id: ids.seeAlso }),
      Ul({
        key: 'see-also-list',
        children: symbol.seeAlso.map(({ href, text }) =>
          Li({ key: text, children: href ? A({ href, children: text }) : text }),
        ),
      }),
    )
  }
  return { nodes, toc }
}

/**
 * The sidebar of an API page: the line's guides where they share the sidebar, then a group per section,
 * an entry point's symbols or a kind's, those under their categories.
 */
export function apiSidebar(line: string, model: ApiModel, current?: string): NavGroup[] {
  return [
    // Where the Guide is rendered, the Guide and the API are tabs of their own.
    ...(guideEnabled(line) ? [] : sidebar(line)),
    ...model.sections().map(section => ({
      title: section.title,
      items: section.symbols.map(symbol => ({
        title: symbol.name,
        href: symbol.href,
        current: symbol.href === current,
        badge: symbol.deprecated ? 'Deprecated' : undefined,
        // Headed only by kind, where a kind's symbols are listed by category; an entry point's are in source order
        category: model.scheme.by === 'kind' ? symbol.category : undefined,
      })),
    })),
  ]
}

/** The switcher from an API page: each line opens the same symbol when its API has one. */
function apiVersions(line: string, name: string): { current: VersionOption; options: VersionOption[] } {
  const { current, options } = versionChoices(line)
  return {
    current,
    options: options.map(option => {
      const other = apiModel(option.label)
      const location = other?.find(name)
      return other && location ? { ...option, href: other.href(location) } : option
    }),
  }
}

/** The trail to an API page: its line, then its entry point, or the API index and its kind. */
export function apiCrumbs(line: string, model: ApiModel, section: string, title?: string): Crumb[] {
  const lineCrumb = { title: line, href: docsHref({ kind: 'line', line }, VERSIONS) }
  if (model.scheme.by === 'entry') return [lineCrumb, ...(title ? [{ title }] : [])]
  const kind = model.sections().find(candidate => candidate.slug === section)
  return [
    lineCrumb,
    { title: 'API', href: docsHref({ kind: 'api-index', line }, VERSIONS) },
    ...(kind ? [{ title: kind.title, href: docsHref({ kind: 'api-index', line, section }, VERSIONS) }] : []),
  ]
}

/** A symbol's page in the docs window, or undefined when the API has no such symbol. */
export function renderApiPage(line: string, section: string, name: string, version?: string) {
  const model = apiModel(line, version)
  const symbol = model?.symbol(section, name)
  if (!model || !symbol) return undefined
  const href = model.href({ section: symbol.section, symbol: symbol.name })
  const { nodes, toc } = apiArticle(symbol, apiLayouts(line, version))
  const trail = apiCrumbs(line, model, symbol.section, symbol.entry)
  const crumbs: Crumb[] = [
    trail[0],
    ...(version ? [{ title: version }] : []),
    ...trail.slice(1),
    { title: symbol.name },
  ]
  return Window({
    crumbs,
    groups: apiSidebar(line, model, href),
    tabs: guideEnabled(line) ? guideTabs(line, 'api') : undefined,
    version: apiVersions(line, symbol.name),
    repository: REPOSITORY,
    toc,
    children: Prose({ children: nodes }),
  })
}

/** An id for a heading from its text: `Pipeline stages` gives `pipeline-stages`. */
const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Symbols as a list: each one's name, linked to its page, and its summary. */
function listing(symbols: ApiListing[], key: string) {
  return Ul({
    key,
    'data-api-list': true,
    children: symbols.map(symbol =>
      Li({
        key: symbol.name,
        children: [
          A({ key: 'name', href: symbol.href, children: Code(symbol.name) }),
          ...(symbol.deprecated ? [' ', badge('Deprecated', 'deprecated', 'deprecated')] : []),
          ...markdown(symbol.summary, 'summary'),
        ],
      }),
    ),
  })
}

/** A section's symbols, those without a category first, then each category under a heading of `level`. */
function categorised(symbols: ApiListing[], level: 'h2' | 'h3', key: string, toc?: TocEntry[]): Child[] {
  const categories = [...new Set(symbols.map(symbol => symbol.category))]
  return categories.flatMap(category => {
    const members = symbols.filter(symbol => symbol.category === category)
    if (!category) return [listing(members, `${key}-list`)]
    const id = `${key}-${headingId(category)}`
    if (toc) toc.push({ id, title: category, depth: 2 })
    return [Node(level, { key: id, id, children: category }), listing(members, `${id}-list`)]
  })
}

/** The index's content: every symbol of the API with its summary, by kind, each kind linked to its page. */
export function apiIndexArticle(line: string, model: ApiModel): { nodes: Child[]; toc: TocEntry[] } {
  const toc: TocEntry[] = []
  const nodes: Child[] = [
    H1('API', { key: 'title' }),
    P(`Every public symbol of MeoCord ${line}, by kind. Each page names the entry point to import it from.`, {
      key: 'intro',
    }),
    ...model.sections().flatMap(section => {
      toc.push({ id: section.slug, title: section.title, depth: 2 })
      const href = docsHref({ kind: 'api-index', line, section: section.slug }, VERSIONS)
      return [
        H2(A({ href, children: section.title }), { key: section.slug, id: section.slug, 'data-kind-heading': true }),
        ...categorised(section.symbols, 'h3', section.slug),
      ]
    }),
  ]
  return { nodes, toc }
}

/** A kind's page content: its symbols with their summaries, by category; undefined for no such kind. */
export function apiKindArticle(model: ApiModel, section: string): { nodes: Child[]; toc: TocEntry[] } | undefined {
  const kind = model.sections().find(candidate => candidate.slug === section)
  if (!kind) return undefined
  const toc: TocEntry[] = []
  return { nodes: [H1(kind.title, { key: 'title' }), ...categorised(kind.symbols, 'h2', section, toc)], toc }
}

/** A line's API index, where its API is arranged by kind: every symbol with its summary, by kind. */
export function renderApiIndex(line: string) {
  const model = apiModel(line)
  if (!model || model.scheme.by !== 'kind') return undefined
  const { nodes, toc } = apiIndexArticle(line, model)
  return Window({
    crumbs: [apiCrumbs(line, model, '')[0], { title: 'API' }],
    groups: apiSidebar(line, model),
    tabs: guideTabs(line, 'api'),
    version: versionChoices(line),
    repository: REPOSITORY,
    toc,
    children: Prose({ children: nodes }),
  })
}

/** One kind's page of a line's API: its symbols with their summaries, by category. */
export function renderApiKind(line: string, section: string) {
  const model = apiModel(line)
  const article = model?.scheme.by === 'kind' ? apiKindArticle(model, section) : undefined
  if (!model || !article) return undefined
  const trail = apiCrumbs(line, model, section)
  return Window({
    crumbs: [...trail.slice(0, 2), { title: trail[2]?.title ?? section }],
    groups: apiSidebar(line, model),
    tabs: guideTabs(line, 'api'),
    version: versionChoices(line),
    repository: REPOSITORY,
    toc: article.toc,
    children: Prose({ children: article.nodes }),
  })
}
