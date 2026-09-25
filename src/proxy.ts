import { NextResponse, type NextRequest } from 'next/server'
import { DOC_ALIASES } from '@/config/aliases'
import { NOINDEX, SITE_INDEXABLE } from '@/config/site'
import { cacheControlFor, isInertPath, prereleaseRedirect, STATIC_FILE_CSP } from '@/lib/cache-policy'

const __DEV__ = process.env.NODE_ENV !== 'production'

/**
 * The document's policy. `script-src` carries a marker that scripts/csp-hash-proxy.mjs replaces with
 * the hashes of the inline scripts actually sent: hashes, unlike a nonce, are safe to cache and share.
 * `'wasm-unsafe-eval'` is for the search index, which runs as WebAssembly.
 */
const DOCUMENT_CSP = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  `script-src '__CSP_HASHES__' 'self' 'wasm-unsafe-eval'${__DEV__ ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join('; ')

/**
 * Cache and security headers for every page and public file. Set here rather than in next.config.ts:
 * a response that passes through the proxy is dynamic to Next, and a Cache-Control from `headers()`
 * would be overwritten for every path this matches.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const redirect = prereleaseRedirect(pathname, DOC_ALIASES.next)
  const response = redirect
    ? NextResponse.redirect(new URL(redirect + request.nextUrl.search, request.url), 307)
    : NextResponse.next()

  if (!SITE_INDEXABLE) response.headers.set('X-Robots-Tag', NOINDEX)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (redirect) {
    response.headers.set('Cache-Control', 'public, max-age=300')
    return response
  }
  response.headers.set('Cache-Control', cacheControlFor(pathname))
  response.headers.set('Content-Security-Policy', isInertPath(pathname) ? STATIC_FILE_CSP : DOCUMENT_CSP)
  return response
}

export const config = {
  matcher: [
    {
      // Route handlers, the build's own output, the OG cards, robots.txt and the sitemap set their own headers.
      source: '/((?!api(?:/|$)|_next/|og(?:/|$)|robots\\.txt$|sitemap\\.xml$).*)',
    },
  ],
}
