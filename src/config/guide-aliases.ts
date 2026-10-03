import { counterpartIn, type TopicPage } from '../../scripts/lib/guide'

/**
 * Redirects that give every Guide path a page in a line whose guides come from its README, which
 * meocord's JSDoc links through `latest` while that line is current.
 */

export interface AliasRedirect {
  source: string
  destination: string
  permanent: false
}

/** A README line's page as the redirects see it: its slug in the URL, its id, and the ids it had before. */
export interface AliasPage {
  slug: string
  id: string
  formerly: readonly string[]
}

/** A Guide page as the redirects see it: its path below the line, and what it is known by across lines. */
export interface GuideAlias extends TopicPage {
  path: string
}

/**
 * The redirects that make each Guide path resolve in each README line. A line sends the path to its
 * own page on the topic, as `counterpartIn` finds it, the version switcher's way, or to its page saying the
 * topic is documented elsewhere, which is keyed by the Guide page's id. A line that has a page at the
 * path keeps it. The current line is reached through `latest` as well.
 */
export function guideAliasRedirects(
  lines: { line: string; pages: readonly AliasPage[] }[],
  latest: string,
  guide: readonly GuideAlias[],
  guideLine: string,
): AliasRedirect[] {
  return lines.flatMap(({ line, pages }) =>
    guide.flatMap(topic => {
      const { path, id } = topic
      if (pages.some(page => page.slug === path)) return []
      const own = counterpartIn(pages, line, topic, guideLine)
      // The current line's page at the URL the site uses for it; a missing page is bound to its line
      const destination = own
        ? `/docs/${line === latest ? 'latest' : line}/${own.page.slug}${own.anchor ? `#${own.anchor}` : ''}`
        : `/docs/${line}/missing/${id}`
      const sources = [`/docs/${line}/${path}`, ...(line === latest ? [`/docs/latest/${path}`] : [])]
      return sources.map(source => ({ source, destination, permanent: false as const }))
    }),
  )
}
