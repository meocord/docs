import { resolveStoredHref, type VersionsManifest } from '@/lib/urls'
/** Files served from public/, whose names do not change between deploys. */
const STATIC_FILE = /\.(?:ico|png|jpe?g|gif|webp|avif|svg|webmanifest|woff2?|ttf|txt)$/

/** A line's search bundle and palette index, under paths that carry the hash of their bytes. */
const SEARCH_BUNDLE = /^\/_pagefind\/\d+\.\d+\.[0-9a-f]{10}\//
const PALETTE = /^\/palette\/\d+\.\d+\.[0-9a-f]{10}\.json$/
/** A line's playground runtime, the frame's script and the compiler, under paths that carry the hash of their bytes. */
const PLAYGROUND =
  /^\/playground\/(?:(?:\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|frame)\.[0-9a-f]{10}\.js|swc\.[0-9a-f]{10}\.wasm)$/
/** A line's playground frame, the document the page embeds, under a path that carries the hash of its bytes. */
const PLAYGROUND_FRAME = /^\/playground\/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\.[0-9a-f]{10}\.html$/

/** A year: the path changes whenever the bytes do. */
export const IMMUTABLE = 'public, max-age=31536000, immutable'
/** A day, revalidated for a week. */
export const NAMED_FILE = 'public, max-age=86400, stale-while-revalidate=604800'
/** A docs page of a line or an exact version: fixed until a deploy changes it, and purged then. */
export const VERSIONED_PAGE = 'public, s-maxage=86400, stale-while-revalidate=604800'
/** A page whose content moves when a release flips `latest`, and everything else. */
export const MOVING_PAGE = 'public, s-maxage=3600, stale-while-revalidate=86400'
/**
 * A response whose headers come from the running server's configuration, not from its bytes: the
 * playground frame, whose policy names the site's origin. No browser or CDN keeps a copy, so a server
 * configured for another origin never has its frame answered from one made under the old policy.
 */
export const UNSTORED = 'no-store'

/** The policy files a flat-deny CSP, since nothing in them runs. */
export const STATIC_FILE_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"

/** An origin as a policy can name it: a scheme, a host and a port, nothing a header could be split on. */
const ORIGIN = /^(https?):\/\/([a-z0-9.-]+|\[::1\])(?::\d{1,5})?$/i
/** The hosts a site may be served from over plain http: this machine, for local preview and the e2e server. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The playground frame's policy, for the site at `origin`. `sandbox` gives the frame an opaque origin
 * wherever it is loaded, so the reader's code reaches no page, storage or cookie of the site. Scripts and
 * requests are limited to the playground's own files, and only the site may embed the frame, each named
 * by the site's configured origin, exactly: WebKit matches no `'self'` in a sandboxed document, and a
 * policy read from the request would take its Host header for the site. The Worker the frame
 * starts from a blob inherits the policy. `'unsafe-eval'` runs the compiled code and `'wasm-unsafe-eval'`
 * the compiler. An origin that can't be named, or a plain-http one other than this machine's, gets the
 * flat-deny policy, so no configuration can open the frame to a cleartext site.
 */
export function playgroundFrameCsp(origin: string): string {
  const named = ORIGIN.exec(origin)
  if (!named || (named[1].toLowerCase() === 'http' && !LOOPBACK.has(named[2].toLowerCase()))) return STATIC_FILE_CSP
  const files = `${origin}/playground/`
  return [
    'sandbox allow-scripts',
    "default-src 'none'",
    `script-src ${files} 'unsafe-eval' 'wasm-unsafe-eval'`,
    'worker-src blob:',
    `connect-src ${files}`,
    `frame-ancestors ${origin}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

/**
 * What kind of response a path is, for its cache and security headers. A search bundle keeps the
 * document policy, since Pagefind's worker runs WebAssembly under the policy it is served with; a
 * palette index is data and gets the flat-deny policy, as files do. A playground runtime is loaded into a
 * Worker, which takes its policy from the frame that starts it, so it gets the flat-deny policy too; the
 * frame gets its own.
 */
export type PathKind =
  'search-bundle' | 'palette' | 'playground' | 'playground-frame' | 'file' | 'versioned-page' | 'page'

export function pathKind(pathname: string): PathKind {
  if (SEARCH_BUNDLE.test(pathname)) return 'search-bundle'
  if (PALETTE.test(pathname)) return 'palette'
  if (PLAYGROUND.test(pathname)) return 'playground'
  if (PLAYGROUND_FRAME.test(pathname)) return 'playground-frame'
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
    case 'playground':
      return IMMUTABLE
    case 'playground-frame':
      return UNSTORED
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
  return kind === 'file' || kind === 'palette' || kind === 'playground'
}

/**
 * Whether a path is read from the playground's sandboxed frame, whose origin is opaque: its runtime and the
 * compiler's WebAssembly, fetched across origins, so they allow any origin to read them. Nothing else does.
 */
export function isPlaygroundAsset(pathname: string): boolean {
  return pathKind(pathname) === 'playground'
}

/**
 * Where `/docs/next/…` points: the line in prerelease, or `latest` once none is, so a link to it keeps working;
 * undefined for any other path. A 307, because the line in prerelease changes with every new line.
 */
export function prereleaseRedirect(pathname: string, lines: { latest: string; next?: string }): string | undefined {
  const match = /^\/docs\/next(\/.*)?$/.exec(pathname)
  return match ? `/docs/${lines.next ?? 'latest'}${match[1] ?? ''}` : undefined
}

/**
 * Where the current line's number URL points: its `latest` URL, the one the site links to, so each page has one
 * address and one place in the sidebar. What `resolveStoredHref` keeps bound to its line, an exact version's API and
 * a missing page, keeps its URL; undefined for those and any other path. A 307, because the current line changes.
 */
export function currentLineRedirect(pathname: string, versions: VersionsManifest): string | undefined {
  if (pathKind(pathname) !== 'versioned-page') return undefined
  const canonical = resolveStoredHref(pathname, versions)
  return canonical === pathname ? undefined : canonical
}
