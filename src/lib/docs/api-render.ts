import { Node, type NodeInstance } from '@meonode/ui'
import { Prose } from '@/components/prose/Prose'
import { Window } from '@/components/shell/Window'
import type { Crumb, NavGroup, TocEntry, VersionOption } from '@/components/shell/types'
import { VERSIONS } from '@/config/versions'
import type { ApiMember, ApiModel, ApiParam, ApiSignature, ApiSymbol, Token } from '@/lib/docs/api-model'
import { apiModel } from '@/lib/docs/api-site'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
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

const code = (tokens: Token[]): Child[] =>
  tokens.map((token, index) =>
    token.href ? Node('a', { key: index, href: token.href, children: token.text }) : token.text,
  )

/** One or more declarations as a code block, one line each, their type names linked. */
const signatureBlock = (lines: Token[][], key: string) =>
  Node('pre', {
    key,
    'data-signature': true,
    children: Node('code', {
      children: lines.flatMap((line, index) => [...(index > 0 ? ['\n'] : []), ...code(line)]),
    }),
  })

const badge = (text: string, tone: 'since' | 'deprecated', key: string) =>
  Node('span', { key, 'data-badge': tone, children: text })

function paramsTable(params: ApiParam[], key: string, ownerSince?: string) {
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
                  children: param.type.length ? Node('code', { children: code(param.type) }) : '',
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
    out.push(heading('Parameters', ids?.parameters), paramsTable(signature.params, `${key}-params`, ownerSince))
  }
  if (signature.returns) {
    out.push(
      heading('Returns', ids?.returns),
      signatureBlock([signature.returns.type], `${key}-returns`),
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

function memberSection(member: ApiMember, toc: TocEntry[], symbolSince?: string): Child[] {
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
    signatureBlock(member.code, `m-${member.anchor}-code`),
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
      signatureDetails(signature, 'h4', undefined, `m-${member.anchor}-s${index}`, toc, member.since),
    ),
    ...member.examples.flatMap((text, index) => markdown(text, `m-${member.anchor}-ex-${index}`)),
  ]
}

/** The page's content: the symbol's declaration, documentation and members. */
export function apiArticle(symbol: ApiSymbol): { nodes: Child[]; toc: TocEntry[] } {
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
    signatureBlock(symbol.code, 'code'),
    ...markdown(symbol.description, 'description'),
  ]

  const [first, ...overloads] = symbol.signatures
  if (first) {
    nodes.push(
      ...signatureDetails(
        { ...first, examples: [...first.examples, ...symbol.examples] },
        'h2',
        ids,
        's0',
        toc,
        symbol.since,
      ),
    )
  }
  overloads.forEach((signature, index) =>
    nodes.push(...signatureDetails(signature, 'h4', undefined, `s${index + 1}`, toc, symbol.since)),
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
    for (const member of symbol.members) nodes.push(...memberSection(member, toc, symbol.since))
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
  const { nodes, toc } = apiArticle(symbol)
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
