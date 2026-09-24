/** Files served from public/, whose names do not change between deploys. */
const STATIC_FILE = /\.(?:ico|png|jpe?g|gif|webp|avif|svg|webmanifest|woff2?|ttf|txt)$/

/** A day, revalidated for a week. */
export const NAMED_FILE = 'public, max-age=86400, stale-while-revalidate=604800'
/** A docs page of a line or an exact version: fixed until a deploy changes it, and purged then. */
export const VERSIONED_PAGE = 'public, s-maxage=86400, stale-while-revalidate=604800'
/** A page whose content moves when a release flips `latest`, and everything else. */
export const MOVING_PAGE = 'public, s-maxage=3600, stale-while-revalidate=86400'

/** The policy files a flat-deny CSP, since nothing in them runs. */
export const STATIC_FILE_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"

/** What kind of response a path is, for its cache and security headers. */
export type PathKind = 'file' | 'versioned-page' | 'page'

export function pathKind(pathname: string): PathKind {
  if (STATIC_FILE.test(pathname)) return 'file'
  const [, section, version] = pathname.split('/')
  if (section === 'docs' && version && version !== 'latest' && version !== 'next') return 'versioned-page'
  return 'page'
}

/** The Cache-Control for a path the proxy answers. */
export function cacheControlFor(pathname: string): string {
  const kind = pathKind(pathname)
  return kind === 'file' ? NAMED_FILE : kind === 'versioned-page' ? VERSIONED_PAGE : MOVING_PAGE
}

/**
 * Where `/docs/next/…` points, or undefined for any other path. A 307, because the line in
 * prerelease changes with every new line.
 */
export function prereleaseRedirect(pathname: string, nextLine: string): string | undefined {
  const match = /^\/docs\/next(\/.*)?$/.exec(pathname)
  return match ? `/docs/${nextLine}${match[1] ?? ''}` : undefined
}
