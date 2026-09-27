/**
 * The comments of a TypeScript file, found with TypeScript's own scanner, so a `//` inside a string, such as a
 * URL's, is not taken for one.
 */

import ts from 'typescript'

/** Each comment's text, with the offset it starts at. */
export function commentsOf(source: string): { text: string; offset: number }[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source)
  const comments: { text: string; offset: number }[] = []
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (kind === ts.SyntaxKind.SingleLineCommentTrivia || kind === ts.SyntaxKind.MultiLineCommentTrivia)
      comments.push({ text: scanner.getTokenText(), offset: scanner.getTokenStart() })
  }
  return comments
}
