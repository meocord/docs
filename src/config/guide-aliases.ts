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

/**
 * The redirects that make every aliased slug resolve in each line: to the line's page for the topic,
 * or, where the line lacks that page and another line has it, to the line's page saying so. A line
 * that already has a page at the slug keeps it. The current line is reached through `latest` as well.
 */
export function guideAliasRedirects(
  lines: { line: string; ids: readonly string[] }[],
  latest: string,
  aliases: Readonly<Record<string, string>> = GUIDE_ALIASES,
): AliasRedirect[] {
  const anywhere = new Set(lines.flatMap(({ ids }) => ids))
  return lines.flatMap(({ line, ids }) =>
    Object.entries(aliases).flatMap(([slug, id]) => {
      if (ids.includes(slug)) return []
      const destination = ids.includes(id)
        ? `/docs/${line}/${id}`
        : anywhere.has(id)
          ? `/docs/${line}/missing/${id}`
          : undefined
      if (!destination) return []
      const sources = [`/docs/${line}/${slug}`, ...(line === latest ? [`/docs/latest/${slug}`] : [])]
      return sources.map(source => ({ source, destination, permanent: false as const }))
    }),
  )
}
