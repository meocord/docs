/**
 * The version aliases a reader can put in a docs URL. `latest` is rewritten to its line in
 * next.config.ts, and serves that content under its own, canonical URL. `next` is a 307 to the line
 * in prerelease, answered by the proxy so it carries the site's headers.
 *
 * A placeholder until versions.json exists: the lines here are the ones in force during the 4.1 beta.
 */
export const DOC_ALIASES = {
  latest: '4.0',
  next: '4.1',
} as const
