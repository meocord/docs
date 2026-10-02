import manifest from '../../versions.json'
import { aliases } from '../../scripts/lib/line-aliases'

/** Where `latest` and `next` point: the current line, and the line in prerelease while there is one. */
export interface DocAliases {
  latest: string
  next?: string
}

/**
 * The version aliases a reader can put in a docs URL, read from a versions config. `latest` is rewritten to its line
 * in next.config.ts, and serves that content under its own, canonical URL. `next` is a 307 to the line in
 * prerelease, answered by the proxy so it carries the site's headers, or to `latest` once no line is in prerelease.
 *
 * @throws Error when no line is current, since every docs URL under `latest` needs one.
 */
export function docAliases(config: { lines: readonly { line: string; status: string }[] }): DocAliases {
  const { latest, next } = aliases(config)
  if (!latest) throw new Error('versions.json has no current line, which /docs/latest needs.')
  return next ? { latest, next } : { latest }
}

/** The aliases versions.json gives, so a release that changes a line's standing moves them with it. */
export const DOC_ALIASES = docAliases(manifest)
