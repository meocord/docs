import GithubSlugger from 'github-slugger'

/**
 * The ids the docs window gives its own elements: its main region, which the skip link targets, and
 * the palette's list of results. An anchor on a page never takes one of them.
 */
export const SHELL_IDS = { main: 'content', searchResults: 'search-results' } as const

/** Every id the window takes for itself. */
export const shellIds = (): string[] => Object.values(SHELL_IDS)

/**
 * A slugger for a page's heading anchors, with the window's own ids already taken: a heading named like
 * one gets the next free anchor, `content-1`. The site, content:check and search all slug headings with it.
 */
export function pageSlugger(): GithubSlugger {
  const slugger = new GithubSlugger()
  for (const id of shellIds()) slugger.slug(id)
  return slugger
}
