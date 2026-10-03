import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { playgroundFrameCsp, STATIC_FILE_CSP, UNSTORED, VERSIONED_PAGE } from '@/lib/cache-policy'
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
