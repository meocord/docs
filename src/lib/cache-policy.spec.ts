import { describe, expect, it } from 'vitest'
import {
  cacheControlFor,
  currentLineRedirect,
  IMMUTABLE,
  isInertPath,
  MOVING_PAGE,
  NAMED_FILE,
  pathKind,
  playgroundFrameCsp,
  prereleaseRedirect,
  STATIC_FILE_CSP,
  UNSTORED,
  VERSIONED_PAGE,
} from '@/lib/cache-policy'
import type { VersionsManifest } from '@/lib/urls'

describe('pathKind', () => {
  it('treats public files by extension', () => {
    expect(pathKind('/icon-32.png')).toBe('file')
    expect(pathKind('/manifest.webmanifest')).toBe('file')
  })

  it('treats line and exact-version docs pages as versioned', () => {
    expect(pathKind('/docs/4.0/guides/defer')).toBe('versioned-page')
    expect(pathKind('/docs/4.1.0-beta.2/api/core')).toBe('versioned-page')
  })

  it('treats aliases and everything else as moving', () => {
    expect(pathKind('/docs/latest/guides/defer')).toBe('page')
    expect(pathKind('/docs/next')).toBe('page')
    expect(pathKind('/docs')).toBe('page')
    expect(pathKind('/')).toBe('page')
  })
})

describe('cacheControlFor', () => {
  it('maps each kind to its policy', () => {
    expect(cacheControlFor('/apple-icon.png')).toBe(NAMED_FILE)
    expect(cacheControlFor('/docs/4.0/intro')).toBe(VERSIONED_PAGE)
    expect(cacheControlFor('/docs/latest/intro')).toBe(MOVING_PAGE)
  })
})

describe('prereleaseRedirect', () => {
  const beta = { latest: '4.0', next: '4.1' }

  it('points next and its pages at the prerelease line', () => {
    expect(prereleaseRedirect('/docs/next', beta)).toBe('/docs/4.1')
    expect(prereleaseRedirect('/docs/next/guides/defer', beta)).toBe('/docs/4.1/guides/defer')
  })

  it('points next at latest once nothing is in prerelease, so its links keep working at the URL the site uses', () => {
    expect(prereleaseRedirect('/docs/next/guides/defer', { latest: '4.1' })).toBe('/docs/latest/guides/defer')
    expect(prereleaseRedirect('/docs/next', { latest: '4.1' })).toBe('/docs/latest')
  })

  it('leaves other paths alone', () => {
    expect(prereleaseRedirect('/docs/nextjs', beta)).toBeUndefined()
    expect(prereleaseRedirect('/docs/latest', beta)).toBeUndefined()
  })
})

describe('currentLineRedirect', () => {
  const beta: VersionsManifest = {
    lines: [
      { line: '4.1', status: 'prerelease' },
      { line: '4.0', status: 'current' },
    ],
  }
  const stable: VersionsManifest = {
    lines: [
      { line: '4.1', status: 'current' },
      { line: '4.0', status: 'maintained' },
    ],
  }

  it("sends the current line's number URL to its latest URL, the one the site links to", () => {
    expect(currentLineRedirect('/docs/4.1/guards', stable)).toBe('/docs/latest/guards')
    expect(currentLineRedirect('/docs/4.1', stable)).toBe('/docs/latest')
    expect(currentLineRedirect('/docs/4.1/api/decorators/Defer', stable)).toBe('/docs/latest/api/decorators/Defer')
    expect(currentLineRedirect('/docs/4.0/changelog/4.0.1', beta)).toBe('/docs/latest/changelog/4.0.1')
  })

  it("keeps what is bound to its line by design: an exact version's API and a missing page", () => {
    expect(currentLineRedirect('/docs/4.1/api/4.1.0/decorators/Defer', stable)).toBeUndefined()
    expect(currentLineRedirect('/docs/4.1/missing/features', stable)).toBeUndefined()
  })

  it('leaves the other lines, latest itself, and paths outside the docs', () => {
    expect(currentLineRedirect('/docs/4.0/guards', stable)).toBeUndefined()
    expect(currentLineRedirect('/docs/4.1/guards', beta)).toBeUndefined()
    expect(currentLineRedirect('/docs/latest/guards', stable)).toBeUndefined()
    expect(currentLineRedirect('/palette/4.1.0123456789.json', stable)).toBeUndefined()
  })
})

