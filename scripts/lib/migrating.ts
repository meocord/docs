/**
 * A line's migration guide, written for the site in content/migrating/<line>.md: the anchors its
 * headings get, which changelog links and pages name.
 */

import { pageAnchorSet } from '../../src/lib/prose/anchors'

/** The anchors GitHub gives the guide's headings, which stay stable for the links that name them. */
export function markdownAnchors(markdown: string): string[] {
  return [...pageAnchorSet(markdown)]
}
