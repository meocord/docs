import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getRelativeURL } from 'next/dist/shared/lib/router/utils/relativize-url'
import nextConfig from '../next.config'
import { proxy } from '@/proxy'
import { cacheControlFor, playgroundFrameCsp, STATIC_FILE_CSP, UNSTORED, VERSIONED_PAGE } from '@/lib/cache-policy'
import { SITE_URL } from '@/config/site'
import { DOC_LINES } from '@/config/aliases'

const request = (path: string) => new NextRequest(new URL(path, 'https://docs.test'))
// A line that is not current answers at its number; the current one at latest
const CURRENT = DOC_LINES.lines.find(entry => entry.status === 'current')!.line
const OTHER = DOC_LINES.lines.find(entry => entry.status !== 'current')!.line

describe('proxy', () => {
  it('noindexes and sets the document policy on a page', () => {
    const response = proxy(request(`/docs/${OTHER}/intro`))
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(response.headers.get('Cache-Control')).toBe(VERSIONED_PAGE)
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "script-src '__CSP_HASHES__' 'self' 'wasm-unsafe-eval'",
    )
  })

  it("sends the current line's number URL to latest, as a 307 that carries the query", () => {
    const response = proxy(request(`/docs/${CURRENT}/guards?tab=bun`))
    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://docs.test/docs/latest/guards?tab=bun')
  })

  it('sends a missing page reached through latest to the current line, where it is bound', () => {
    const response = proxy(request('/docs/latest/missing/features'))
    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe(`https://docs.test/docs/${CURRENT}/missing/features`)
  })

  it("serves an exact version's page another version shares from that page, at its own URL and with its headers", async () => {
    // The routes as next.config.ts inlines them: a 4.1 page and a page of the current line, reached as latest
    const routes = {
      '4.1': { versions: ['4.1.0-beta.7', '4.1.0-beta.8'], servedBy: { 'core/MeoCordApp': [0, 0] } },
      [CURRENT]: { versions: ['9.9.8', '9.9.9'], servedBy: { 'core/MeoCordApp': [0, 0] } },
    }
    vi.resetModules()
    vi.stubEnv('EXACT_ROUTES', JSON.stringify(routes))
    try {
      const { proxy: built } = await import('@/proxy')
      for (const [path, served] of [
        ['/docs/4.1/api/4.1.0-beta.8/core/MeoCordApp?_rsc=1', '/docs/4.1/api/4.1.0-beta.7/core/MeoCordApp?_rsc=1'],
        ['/docs/latest/api/9.9.9/core/MeoCordApp', `/docs/${CURRENT}/api/9.9.8/core/MeoCordApp`],
      ]) {
        const response = built(request(path))
        expect(response.headers.get('x-middleware-rewrite'), path).toBe(`https://docs.test${served}`)
        // The URL's own headers, not the page's it is served from
        expect(response.headers.get('Cache-Control')).toBe(cacheControlFor(new URL(path, 'https://docs.test').pathname))
        expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
      }
      // The first version of a group serves its own page
      expect(
        built(request('/docs/4.1/api/4.1.0-beta.7/core/MeoCordApp')).headers.get('x-middleware-rewrite'),
      ).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
    // A dev server started without them serves each version's own page
    vi.resetModules()
    const { proxy: bare } = await import('@/proxy')
    expect(bare(request('/docs/4.1/api/4.1.0-beta.8/core/MeoCordApp')).headers.get('x-middleware-rewrite')).toBeNull()
  })

  it("rewrites to a URL on Next's own server when the request was forwarded from https to Next on 127.0.0.1", async () => {
    // Next's server builds the proxy's request from the URL it knows itself by, with the forwarded scheme, and serves a
    // rewrite itself only when the target has that URL's origin; any other is fetched as another site, and fails
    const own = 'https://127.0.0.1:3001'
    const routes = { '4.1': { versions: ['4.1.0-beta.7', '4.1.0-beta.8'], servedBy: { 'core/MeoCordApp': [0, 0] } } }
    vi.resetModules()
    vi.stubEnv('EXACT_ROUTES', JSON.stringify(routes))
    // As next build inlines it from next.config.ts
    vi.stubEnv('__NEXT_NO_MIDDLEWARE_URL_NORMALIZE', nextConfig.skipProxyUrlNormalize ? 'true' : '')
    try {
      const { proxy: built } = await import('@/proxy')
      const path = '/docs/4.1/api/4.1.0-beta.8/core/MeoCordApp'
      const rewrite = built(new NextRequest(`${own}${path}`)).headers.get('x-middleware-rewrite')!
      expect(getRelativeURL(rewrite, `${own}${path}`)).toBe('/docs/4.1/api/4.1.0-beta.7/core/MeoCordApp')
      const redirect = built(new NextRequest(`${own}/docs/${CURRENT}/guards`)).headers.get('Location')!
      expect(getRelativeURL(redirect, `${own}/docs/${CURRENT}/guards`)).toBe('/docs/latest/guards')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('gives public files the flat-deny policy', () => {
    const response = proxy(request('/icon-32.png'))
    expect(response.headers.get('Content-Security-Policy')).toBe(STATIC_FILE_CSP)
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })

  it("lets the playground's sandboxed frame read its runtime and compiler, and nothing else", () => {
    for (const path of ['/playground/4.1.0-beta.7.0123456789.js', '/playground/swc.abcdef0123.wasm']) {
      const response = proxy(request(path))
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Content-Security-Policy')).toBe(STATIC_FILE_CSP)
    }
    for (const path of [
      '/docs/4.1/defer',
      '/palette/4.1.0123456789.json',
      '/icon-32.png',
      '/playground/4.1.0-beta.7.0123456789.html',
    ])
      expect(proxy(request(path)).headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it("serves the playground's frame under its sandboxed policy, naming the configured site, whatever the request's host", () => {
    const expected = playgroundFrameCsp(new URL(SITE_URL).origin)
    expect(expected).toContain('sandbox allow-scripts')
    for (const asked of [
      request('/playground/4.1.0-beta.7.0123456789.html'),
      new NextRequest(new URL('/playground/4.1.0-beta.7.0123456789.html', 'http://127.0.0.1:3001'), {
        headers: { host: 'evil.test' },
      }),
    ]) {
      const response = proxy(asked)
      expect(response.headers.get('Content-Security-Policy')).toBe(expected)
      expect(response.headers.get('Cache-Control')).toBe(UNSTORED)
    }
  })

  it('serves one frame path under the policy of whichever origin the running server is configured for, stored by nobody', async () => {
    const frameFrom = async (siteUrl: string) => {
      vi.resetModules()
      vi.stubEnv('SITE_URL', siteUrl)
      try {
        const { proxy: configured } = await import('@/proxy')
        return configured(request('/playground/4.1.0-beta.7.0123456789.html')).headers
      } finally {
        vi.unstubAllEnvs()
      }
    }
    const [site, preview] = [await frameFrom('https://meocord.dev'), await frameFrom('http://localhost:4700')]
    expect(site.get('Content-Security-Policy')).toContain('frame-ancestors https://meocord.dev;')
    expect(preview.get('Content-Security-Policy')).toContain('frame-ancestors http://localhost:4700;')
    for (const headers of [site, preview]) expect(headers.get('Cache-Control')).toBe(UNSTORED)
  })
})
