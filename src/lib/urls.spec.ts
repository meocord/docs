import { describe, expect, it } from 'vitest'
import {
  changelogAnchor,
  docsHref,
  entrySegment,
  lineOf,
  lineSegment,
  memberAnchor,
  resolveStoredHref,
  type VersionsManifest,
} from '@/lib/urls'

// During the 4.1 beta: 4.0 is current, 4.1 in prerelease.
const BETA: VersionsManifest = {
  lines: [
    { line: '4.1', status: 'prerelease' },
    { line: '4.0', status: 'current' },
    { line: '3.9', status: 'archived' },
  ],
}
// After 4.1.0: 4.1 is current, 4.0 maintained.
const STABLE: VersionsManifest = {
  lines: [
    { line: '4.1', status: 'current' },
    { line: '4.0', status: 'maintained' },
  ],
}

describe('lineSegment', () => {
  it('addresses the current line as latest and every other line by number', () => {
    expect(lineSegment('4.0', BETA)).toBe('latest')
    expect(lineSegment('4.1', BETA)).toBe('4.1')
    expect(lineSegment('3.9', BETA)).toBe('3.9')
    expect(lineSegment('4.1', STABLE)).toBe('latest')
    expect(lineSegment('4.0', STABLE)).toBe('4.0')
  })

  it('rejects a line versions.json does not list', () => {
    expect(() => lineSegment('5.0', BETA)).toThrow('Line "5.0" is not in versions.json.')
  })
})

describe('docsHref', () => {
  it('builds guide URLs, with anchors', () => {
    expect(docsHref({ kind: 'guide', line: '4.0', slug: 'guards' }, BETA)).toBe('/docs/latest/guards')
    expect(docsHref({ kind: 'guide', line: '4.1', slug: 'guards', anchor: 'global-guards' }, BETA)).toBe(
      '/docs/4.1/guards#global-guards',
    )
  })

  it('builds line API URLs from the entry subpath, with lowercase member anchors', () => {
    expect(docsHref({ kind: 'api', line: '4.1', entry: 'meocord/decorator', symbol: 'Defer' }, BETA)).toBe(
      '/docs/4.1/api/decorator/Defer',
    )
    expect(
      docsHref({ kind: 'api', line: '4.1', entry: 'core', symbol: 'MeoCordApp', member: 'startShards' }, STABLE),
    ).toBe('/docs/latest/api/core/MeoCordApp#startshards')
  })

  it('builds exact-version API URLs under the line, never latest', () => {
    expect(
      docsHref(
        { kind: 'api', line: '4.0', entry: 'meocord/core', symbol: 'MeoCordApp', version: '4.0.0-beta.3' },
        BETA,
      ),
    ).toBe('/docs/4.0/api/4.0.0-beta.3/core/MeoCordApp')
  })

  it('refuses an exact version outside its line', () => {
    expect(() =>
      docsHref({ kind: 'api', line: '4.0', entry: 'core', symbol: 'MeoCordApp', version: '4.1.0-beta.0' }, BETA),
    ).toThrow('4.1.0-beta.0 is not a version of line 4.0.')
    expect(() => docsHref({ kind: 'changelog', line: '4.0', version: '4.1.0' }, BETA)).toThrow(
      '4.1.0 is not a version of line 4.0.',
    )
  })

  it('builds changelog URLs with the version anchor, dots kept', () => {
    expect(docsHref({ kind: 'changelog', line: '4.1' }, BETA)).toBe('/docs/4.1/changelog')
    expect(docsHref({ kind: 'changelog', line: '4.1', version: '4.1.0-beta.0' }, BETA)).toBe(
      '/docs/4.1/changelog#v4.1.0-beta.0',
    )
  })

  it('builds migrating and missing-page URLs', () => {
    expect(docsHref({ kind: 'migrating', line: '4.0', anchor: 'from-3x' }, BETA)).toBe('/docs/latest/migrating#from-3x')
    expect(docsHref({ kind: 'migrating', line: '4.1' }, BETA)).toBe('/docs/4.1/migrating')
    expect(docsHref({ kind: 'missing', line: '4.0', id: 'cooldowns' }, BETA)).toBe('/docs/4.0/missing/cooldowns')
  })

  it('encodes anchors', () => {
    expect(docsHref({ kind: 'guide', line: '4.1', slug: 'guards', anchor: 'a b' }, BETA)).toBe('/docs/4.1/guards#a%20b')
  })

  it('rejects names that are not valid in a URL', () => {
    expect(() => docsHref({ kind: 'guide', line: '4', slug: 'guards' }, BETA)).toThrow('"4" is not a valid line.')
    expect(() => docsHref({ kind: 'guide', line: '4.1', slug: '../x' }, BETA)).toThrow('not a valid page slug')
    expect(() => docsHref({ kind: 'api', line: '4.1', entry: 'other/core', symbol: 'X' }, BETA)).toThrow(
      '"other/core" is not a meocord entry point.',
    )
    expect(() => docsHref({ kind: 'api', line: '4.1', entry: 'core', symbol: 'a/b' }, BETA)).toThrow(
      'not a valid symbol name',
    )
    expect(() => docsHref({ kind: 'api', line: '4.1', entry: 'core', symbol: 'X', member: 'x y' }, BETA)).toThrow(
      'not a valid member name',
    )
    expect(() => docsHref({ kind: 'missing', line: '4.1', id: 'A' }, BETA)).toThrow('not a valid page id')
  })
})

