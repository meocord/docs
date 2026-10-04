/**
 * Whether search engines may index the site. Off until launch: the build inlines it from
 * `SITE_INDEXABLE=true` (see next.config.ts), so the header, robots.txt and the sitemap never disagree.
 */
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE === 'true'

/** The header every response carries while the site is not indexable. */
export const NOINDEX = 'noindex, nofollow'

/** The public origin, for absolute URLs in metadata and the sitemap. */
export const SITE_URL = process.env.SITE_URL ?? 'https://meocord.dev'

/** What MeoCord is, in a few words: the home page's title after the brand. */
export const SITE_TAGLINE = 'Decorator-based Discord bot framework'

/** What MeoCord is, in a sentence: the home page's description, its structured data and llms.txt's summary. */
export const SITE_DESCRIPTION =
  'Decorator-based Discord bots, with the pipeline you’d build yourself: guards, interceptors, pipes and a testing module, for discord.js 14.'