describe('search assets', () => {
  it('caches a hashed search bundle and palette index as immutable', () => {
    expect(pathKind('/_pagefind/4.1.0123456789/pagefind.js')).toBe('search-bundle')
    expect(pathKind('/_pagefind/4.1.0123456789/fragment/en_abc.pf_fragment')).toBe('search-bundle')
    expect(pathKind('/palette/4.1.0123456789.json')).toBe('palette')
    expect(cacheControlFor('/_pagefind/4.1.0123456789/wasm.en.pagefind')).toBe(IMMUTABLE)
    expect(cacheControlFor('/palette/4.0.abcdef0123.json')).toBe(IMMUTABLE)
  })

  it('does not treat an unhashed path as immutable', () => {
    expect(pathKind('/_pagefind/pagefind.js')).toBe('page')
    expect(pathKind('/palette/4.1.json')).toBe('page')
    expect(pathKind('/_pagefind/4.1.XYZ/pagefind.js')).toBe('page')
  })

  it('gives the palette the flat-deny policy and the search bundle the document policy', () => {
    expect(isInertPath('/palette/4.1.0123456789.json')).toBe(true)
    expect(isInertPath('/icon-32.png')).toBe(true)
    expect(isInertPath('/_pagefind/4.1.0123456789/pagefind-worker.js')).toBe(false)
    expect(isInertPath('/docs/4.1/guards')).toBe(false)
  })
})

describe('playground assets', () => {
  it('caches a hashed runtime and the compiler as immutable, under the flat-deny policy', () => {
    expect(pathKind('/playground/4.1.0-beta.7.0123456789.js')).toBe('playground')
    expect(pathKind('/playground/4.1.0.abcdef0123.js')).toBe('playground')
    expect(pathKind('/playground/swc.abcdef0123.wasm')).toBe('playground')
    expect(pathKind('/playground/frame.abcdef0123.js')).toBe('playground')
    expect(cacheControlFor('/playground/swc.abcdef0123.wasm')).toBe(IMMUTABLE)
    expect(isInertPath('/playground/4.1.0-beta.7.0123456789.js')).toBe(true)
  })

  it('treats anything else under /playground as a page, never as immutable', () => {
    expect(pathKind('/playground/runtime.js')).toBe('page')
    expect(pathKind('/playground/4.1.0-beta.7.0123456789.js.map')).toBe('page')
    expect(pathKind('/playground/swc.xyz.wasm')).toBe('page')
    expect(pathKind('/playground/frame.abcdef0123.html')).toBe('page')
    expect(pathKind('/playground/4.1.0-beta.7.abcdef0123.wasm')).toBe('page')
  })

  it("never stores a line's frame, whose policy names the site, while what it loads stays immutable", () => {
    expect(pathKind('/playground/4.1.0-beta.7.0123456789.html')).toBe('playground-frame')
    expect(cacheControlFor('/playground/4.1.0-beta.7.0123456789.html')).toBe(UNSTORED)
    expect(isInertPath('/playground/4.1.0-beta.7.0123456789.html')).toBe(false)
    for (const loaded of [
      '/playground/frame.abcdef0123.js',
      '/playground/4.1.0-beta.7.0123456789.js',
      '/playground/swc.abcdef0123.wasm',
    ]) {
      expect(cacheControlFor(loaded), loaded).toBe(IMMUTABLE)
      expect(isInertPath(loaded), loaded).toBe(true)
    }
  })
})

describe('playgroundFrameCsp', () => {
  it("sandboxes the frame and limits its scripts and requests to the playground's files, by the site's origin exactly", () => {
    expect(playgroundFrameCsp('https://meocord.dev').split('; ')).toEqual([
      'sandbox allow-scripts',
      "default-src 'none'",
      "script-src https://meocord.dev/playground/ 'unsafe-eval' 'wasm-unsafe-eval'",
      'worker-src blob:',
      'connect-src https://meocord.dev/playground/',
      'frame-ancestors https://meocord.dev',
      "base-uri 'none'",
      "form-action 'none'",
    ])
    expect(playgroundFrameCsp('http://localhost:4100')).toContain('frame-ancestors http://localhost:4100;')
    expect(playgroundFrameCsp('https://meocord.dev')).not.toContain('http://')
  })

  it('denies everything for an origin a policy cannot name', () => {
    for (const origin of ['null', 'https://a.test; script-src *', 'https://a.test/x', 'javascript:alert(1)', ''])
      expect(playgroundFrameCsp(origin)).toBe(STATIC_FILE_CSP)
  })

  it('takes plain http only for this machine, and denies everything for any other http site', () => {
    expect(playgroundFrameCsp('http://meocord.dev')).toBe(STATIC_FILE_CSP)
    expect(playgroundFrameCsp('http://docs.example.com:8080')).toBe(STATIC_FILE_CSP)
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:8080', 'http://[::1]:4100', 'http://LOCALHOST'])
      expect(playgroundFrameCsp(origin), origin).toContain(`frame-ancestors ${origin};`)
    expect(playgroundFrameCsp('https://[::1]:4100')).toContain(
      "script-src https://[::1]:4100/playground/ 'unsafe-eval'",
    )
  })
})
