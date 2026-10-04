import type { Image, Nodes, Paragraph, Parents, PhrasingContent, RootContent, Table as MdTable } from 'mdast'
import {
  A,
  Aside,
  Blockquote,
  Br,
  Code,
  Div,
  Em,
  Hr,
  Img,
  Li,
  Node,
  type NodeInstance,
  P,
  Strong,
  Table,
  Tbody,
  Thead,
  Tr,
} from '@meonode/ui'
import { anchorIds, type AnchorOptions, parseMarkdown } from '@/lib/prose/anchors'
import { codeFrame } from '@/lib/prose/code'

/** A heading on the page, with the anchor its element carries. */
export interface Heading {
  id: string
  title: string
  depth: number
}

export interface LowerOptions extends AnchorOptions {
  /** Maps a link as written to the href to render; stored `/docs/<line>/…` links go through urls.ts. */
  href?: (url: string) => string
  /** The code an `::example{file="…" region="…" from="…"}` directive embeds. */
  example?: (file: string, region?: string, from?: string) => string
  /** The figure a `::figure{name="…"}` directive draws, such as the pipeline; nothing when it has none by that name. */
  figure?: (name: string, key: number) => NodeInstance | undefined
  /**
   * The playground a `::playground{file="…" region="…" dispatch="…"}` directive embeds. Undefined, or no
   * resolver, draws it as the ::example of its file and region.
   */
  playground?: (directive: PlaygroundDirective, key: number) => NodeInstance | undefined
}

/** A `::playground` directive's attributes, as written. */
export interface PlaygroundDirective {
  file: string
  region?: string
  dispatch: string
}

const EXAMPLE = /^::example\{([^}]*)\}$/
const FIGURE = /^::figure\{name="([\w-]+)"\}$/
const PLAYGROUND = /^::playground\{([^}]*)\}$/

export const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/

