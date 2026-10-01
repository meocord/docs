import GithubSlugger from 'github-slugger'
import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { pageSlugger } from '@/lib/page-ids'

/** How a page's anchors are given. */
export interface AnchorOptions {
  /**
   * Whether the page defines terms, as the glossary does: each of its top-level paragraphs that opens with a
   * bold term and a full stop, `**Cooldown store.** What it means`, is an anchor named after the term.
   */
  terms?: boolean
}

// The term a paragraph defines: the bold text that opens it, up to its full stop
const TERM = /^\*\*([^*\n]+?)\.\*\*(?=\s|$)/

/** Markdown parsed as the site renders it, with GitHub's tables, strikethrough and task lists. */
export function parseMarkdown(markdown: string): Root {
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

/** An anchor a page gives: a heading's or a term's, the text it was slugged from, and its id. */
interface Anchor {
  node: Nodes
  kind: 'heading' | 'term'
  text: string
  id: string
}

/** Every anchor a page gives, in the order the page writes them; see `anchorIds`. */
function anchorsOf(tree: Root, markdown: string, { terms = false }: AnchorOptions): Anchor[] {
  const slugger = pageSlugger()
  const anchors: Anchor[] = []
  const written = (node: Nodes) =>
    node.position ? markdown.slice(node.position.start.offset, node.position.end.offset) : ''
  const add = (node: Nodes, kind: Anchor['kind'], text: string) =>
    anchors.push({ node, kind, text, id: slugger.slug(text) })
  const visit = (node: Nodes, topLevel: boolean) => {
    if (node.type === 'heading') return add(node, 'heading', headingText(written(node)))
    const term = terms && topLevel && node.type === 'paragraph' ? TERM.exec(written(node))?.[1] : undefined
    if (term) add(node, 'term', term)
    else if ('children' in node) for (const child of node.children) visit(child, false)
  }
  for (const child of tree.children) visit(child, true)
  return anchors
}

/**
 * The anchor of each heading in a page, and of each term on a page that defines them, slugged in the order the
 * page writes them, as GitHub does, from the text as written. The site's element ids, content:check and search
 * all take their anchors from here, so a link that one of them accepts lands where the others say.
 */
export function anchorIds(tree: Root, markdown: string, options: AnchorOptions = {}): Map<Nodes, string> {
  return new Map(anchorsOf(tree, markdown, options).map(anchor => [anchor.node, anchor.id]))
}

/**
 * The terms a page defines whose anchor isn't the term's own slug, because an earlier term or heading, or the
 * window, took it: such a term's anchor would move whenever the page is reordered.
 */
export function displacedTerms(markdown: string): { term: string; own: string; id: string }[] {
  return anchorsOf(parseMarkdown(markdown), markdown, { terms: true })
    .filter(anchor => anchor.kind === 'term')
    .map(({ text, id }) => ({ term: text, own: new GithubSlugger().slug(text), id }))
    .filter(({ own, id }) => own !== id)
}

/** A heading's text as written, without its `#` marks or the line under a setext heading. */
export const headingText = (written: string) =>
  written
    .replace(/\n[=-]+\s*$/, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/\s+#*\s*$/, '')

/** The anchors a page's links may name: every heading's, and every term's on a page that defines terms. */
export function pageAnchorSet(markdown: string, options: AnchorOptions = {}): Set<string> {
  return new Set(anchorIds(parseMarkdown(markdown), markdown, options).values())
}
