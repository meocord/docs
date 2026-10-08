import { describe, expect, it } from 'vitest'
import {
  canonicalDocsPath,
  docsHref,
  entrySegment,
  lineOf,
  lineSegment,
  memberAnchor,
  olderLines,
  upgradeSection,
  resolveStoredHref,
  versionElsewhere,
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
    expect(docsHref({ kind: 'guide', line: '4.1', slug: 'tickets', group: 'recipes' }, BETA)).toBe(
      '/docs/4.1/recipes/tickets',
    )
  })

  it('builds line API URLs from the entry subpath, with lowercase member anchors', () => {
    expect(docsHref({ kind: 'api', line: '4.1', section: 'meocord/decorator', symbol: 'Defer' }, BETA)).toBe(
      '/docs/4.1/api/decorator/Defer',
    )
    expect(
      docsHref({ kind: 'api', line: '4.1', section: 'core', symbol: 'MeoCordApp', member: 'startShards' }, STABLE),
    ).toBe('/docs/latest/api/core/MeoCordApp#startshards')
  })

  it("builds a by-kind API's URLs from the kind, and its index and kind pages", () => {
    expect(docsHref({ kind: 'api', line: '4.1', section: 'decorators', symbol: 'Defer' }, BETA)).toBe(
      '/docs/4.1/api/decorators/Defer',
    )
    expect(docsHref({ kind: 'api-index', line: '4.1' }, BETA)).toBe('/docs/4.1/api')
    expect(docsHref({ kind: 'api-index', line: '4.1', section: 'testing' }, STABLE)).toBe('/docs/latest/api/testing')
  })

  it('builds exact-version API URLs under the line, never latest', () => {
    expect(
      docsHref(
        { kind: 'api', line: '4.0', section: 'meocord/core', symbol: 'MeoCordApp', version: '4.0.0-beta.3' },
        BETA,
      ),
    ).toBe('/docs/4.0/api/4.0.0-beta.3/core/MeoCordApp')
  })

  it('refuses an exact version outside its line', () => {
    expect(() =>
      docsHref({ kind: 'api', line: '4.0', section: 'core', symbol: 'MeoCordApp', version: '4.1.0-beta.0' }, BETA),
    ).toThrow('4.1.0-beta.0 is not a version of line 4.0.')
    expect(() => docsHref({ kind: 'changelog', line: '4.0', version: '4.1.0' }, BETA)).toThrow(
      '4.1.0 is not a version of line 4.0.',
    )
  })

  it("builds a line's changelog URL, and each release's own page under it, dots kept", () => {
    expect(docsHref({ kind: 'changelog', line: '4.1' }, BETA)).toBe('/docs/4.1/changelog')
    expect(docsHref({ kind: 'changelog', line: '4.1', version: '4.1.0-beta.0' }, BETA)).toBe(
      '/docs/4.1/changelog/4.1.0-beta.0',
    )
    expect(docsHref({ kind: 'changelog', line: '4.0', version: '4.0.0' }, BETA)).toBe('/docs/latest/changelog/4.0.0')
  })

  it('builds the URL a line lands on', () => {
    expect(docsHref({ kind: 'line', line: '4.0' }, BETA)).toBe('/docs/latest')
    expect(docsHref({ kind: 'line', line: '4.1' }, BETA)).toBe('/docs/4.1')
    expect(docsHref({ kind: 'line', line: '4.0' }, STABLE)).toBe('/docs/4.0')
  })

  it("builds a line's playground URL, with the code a share link carries", () => {
    expect(docsHref({ kind: 'playground', line: '4.1' }, BETA)).toBe('/docs/4.1/playground')
    expect(docsHref({ kind: 'playground', line: '4.1', code: 'v1.abc-_9' }, BETA)).toBe(
      '/docs/4.1/playground#v1.abc-_9',
    )
    expect(() => docsHref({ kind: 'playground', line: '4.1', code: 'v1.a b' }, BETA)).toThrow('not a valid share code')
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
    expect(() => docsHref({ kind: 'api', line: '4.1', section: 'other/core', symbol: 'X' }, BETA)).toThrow(
      '"other/core" is not a meocord entry point.',
    )
    expect(() => docsHref({ kind: 'api', line: '4.1', section: 'core', symbol: 'a/b' }, BETA)).toThrow(
      'not a valid symbol name',
    )
    expect(() => docsHref({ kind: 'api', line: '4.1', section: 'core', symbol: 'X', member: 'x y' }, BETA)).toThrow(
      'not a valid member name',
    )
    expect(() => docsHref({ kind: 'missing', line: '4.1', id: 'A' }, BETA)).toThrow('not a valid page id')
  })
})

