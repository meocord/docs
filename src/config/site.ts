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

/** What MeoCord is, as the home page's heading reads under the brand: the phrase people search for, and its language. */
export const SITE_HEADLINE = 'Decorator-based Discord bot framework for TypeScript'

/**
 * What MeoCord is, in a sentence: the home page's description, its structured data and llms.txt's summary. Under
 * 160 characters, so a search result shows it whole, and naming no version of anything, so it stays true.
 */
export const SITE_DESCRIPTION =
  'MeoCord is a TypeScript framework for Discord bots, built on discord.js. Structure a bot with decorators and services, and test it the way it runs.'
