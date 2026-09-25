/**
 * Whether search engines may index the site. Off until launch: the build inlines it from
 * `SITE_INDEXABLE=true` (see next.config.ts), so the header, robots.txt and the sitemap never disagree.
 */
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE === 'true'

/** The header every response carries while the site is not indexable. */
export const NOINDEX = 'noindex, nofollow'

/** The public origin, for absolute URLs in metadata and the sitemap. */
export const SITE_URL = process.env.SITE_URL ?? 'https://meocord.dev'
