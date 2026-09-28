/**
 * A line's migration guide, written for the site in content/migrating/<line>.md: the anchors its
 * headings get, which changelog links and pages name.
 */

import { pageSlugger } from '../../src/lib/page-ids'

/** The anchors GitHub gives the guide's headings, which stay stable for the links that name them. */
export function markdownAnchors(markdown: string): string[] {
  const slugger = pageSlugger()
  const anchors: string[] = []
  let fence = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) fence = !fence
    const heading = !fence && /^#{1,6} (.+?)\s*#*\s*$/.exec(line)
    if (heading) anchors.push(slugger.slug(heading[1]))
  }
  return anchors
}