describe('canonicalDocsPath', () => {
  it("gives the current line's number URL as latest, and other lines their number", () => {
    expect(canonicalDocsPath('/docs/4.1/guards', STABLE)).toBe('/docs/latest/guards')
    expect(canonicalDocsPath('/docs/4.0/guards', STABLE)).toBe('/docs/4.0/guards')
    expect(canonicalDocsPath('/docs/4.0/guards', BETA)).toBe('/docs/latest/guards')
  })

  it("puts a line-bound page reached through latest at its line's number", () => {
    expect(canonicalDocsPath('/docs/latest/api/4.0.0-beta.0/common/Logger', STABLE)).toBe(
      '/docs/4.0/api/4.0.0-beta.0/common/Logger',
    )
    expect(canonicalDocsPath('/docs/latest/missing/features', STABLE)).toBe('/docs/4.1/missing/features')
    expect(canonicalDocsPath('/docs/latest/missing/features', BETA)).toBe('/docs/4.0/missing/features')
  })

  it('leaves every other path as it is', () => {
    expect(canonicalDocsPath('/docs/latest/guards', STABLE)).toBe('/docs/latest/guards')
    expect(canonicalDocsPath('/docs/latest/api/decorators/Defer', STABLE)).toBe('/docs/latest/api/decorators/Defer')
    expect(canonicalDocsPath('/docs/latest/api/5.0.0/core/Logger', STABLE)).toBe('/docs/latest/api/5.0.0/core/Logger')
    expect(canonicalDocsPath('/', STABLE)).toBe('/')
  })
})

describe('versionElsewhere', () => {
  it('names the line an exact version belongs to when a URL puts it under another line, as a latest URL does', () => {
    // A 4.0 version's page under latest, once 4.1 is current
    expect(versionElsewhere('4.1', '4.0.0-beta.0', STABLE)).toBe('4.0')
    expect(versionElsewhere('4.1', '4.0.0', STABLE)).toBe('4.0')
    // A 4.1 prerelease's page under latest, while 4.0 is current
    expect(versionElsewhere('4.0', '4.1.0-beta.3', BETA)).toBe('4.1')
  })

  it("leaves the line's own version, a line versions.json lacks, and what is no version", () => {
    expect(versionElsewhere('4.1', '4.1.0', STABLE)).toBeUndefined()
    expect(versionElsewhere('4.1', '3.9.0', STABLE)).toBeUndefined()
    expect(versionElsewhere('4.1', 'common', STABLE)).toBeUndefined()
  })
})

describe('upgradeSection', () => {
  it("names the upgrade guide's section from a line to the next, by number", () => {
    expect(upgradeSection('4.0', STABLE)).toBe('upgrading-from-40-to-41')
    expect(upgradeSection('3.9', BETA)).toBe('upgrading-from-39-to-40')
    const tenth: VersionsManifest = {
      lines: [
        { line: '4.10', status: 'current' },
        { line: '4.9', status: 'archived' },
      ],
    }
    expect(upgradeSection('4.9', tenth)).toBe('upgrading-from-49-to-410')
  })

  it('has none for the newest line', () => {
    expect(upgradeSection('4.1', STABLE)).toBeUndefined()
  })
})

describe('olderLines', () => {
  it('lists the lines before a line, newest first, whatever their status', () => {
    expect(olderLines('4.1', BETA)).toEqual(['4.0', '3.9'])
    expect(olderLines('4.0', BETA)).toEqual(['3.9'])
    expect(olderLines('4.1', STABLE)).toEqual(['4.0'])
    expect(olderLines('4.0', STABLE)).toEqual([])
  })

  it('orders lines by number, not as versions.json lists them', () => {
    const shuffled: VersionsManifest = {
      lines: [
        { line: '4.0', status: 'maintained' },
        { line: '4.10', status: 'current' },
        { line: '4.9', status: 'maintained' },
      ],
    }
    expect(olderLines('4.10', shuffled)).toEqual(['4.9', '4.0'])
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
    expect(() => docsHref({ kind: 'changelog', line: '4.1', version: 'next' }, BETA)).toThrow(
      '"next" is not a version.',
    )
  })
})
