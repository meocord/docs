import GithubSlugger from 'github-slugger'
import type { Nodes, Parents, PhrasingContent, RootContent, Table } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { Node, type NodeInstance } from '@meonode/ui'
import { codeFrame } from '@/lib/prose/code'

/** A heading on the page, with the anchor its element carries. */
export interface Heading {
  id: string
  title: string
  depth: number
}

export interface LowerOptions {
  /** Maps a link as written to the href to render; stored `/docs/<line>/…` links go through urls.ts. */
  href?: (url: string) => string
  /** The code an `::example{file="…" region="…" from="…"}` directive embeds. */
  example?: (file: string, region?: string, from?: string) => string
}

const EXAMPLE = /^::example\{([^}]*)\}$/

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/
const ALERTS = {
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

/**
 * Markdown as meonode nodes: intrinsic elements with no style props, so none of them goes through
 * meonode's styled renderer. The page's one styled container, Prose, styles them by selector.
 * Headings carry the anchors GitHub gives them, which the content pipeline checks links against.
 */
export function lowerMarkdown(markdown: string, options: LowerOptions = {}): Lowered {
  const tree = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const slugger = new GithubSlugger()
  const headings: Heading[] = []
  const href = options.href ?? (url => url)

  const source = (node: Nodes) =>
    node.position ? markdown.slice(node.position.start.offset, node.position.end.offset) : ''

  const children = (parent: Parents): Child[] => parent.children.map((child, index) => lower(child, index))

  function lower(node: RootContent, key: number): Child {
    switch (node.type) {
      case 'text':
        return node.value
      case 'paragraph': {
        const directive =
          node.children.length === 1 && node.children[0].type === 'text'
            ? EXAMPLE.exec(node.children[0].value.trim())
            : null
        if (directive) return lowerExample(directive[1], key)
        return Node('p', { key, children: children(node) })
      }
      case 'heading': {
        // Slugged from the heading as written, as GitHub and the pipeline do.
        const written = source(node)
          .replace(/^#{1,6}\s+/, '')
          .replace(/\s+#*\s*$/, '')
        const id = slugger.slug(written)
        headings.push({ id, title: plainText(node), depth: node.depth })
        return Node(`h${node.depth}`, { key, id, children: children(node) })
      }
      case 'emphasis':
        return Node('em', { key, children: children(node) })
      case 'strong':
        return Node('strong', { key, children: children(node) })
      case 'delete':
        return Node('del', { key, children: children(node) })
      case 'inlineCode':
        return Node('code', { key, children: node.value })
      case 'break':
        return Node('br', { key })
      case 'link':
        return Node('a', { key, href: href(node.url), title: node.title ?? undefined, children: children(node) })
      case 'image':
        return Node('img', { key, src: node.url, alt: node.alt ?? '', loading: 'lazy' })
      case 'code':
        return codeFrame(node.value, node.lang ?? undefined, { key })
      case 'blockquote': {
        // GitHub's alert syntax, `> [!NOTE]` and its kin, becomes a callout; any other quote stays one.
        const first = node.children[0]
        const text = first?.type === 'paragraph' && first.children[0]?.type === 'text' ? first.children[0] : undefined
        const alert = text && ALERT.exec(text.value)
        if (!text || !alert) return Node('blockquote', { key, children: children(node) })
        const kind = ALERTS[alert[1] as keyof typeof ALERTS]
        text.value = text.value.slice(alert[0].length)
        return Node('aside', {
          key,
          role: 'note',
          'data-callout': kind.callout,
          children: [
            Node('strong', { key: 'label', 'data-callout-label': true, children: kind.label }),
            ...children(node),
          ],
        })
      }
      case 'list':
        return Node(node.ordered ? 'ol' : 'ul', {
          key,
          start: node.ordered && node.start !== 1 ? (node.start ?? undefined) : undefined,
          // A tight list's items hold bare paragraphs; unwrapping them keeps its spacing tight. Looseness
          // is the list's (a blank line between any two items) or an item's own.
          children: node.children.map((item, index) =>
            Node('li', {
              key: index,
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
        return Node('hr', { key })
      case 'table':
        return lowerTable(node, key)
      case 'html':
        // Raw HTML is not rendered: pages are Markdown only.
        return ''
      default:
        return ''
    }
  }

  function lowerExample(attributes: string, key: number) {
    const values = Object.fromEntries(
      [...attributes.matchAll(/(\w+)="([^"]*)"/g)].map(([, name, value]) => [name, value]),
    )
    if (!values.file || !options.example) return ''
    return codeFrame(options.example(values.file, values.region, values.from), 'ts', { key, file: values.file })
  }

  function lowerTable(table: Table, key: number) {
    const [head, ...body] = table.children
    const cells = (row: Table['children'][number], tag: 'th' | 'td') =>
      row.children.map((cell, index) =>
        Node(tag, {
          key: index,
          'data-align': table.align?.[index] ?? undefined,
          children: children(cell),
        }),
      )
    return Node('div', {
      key,
      'data-table': true,
      children: Node('table', {
        children: [
          Node('thead', { key: 'head', children: Node('tr', { children: cells(head, 'th') }) }),
          Node('tbody', {
            key: 'body',
            children: body.map((row, index) => Node('tr', { key: index, children: cells(row, 'td') })),
          }),
        ],
      }),
    })
  }

  return { nodes: tree.children.map((child, index) => lower(child, index)).filter(isNode), headings }
}

function isNode(child: Child): child is NodeInstance {
  return typeof child !== 'string'
}

function plainText(node: Nodes | PhrasingContent): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node) return (node.children as Nodes[]).map(plainText).join('')
  return ''
}
