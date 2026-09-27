/**
 * A Markdown file parsed as the site parses it, with mdast and GFM, so the checks that read content see the same
 * paragraphs, code and links the site renders. YAML front matter is blanked first, keeping every line's number.
 */

import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'

/** The file with its front matter's characters blanked, line breaks kept, and how many lines the front matter is. */
function blankFrontMatter(markdown: string): { body: string; lines: number } {
  const match = /^---\n[\s\S]*?\n---(?:\n|$)/.exec(markdown)
  if (!match) return { body: markdown, lines: 0 }
  const blanked = match[0].replace(/[^\n]/g, ' ')
  return { body: blanked + markdown.slice(match[0].length), lines: match[0].split('\n').length - 1 }
}

/** A file's tree, and its text with the front matter blanked, which the tree's offsets index. */
export function markdownTree(markdown: string): { tree: Root; body: string; frontMatterLines: number } {
  const { body, lines } = blankFrontMatter(markdown)
  return {
    tree: fromMarkdown(body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }),
    body,
    frontMatterLines: lines,
  }
}

/** Every node of a tree, depth first. */
export function* nodesOf(node: Nodes): Generator<Nodes> {
  yield node
  if ('children' in node) for (const child of node.children) yield* nodesOf(child)
}
