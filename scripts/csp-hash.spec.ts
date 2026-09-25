import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { fillPolicy, hashesFor, MARKER, passthroughPolicy, splitPolicy } from './csp-hash.mjs'

const sha = (body: string) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`
const POLICY = `default-src 'self'; script-src ${MARKER} 'self'`

describe('hashesFor', () => {
  it('hashes each distinct inline script and skips external ones', () => {
    const html =
      '<script>a()</script><script src="/x.js"></script><script type="module">b()</script><script>a()</script>'
    expect(hashesFor(html)).toBe(`${sha('a()')} ${sha('b()')}`)
  })

  it('hashes an empty inline script', () => {
    expect(hashesFor('<script></script>')).toBe(sha(''))
  })
})

describe('fillPolicy', () => {
  it('replaces the marker with the document hashes', () => {
    expect(fillPolicy(POLICY, '<script>a()</script>')).toBe(`default-src 'self'; script-src ${sha('a()')} 'self'`)
  })

  it('removes the marker when there is nothing to hash', () => {
    expect(fillPolicy(POLICY, '<p>no scripts</p>')).toBe("default-src 'self'; script-src 'self'")
    expect(fillPolicy(POLICY)).toBe("default-src 'self'; script-src 'self'")
    expect(fillPolicy(`script-src 'self' ${MARKER}`)).toBe("script-src 'self'")
  })
})

describe('passthroughPolicy', () => {
  it('sends no policy on a bodiless response, so a 304 keeps the cached one', () => {
    expect(passthroughPolicy(POLICY, true)).toBeUndefined()
  })

  it('removes the marker from a response with a body it does not hash', () => {
    expect(passthroughPolicy(POLICY, false)).toBe("default-src 'self'; script-src 'self'")
  })

  it('leaves a policy without the marker, and no policy, as they are', () => {
    expect(passthroughPolicy("default-src 'none'", true)).toBe("default-src 'none'")
    expect(passthroughPolicy(undefined, true)).toBeUndefined()
  })
})

describe('splitPolicy', () => {
  const policy = `default-src 'self'; script-src ${MARKER} 'self' 'wasm-unsafe-eval'; frame-ancestors 'self'`
  const meta = (content: string) => `<meta http-equiv="Content-Security-Policy" content="${content}">`

  it('puts script-src with the hashes in a meta tag right after the charset, before any script', () => {
    const html =
      '<html><head><meta charSet="utf-8"/><script>a()</script></head><body><script>b()</script></body></html>'
    const split = splitPolicy(policy, html)!
    expect(split.html).toBe(
      `<html><head><meta charSet="utf-8"/>${meta(`script-src 'self' 'wasm-unsafe-eval' ${sha('a()')} ${sha('b()')}`)}<script>a()</script></head><body><script>b()</script></body></html>`,
    )
  })

  it('leaves the header every directive, with script-src allowing inline scripts the meta then narrows', () => {
    const split = splitPolicy(policy, '<head></head><script>a()</script>')!
    expect(split.header).toBe(
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; frame-ancestors 'self'",
    )
    expect(split.html.startsWith(`<head>${meta(`script-src 'self' 'wasm-unsafe-eval' ${sha('a()')}`)}</head>`)).toBe(
      true,
    )
  })

  it('keeps the header the same size however many scripts the page has', () => {
    const page = (count: number) =>
      `<head></head>${Array.from({ length: count }, (_, index) => `<script>x(${index})</script>`).join('')}`
    expect(splitPolicy(policy, page(1000))!.header).toBe(splitPolicy(policy, page(1))!.header)
  })

  it('allows no inline script on a page that has none', () => {
    expect(splitPolicy(policy, '<head></head><p>text</p>')!.html).toBe(
      `<head>${meta("script-src 'self' 'wasm-unsafe-eval'")}</head><p>text</p>`,
    )
  })

  it('declines a page without a head, or a policy without the marker, so the caller keeps it whole', () => {
    expect(splitPolicy(policy, '<script>a()</script>')).toBeUndefined()
    expect(splitPolicy("script-src 'self'", '<head></head>')).toBeUndefined()
  })
})
