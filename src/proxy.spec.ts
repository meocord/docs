import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { STATIC_FILE_CSP, VERSIONED_PAGE } from '@/lib/cache-policy'

const request = (path: string) => new NextRequest(new URL(path, 'https://docs.test'))

describe('proxy', () => {
  it('noindexes and sets the document policy on a page', () => {
    const response = proxy(request('/docs/4.0/intro'))
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(response.headers.get('Cache-Control')).toBe(VERSIONED_PAGE)
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "script-src '__CSP_HASHES__' 'self' 'wasm-unsafe-eval'",
    )
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
    for (const path of ['/docs/4.1/defer', '/palette/4.1.0123456789.json', '/icon-32.png'])
      expect(proxy(request(path)).headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('answers next with a 307 that carries the site headers and the query', () => {
    const response = proxy(request('/docs/next/guides/defer?tab=bun'))
    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://docs.test/docs/4.1/guides/defer?tab=bun')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
  })
})
