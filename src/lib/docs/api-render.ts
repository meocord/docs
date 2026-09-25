import { Node, type NodeInstance } from '@meonode/ui'
import { Prose } from '@/components/prose/Prose'
import { Window } from '@/components/shell/Window'
import type { Crumb, NavGroup, TocEntry, VersionOption } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import { decoratorSummary, highlightSource, layoutKey, type LayoutForm, type Layouts } from '@/lib/docs/api-layout'
import type { ApiMember, ApiModel, ApiParam, ApiSignature, ApiSymbol, Token } from '@/lib/docs/api-model'
import { apiLayouts, apiModel } from '@/lib/docs/api-site'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { highlightTokens } from '@/lib/prose/highlight'
import { lowerMarkdown } from '@/lib/prose/lower'
import { docsHref, entrySegment, resolveStoredHref } from '@/lib/urls'

type Child = NodeInstance | string

/** Markdown from a doc comment, lowered as a guide's is. */
const markdown = (text: string, key: string): Child[] =>
  text
    ? [
        Node('div', {
          key,
          'data-doc': true,
          children: lowerMarkdown(text, { href: url => resolveStoredHref(url, VERSIONS) }).nodes,
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
  return Node('pre', {
    key,
    'data-signature': true,
    // It scrolls sideways, so it takes focus for keyboard readers to scroll it.
    tabIndex: 0,
    children: Node('code', { dangerouslySetInnerHTML: { __html: html } }),
  })
}

const badge = (text: string, tone: 'since' | 'deprecated', key: string) =>
  Node('span', { key, 'data-badge': tone, children: text })

function paramsTable(params: ApiParam[], layouts: Layouts, key: string, ownerSince?: string) {
  // A parameter's version is shown only when it came later than what it belongs to.
  const later = (param: ApiParam) => (param.since && param.since !== ownerSince ? param.since : undefined)
  const since = params.some(param => later(param))
  const defaults = params.some(param => param.defaultValue !== undefined)
  const header = ['Name', 'Type', ...(defaults ? ['Default'] : []), ...(since ? ['Since'] : []), 'Description']
  return Node('div', {
    key,
    'data-table': true,
    'data-params': true,
    children: Node('table', {
      children: [
        Node('thead', {
          key: 'head',
          children: Node('tr', { children: header.map(title => Node('th', { key: title, children: title })) }),
        }),
        Node('tbody', {
          key: 'body',
          children: params.map(param =>
            Node('tr', {
              key: param.name,
              children: [
                Node('td', {
                  key: 'name',
                  children: Node('code', { children: `${param.name}${param.optional ? '?' : ''}` }),
                }),
                Node('td', {
                  key: 'type',
                  children: param.type.length
                    ? Node('code', {
                        'data-type': true,
                        dangerouslySetInnerHTML: { __html: typeCode(param.type, 'param', layouts) },
                      })
                    : '',
                }),
                ...(defaults
                  ? [
                      Node('td', {
                        key: 'default',
                        children: param.defaultValue ? Node('code', { children: param.defaultValue }) : '',
                      }),
                    ]
                  : []),
                ...(since ? [Node('td', { key: 'since', 'data-since': true, children: later(param) ?? '' })] : []),
                Node('td', { key: 'description', children: markdown(param.description, 'd') }),
              ],
            }),
          ),
        }),
      ],
    }),
  })
}

/** The anchors a page's own sections use, kept clear of its members' anchors. */
function sectionIds(members: ApiMember[]) {
  const taken = new Set(members.map(member => member.anchor))
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
  }
  if (signature.returns) {
    out.push(
      heading('Returns', ids?.returns),
      ...(signature.returns.decorates
        ? [Node('p', { key: `${key}-returns-kind`, children: decoratorSummary(signature.returns.decorates) })]
        : []),
      signatureBlock([signature.returns.type], 'returns', layouts, `${key}-returns`),
      ...markdown(signature.returns.description, `${key}-returns-d`),
    )
  }
  if (signature.throws.length > 0) {
    out.push(
      heading('Throws', ids?.throws),
      Node('ul', {
        key: `${key}-throws`,
        children: signature.throws.map((text, index) => Node('li', { key: index, children: markdown(text, 'd') })),
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
    Node('h3', {
      key: `m-${member.anchor}`,
      id: member.anchor,
      children: [
        Node('code', { key: 'name', children: member.name }),
        ...(since ? [' ', badge(`Since ${since}`, 'since', 'since')] : []),
        ...(member.deprecated ? [' ', badge('Deprecated', 'deprecated', 'deprecated')] : []),
      ],
    }),
    signatureBlock(member.code, 'member', layouts, `m-${member.anchor}-code`),
    ...(member.deprecated
      ? [Node('blockquote', { key: `m-${member.anchor}-dep`, children: markdown(member.deprecated, 'd') })]
      : []),
    ...markdown(member.description, `m-${member.anchor}-d`),
    ...(member.defaultValue
      ? [
          Node('p', {
            key: `m-${member.anchor}-default`,
            children: ['Default: ', Node('code', { key: 'v', children: member.defaultValue })],
          }),
        ]
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
  const ids = sectionIds(symbol.members)
  const nodes: Child[] = [
    Node('h1', { key: 'title', children: symbol.name }),
    Node('p', {
      key: 'meta',
      'data-api-meta': true,
      children: [
        Node('span', { key: 'kind', children: symbol.kind.replace('-', ' ') }),
        ' in ',
        Node('code', { key: 'entry', children: symbol.entry }),
        ...(symbol.since ? [' ', badge(`Since ${symbol.since}`, 'since', 'since')] : []),
        ...(symbol.deprecated ? [' ', badge('Deprecated', 'deprecated', 'deprecated')] : []),
      ],
    }),
    ...(symbol.deprecated
      ? [Node('blockquote', { key: 'deprecated', children: markdown(symbol.deprecated, 'd') })]
      : []),
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
      Node('h2', { key: 'examples', id: ids.examples, children: 'Examples' }),
      ...symbol.examples.flatMap((text, index) => markdown(text, `ex-${index}`)),
    )
  }
  if (symbol.members.length > 0) {
    toc.push({ id: ids.members, title: 'Members', depth: 2 })
    nodes.push(Node('h2', { key: 'members', id: ids.members, children: 'Members' }))
    for (const member of symbol.members) nodes.push(...memberSection(member, layouts, toc, symbol.since))
  }
  if (symbol.seeAlso.length > 0) {
    toc.push({ id: ids.seeAlso, title: 'See also', depth: 2 })
    nodes.push(
      Node('h2', { key: 'see-also', id: ids.seeAlso, children: 'See also' }),
      Node('ul', {
        key: 'see-also-list',
        children: symbol.seeAlso.map((token, index) =>
          Node('li', {
            key: index,
            children: token.href ? Node('a', { href: token.href, children: token.text }) : token.text,
          }),
        ),
      }),
    )
  }
  return { nodes, toc }
}

/** The sidebar of an API page: the line's guides, then one group per entry point. */
export function apiSidebar(line: string, model: ApiModel, current?: string): NavGroup[] {
  return [
    ...sidebar(line),
    ...model.entries().map(({ entry, symbols }) => ({
      title: entry,
      items: symbols.map(symbol => ({
        title: symbol.name,
        href: symbol.href,
        current: symbol.href === current,
        badge: symbol.deprecated ? 'Deprecated' : undefined,
      })),
    })),
  ]
}

/** The switcher from an API page: each line opens the same symbol when its API has one. */
function apiVersions(line: string, entry: string, name: string): { current: VersionOption; options: VersionOption[] } {
  const { current, options } = versionChoices(line)
  return {
    current,
    options: options.map(option => {
      const other = apiModel(option.label)
      return other?.symbol(entry, name) ? { ...option, href: other.href({ entry, symbol: name }) } : option
    }),
  }
}

/** A symbol's page in the docs window, or undefined when the API has no such symbol. */
export function renderApiPage(line: string, entry: string, name: string, version?: string) {
  const model = apiModel(line, version)
  const symbol = model?.symbol(entry, name)
  if (!model || !symbol) return undefined
  const href = model.href({ entry: symbol.entry, symbol: symbol.name })
  const { nodes, toc } = apiArticle(symbol, apiLayouts(line, version))
  const crumbs: Crumb[] = [
    { title: line, href: docsHref({ kind: 'line', line }, VERSIONS) },
    ...(version ? [{ title: version }] : []),
    { title: symbol.entry },
    { title: symbol.name },
  ]
  return Window({
    crumbs,
    groups: apiSidebar(line, model, href),
    version: apiVersions(line, entrySegment(symbol.entry), symbol.name),
    repository: REPOSITORY,
    toc,
    children: Prose({ children: nodes }),
  })
}
