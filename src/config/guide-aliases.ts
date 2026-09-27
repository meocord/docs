/**
 * Guide slugs that meocord's JSDoc already links, mapped to the page that holds the topic today. The
 * overhauled Guide gives these slugs pages of their own; each row goes when its page does, and the
 * overhaul's review expects this table empty.
 */
export const GUIDE_ALIASES: Readonly<Record<string, string>> = {
  'first-command': 'quick-start',
  'slash-commands': 'command-types',
  components: 'component-routing',
  'context-menus': 'command-types',
  'message-params': 'message-commands',
  reactions: 'messages-and-reactions',
  'how-a-call-runs': 'how-a-handler-runs',
  'invoke-and-dispatch': 'invoke',
  'testing-recipes': 'testing',
  'recipes/pagination': 'recipe-pagination',
  'recipes/database': 'recipe-database',
  'recipes/moderation': 'recipe-moderation',
  'recipes/tickets': 'recipe-tickets',
  'recipes/scheduled': 'recipe-scheduled',
  'recipes/i18n-bot': 'recipe-i18n-bot',
  'recipes/select-menus': 'recipe-select-menus',
  'recipes/cooldown-stores': 'recipe-cooldown-stores',
  'coming-from/discordjs': 'coming-from-discordjs',
  'coming-from/sapphire': 'coming-from-sapphire',
  'coming-from/discordx': 'coming-from-discordx',
  'coming-from/necord': 'coming-from-necord',
}

export interface AliasRedirect {
  source: string
  destination: string
  permanent: false
}

/** A line's page as the redirects see it: its slug in the URL, its id, and the ids it had before. */
export interface AliasPage {
  slug: string
  id: string
  formerly: readonly string[]
}

/**
 * The redirects that make every aliased slug resolve in each line. An alias names a page of `from` by
 * its slug; each line sends the slug to its own page with that page's id (or one it was formerly known
 * by), or, where it has none and another line does, to its page saying so, which is keyed by id. A line
 * that already has a page at the slug keeps it. The current line is reached through `latest` as well.
 */
export function guideAliasRedirects(
  lines: { line: string; pages: readonly AliasPage[]; guide?: boolean }[],
  latest: string,
  from: string,
  aliases: Readonly<Record<string, string>> = GUIDE_ALIASES,
): AliasRedirect[] {
  const source = lines.find(entry => entry.line === from)?.pages ?? []
  const anywhere = new Set(lines.flatMap(({ pages }) => pages.map(page => page.id)))
  // A line whose Guide is rendered serves the Guide's own pages at these slugs, or will: no aliases.
  return lines
    .filter(entry => !entry.guide)
    .flatMap(({ line, pages }) =>
      Object.entries(aliases).flatMap(([slug, target]) => {
        if (pages.some(page => page.slug === slug)) return []
        const id = source.find(page => page.slug === target)?.id
        if (id === undefined) return []
        const own = pages.find(page => page.id === id || page.formerly.includes(id))
        const destination = own
          ? `/docs/${line}/${own.slug}`
          : anywhere.has(id)
            ? `/docs/${line}/missing/${id}`
            : undefined
        if (!destination) return []
        const sources = [`/docs/${line}/${slug}`, ...(line === latest ? [`/docs/latest/${slug}`] : [])]
        return sources.map(from => ({ source: from, destination, permanent: false as const }))
      }),
    )
}
