/** Files served from public/, whose names do not change between deploys. */
const STATIC_FILE = /\.(?:ico|png|jpe?g|gif|webp|avif|svg|webmanifest|woff2?|ttf|txt)$/

/** A line's search bundle and palette index, under paths that carry the hash of their bytes. */
const SEARCH_BUNDLE = /^\/_pagefind\/\d+\.\d+\.[0-9a-f]{10}\//
const PALETTE = /^\/palette\/\d+\.\d+\.[0-9a-f]{10}\.json$/

/** A year: the path changes whenever the bytes do. */
export const IMMUTABLE = 'public, max-age=31536000, immutable'
/** A day, revalidated for a week. */
export const NAMED_FILE = 'public, max-age=86400, stale-while-revalidate=604800'
/** A docs page of a line or an exact version: fixed until a deploy changes it, and purged then. */
export const VERSIONED_PAGE = 'public, s-maxage=86400, stale-while-revalidate=604800'
/** A page whose content moves when a release flips `latest`, and everything else. */
export const MOVING_PAGE = 'public, s-maxage=3600, stale-while-revalidate=86400'

/** The policy files a flat-deny CSP, since nothing in them runs. */
export const STATIC_FILE_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"

/**
 * What kind of response a path is, for its cache and security headers. A search bundle keeps the
 * document policy, since Pagefind's worker runs WebAssembly under the policy it is served with; a
 * palette index is data and gets the flat-deny policy, as files do.
 */
export type PathKind = 'search-bundle' | 'palette' | 'file' | 'versioned-page' | 'page'

export function pathKind(pathname: string): PathKind {
  if (SEARCH_BUNDLE.test(pathname)) return 'search-bundle'
  if (PALETTE.test(pathname)) return 'palette'
  if (STATIC_FILE.test(pathname)) return 'file'
  const [, section, version] = pathname.split('/')
  if (section === 'docs' && version && version !== 'latest' && version !== 'next') return 'versioned-page'
  return 'page'
}

/** The Cache-Control for a path the proxy answers. */
export function cacheControlFor(pathname: string): string {
  switch (pathKind(pathname)) {
    case 'search-bundle':
    case 'palette':
      return IMMUTABLE
    case 'file':
      return NAMED_FILE
    case 'versioned-page':
      return VERSIONED_PAGE
    case 'page':
      return MOVING_PAGE
  }
}

/** Whether a path gets the flat-deny policy: files and data that nothing runs from. */
export function isInertPath(pathname: string): boolean {
  const kind = pathKind(pathname)
  return kind === 'file' || kind === 'palette'
}

/**
 * Where `/docs/next/…` points, or undefined for any other path. A 307, because the line in
 * prerelease changes with every new line.
 */
export function prereleaseRedirect(pathname: string, nextLine: string): string | undefined {
  const match = /^\/docs\/next(\/.*)?$/.exec(pathname)
  return match ? `/docs/${nextLine}${match[1] ?? ''}` : undefined
}
