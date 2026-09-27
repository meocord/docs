/**
 * The links a Markdown text holds, found as the site renders it: with mdast and GFM, so an inline link,
 * a reference's definition, an image, an `<autolink>` and a bare URL GFM links are all found, and code is not.
 */

import type { Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'

export interface MarkdownLink {
  url: string
  /** Where the link is written in the text, from its first character to past its last. */
  start: number
  end: number
  /** `written` for `[text](url)`, a definition or an image, where the URL is written apart from the text; `address` for an `<autolink>` or a bare URL, where the text is the URL. */
  form: 'written' | 'address'
}

/** Every link in a text, in the order it is written. */
export function markdownLinkNodes(markdown: string): MarkdownLink[] {
  const tree = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const links: MarkdownLink[] = []
  const visit = (node: Nodes) => {
    if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && node.position) {
      const start = node.position.start.offset!
      const end = node.position.end.offset!
      const first = markdown[start]
      const form = node.type === 'link' && first !== '[' ? 'address' : 'written'
      links.push({ url: node.url, start, end, form })
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(tree)
  return links.sort((a, b) => a.start - b.start)
}
