import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { fillPolicy, hashesFor, MARKER } from './csp-hash.mjs'

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