describe('resolveStoredHref', () => {
  it('moves the current line to latest when its status flips, and leaves the others', () => {
    expect(resolveStoredHref('/docs/4.0/x', BETA)).toBe('/docs/latest/x')
    expect(resolveStoredHref('/docs/4.1/x', BETA)).toBe('/docs/4.1/x')
    expect(resolveStoredHref('/docs/4.1/x', STABLE)).toBe('/docs/latest/x')
    expect(resolveStoredHref('/docs/4.0/x', STABLE)).toBe('/docs/4.0/x')
  })

  it('keeps anchors, queries and the line root', () => {
    expect(resolveStoredHref('/docs/4.1/guards#global-guards', STABLE)).toBe('/docs/latest/guards#global-guards')
    expect(resolveStoredHref('/docs/4.1/changelog#v4.1.0-beta.0', STABLE)).toBe('/docs/latest/changelog#v4.1.0-beta.0')
    expect(resolveStoredHref('/docs/4.1', STABLE)).toBe('/docs/latest')
    expect(resolveStoredHref('/docs/4.1#top', STABLE)).toBe('/docs/latest#top')
    expect(resolveStoredHref('/docs/4.1?q=1', STABLE)).toBe('/docs/latest?q=1')
  })

  it('leaves exact-version API pages and missing pages on their line', () => {
    expect(resolveStoredHref('/docs/4.1/api/4.1.0-beta.0/core/MeoCordApp', STABLE)).toBe(
      '/docs/4.1/api/4.1.0-beta.0/core/MeoCordApp',
    )
    expect(resolveStoredHref('/docs/4.1/missing/cooldowns', STABLE)).toBe('/docs/4.1/missing/cooldowns')
    expect(resolveStoredHref('/docs/4.1/api/core/MeoCordApp', STABLE)).toBe('/docs/latest/api/core/MeoCordApp')
  })

  it('leaves hrefs outside the docs, and unknown lines, as they are', () => {
    for (const href of [
      'https://github.com/meocord/meocord',
      '#local',
      '/og/site/x.png',
      '/docs/4.10x',
      '/docs/9.9/x',
    ]) {
      expect(resolveStoredHref(href, STABLE)).toBe(href)
    }
  })
})

describe('helpers', () => {
  it('maps versions to lines and entries to segments', () => {
    expect(lineOf('4.1.0-beta.0')).toBe('4.1')
    expect(lineOf('4.0.0')).toBe('4.0')
    expect(() => lineOf('4.1')).toThrow('"4.1" is not a version.')
    expect(entrySegment('meocord/testing')).toBe('testing')
    expect(entrySegment('eslint')).toBe('eslint')
  })

  it('shares the anchors pages give their headings', () => {
    expect(memberAnchor('startShards')).toBe('startshards')
    expect(changelogAnchor('4.1.0-beta.0')).toBe('v4.1.0-beta.0')
    expect(() => changelogAnchor('next')).toThrow('"next" is not a version.')
  })
})