/** Whether a page may load an image from `url` under its policy, `img-src 'self' data:`: a path on the site or a data URL. */
const loadable = (url: string) => /^data:/i.test(url) || !(/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//'))

/** An image or a link that holds images alone, as a README's badges are, and blank text between them. */
const badgePart = (node: PhrasingContent): boolean =>
  node.type === 'image' ||
  node.type === 'break' ||
  (node.type === 'text' && !node.value.trim()) ||
  (node.type === 'link' && node.children.length > 0 && node.children.every(child => child.type === 'image'))

/** A paragraph of badges from another site, a README's row of version, build and licence images, which the site shows itself. */
const isBadgeRow = (children: PhrasingContent[]) =>
  children.every(badgePart) &&
  children.some(child =>
    child.type === 'image'
      ? !loadable(child.url)
      : child.type === 'link' && child.children.some(image => image.type === 'image' && !loadable(image.url)),
  )
/** GitHub's alerts, `> [!NOTE]` and its kin: the callout each draws as, and its label. */
export const ALERTS = {
  NOTE: { callout: 'note', label: 'Note' },
  TIP: { callout: 'tip', label: 'Tip' },
  IMPORTANT: { callout: 'note', label: 'Important' },
  WARNING: { callout: 'warning', label: 'Warning' },
  CAUTION: { callout: 'danger', label: 'Caution' },
} as const

export interface Lowered {
  nodes: NodeInstance[]
  headings: Heading[]
}

type Child = NodeInstance | string

const attributesOf = (written: string): Record<string, string> =>
  Object.fromEntries([...written.matchAll(/(\w+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))

/** A directive a paragraph holds alone, with its attributes as written. */
export type Directive =
  | { kind: 'example'; file?: string; region?: string; from?: string }
  | { kind: 'playground'; file?: string; region?: string; dispatch?: string }
  | { kind: 'figure'; name: string }

/** The directive a paragraph is, `::example{…}`, `::playground{…}` or `::figure{…}` alone; undefined for prose. */
export function directiveOf(node: Paragraph): Directive | undefined {
  const [only] = node.children
  if (node.children.length !== 1 || only.type !== 'text') return undefined
  const text = only.value.trim()
  const example = EXAMPLE.exec(text)
  if (example) return { kind: 'example', ...attributesOf(example[1]) }
  const playground = PLAYGROUND.exec(text)
  if (playground) return { kind: 'playground', ...attributesOf(playground[1]) }
  const figure = FIGURE.exec(text)
  return figure ? { kind: 'figure', name: figure[1] } : undefined
}

/**
 * Markdown as meonode nodes: intrinsic elements with no style props, so none of them goes through
 * meonode's styled renderer. The page's one styled container, Prose, styles them by selector.
 * Headings, and the terms of a page that defines them, carry the anchors `anchorIds` gives them, which
 * the content pipeline checks links against.
 */
export function lowerMarkdown(markdown: string, options: LowerOptions = {}): Lowered {
  const tree = parseMarkdown(markdown)
  const ids = anchorIds(tree, markdown, options)
  const headings: Heading[] = []
  const href = options.href ?? (url => url)

  const children = (parent: Parents): Child[] => parent.children.map((child, index) => lower(child, index))

  function lower(node: RootContent, key: number): Child {
    switch (node.type) {
      case 'text':
        return node.value
      case 'paragraph': {
        const directive = directiveOf(node)
        if (directive?.kind === 'example') return lowerExample(directive, key)
        if (directive?.kind === 'playground') return lowerPlayground(directive, key)
        if (directive?.kind === 'figure') return options.figure?.(directive.name, key) ?? ''
        if (isBadgeRow(node.children)) return ''
        const term = ids.get(node)
        return P(children(node), { key, ...(term && { id: term, 'data-term': true }) })
      }
      case 'heading': {
        const id = ids.get(node)!
        headings.push({ id, title: plainText(node), depth: node.depth })
        return Node(`h${node.depth}`, { key, id, children: children(node) })
      }
      case 'emphasis':
        return Em(children(node), { key })
      case 'strong':
        return Strong(children(node), { key })
      case 'delete':
        return Node('del', { key, children: children(node) })
      case 'inlineCode':
        return Code(node.value, { key })
      case 'break':
        return Br({ key })
      case 'link': {
        const { url, title } = node
        const target = href(url)
        // An image the page can't load reads as its alt text inside the link, never a link within a link
        const inner = node.children.map((child, index) =>
          child.type === 'image' && !loadable(child.url) ? (child.alt ?? '') : lower(child, index),
        )
        return A({ key, href: target, title: title ?? undefined, children: inner })
      }
      case 'image':
        return image(node, key)
      case 'code':
        return codeFrame(node.value, node.lang ?? undefined, { key })
      case 'blockquote': {
        // GitHub's alert syntax, `> [!NOTE]` and its kin, becomes a callout; any other quote stays one.
        const first = node.children[0]
        const text = first?.type === 'paragraph' && first.children[0]?.type === 'text' ? first.children[0] : undefined
        const alert = text && ALERT.exec(text.value)
        if (!text || !alert) return Blockquote({ key, children: children(node) })
        const kind = ALERTS[alert[1] as keyof typeof ALERTS]
        text.value = text.value.slice(alert[0].length)
        return Aside({
          key,
          role: 'note',
          'data-callout': kind.callout,
          children: [Strong(kind.label, { key: 'label', 'data-callout-label': true }), ...children(node)],
        })
      }
      case 'list':
        return Node(node.ordered ? 'ol' : 'ul', {
          key,
          start: node.ordered && node.start !== 1 ? (node.start ?? undefined) : undefined,
          // A tight list's items hold bare paragraphs; unwrapping them keeps its spacing tight. Looseness
          // is the list's (a blank line between any two items) or an item's own.
          children: node.children.map(item =>
            Li({
              key: offset(item),
              children:
                node.spread || item.spread
                  ? children(item)
                  : item.children.flatMap((child, at) =>
                      child.type === 'paragraph' ? children(child) : [lower(child, at)],
                    ),
            }),
          ),
        })
      case 'thematicBreak':
        return Hr({ key })
      case 'table':
        return lowerTable(node, key)
      case 'html':
        // Raw HTML is not rendered: pages are Markdown only.
        return ''
      default:
        return ''
    }
  }

  /**
   * An image the page can load, or else its alt text: a link to the image where it is on the web, plain text
   * otherwise. The page policy loads images from the site and data URLs only, so any other would show broken.
   */
  function image(node: Image, key: number): Child {
    if (loadable(node.url)) return Img({ key, src: node.url, alt: node.alt ?? '', loading: 'lazy' })
    const text = node.alt || node.url
    return /^https?:\/\//i.test(node.url) ? A({ key, href: node.url, children: text }) : text
  }

  function lowerExample(values: { file?: string; region?: string; from?: string }, key: number) {
    if (!values.file || !options.example) return ''
    return codeFrame(options.example(values.file, values.region, values.from), 'ts', { key, file: values.file })
  }

  function lowerPlayground(values: Extract<Directive, { kind: 'playground' }>, key: number) {
    const drawn =
      values.file && values.dispatch !== undefined
        ? options.playground?.({ file: values.file, region: values.region, dispatch: values.dispatch }, key)
        : undefined
    return drawn ?? lowerExample({ file: values.file, region: values.region }, key)
  }

  function lowerTable(table: MdTable, key: number) {
    const [head, ...body] = table.children
    const cells = (row: MdTable['children'][number], tag: 'th' | 'td') =>
      row.children.map((cell, index) =>
        Node(tag, {
          key: offset(cell),
          'data-align': table.align?.[index] ?? undefined,
          children: children(cell),
        }),
      )
    return Div({
      key,
      'data-table': true,
      children: Table({
        children: [
          Thead({ key: 'head', children: Tr({ children: cells(head, 'th') }) }),
          Tbody({
            key: 'body',
            children: body.map(row => {
              const at = offset(row)
              return Tr({ key: at, children: cells(row, 'td') })
            }),
          }),
        ],
      }),
    })
  }

  return { nodes: tree.children.map((child, index) => lower(child, index)).filter(isNode), headings }
}

/** A Markdown node's key: where it starts in the source, which no other node shares. */
function offset(node: Nodes): number | undefined {
  return node.position?.start.offset
}

function isNode(child: Child): child is NodeInstance {
  return typeof child !== 'string'
}

function plainText(node: Nodes | PhrasingContent): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node) return (node.children as Nodes[]).map(plainText).join('')
  return ''
}
