import { describe, expect, it } from 'vitest'
import {
  cacheControlFor,
  IMMUTABLE,
  isInertPath,
  MOVING_PAGE,
  NAMED_FILE,
  pathKind,
  prereleaseRedirect,
  VERSIONED_PAGE,
} from '@/lib/cache-policy'

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
  it('points next and its pages at the prerelease line', () => {
    expect(prereleaseRedirect('/docs/next', '4.1')).toBe('/docs/4.1')
    expect(prereleaseRedirect('/docs/next/guides/defer', '4.1')).toBe('/docs/4.1/guides/defer')
  })

  it('leaves other paths alone', () => {
    expect(prereleaseRedirect('/docs/nextjs', '4.1')).toBeUndefined()
    expect(prereleaseRedirect('/docs/latest', '4.1')).toBeUndefined()
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
