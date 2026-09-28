import { pageKnownAs, type TopicPage } from './guide'

/** The docs URLs a deployed build answers, as scripts/live-routes.ts records them. */
export interface LiveRoutes {
  /** The deployed commit they were read from. */
  commit: string
  /** Every page it prerendered, and the same pages under `latest` and `next`. */
  paths: string[]
  /** Each page of a line whose guides were authored, by its slug and id. */
  pages: { line: string; slug: string; id: string }[]
  /** Its redirects, with where each sent a reader: from next.config, and under `next` for the prerelease line. */
  redirects: { source: string; destination: string }[]
}

/**
 * The deployed pages of a line with a Guide that no Guide page takes over. A page is taken over when a
 * Guide page of its line is known by its id, as its own, a retired id it covers or an old slug, so the
 * version switcher finds it; and serves or redirects its slug, as the page's path or an entry of its
 * `formerly`, so its URL still answers. An old slug that is a path the Guide takes is never redirected, so
 * it takes nothing over.
 */
export function unmappedPages(
  routes: LiveRoutes,
  guides: Record<string, readonly (TopicPage & { path: string })[]>,
  taken: ReadonlySet<string> = new Set(),
): string[] {
  return routes.pages.flatMap(({ line, slug, id }) => {
    const guide = guides[line]
    if (!guide) return []
    const slugs = new Set(guide.flatMap(page => [page.path, ...page.formerly.filter(old => !taken.has(old))]))
    const missing = [!pageKnownAs(guide, line, id) && `id "${id}"`, !slugs.has(slug) && `slug "${slug}"`].filter(
      Boolean,
    )
    return missing.length > 0
      ? [`content/${line}: the deployed page /docs/${line}/${slug} has no Guide page for its ${missing.join(' or ')}`]
      : []
  })
}
