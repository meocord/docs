/**
 * The comments of a TypeScript file, found from a full parse, so a `//` inside a string, a template or a regex is
 * not taken for one, and none is lost after them.
 */

import ts from 'typescript'

/** Each comment's text, with the offset it starts at, in order. */
export function commentsOf(source: string, fileName = 'file.ts'): { text: string; offset: number }[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const found = new Map<number, { text: string; offset: number }>()
  const collect = (ranges: readonly ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? [])
      found.set(range.pos, { text: source.slice(range.pos, range.end), offset: range.pos })
  }
  const visit = (node: ts.Node) => {
    collect(ts.getLeadingCommentRanges(source, node.getFullStart()))
    collect(ts.getTrailingCommentRanges(source, node.getEnd()))
    for (const child of node.getChildren(file)) visit(child)
  }
  visit(file)
  return [...found.values()].sort((a, b) => a.offset - b.offset)
}
