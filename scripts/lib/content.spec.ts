import { describe, expect, it } from 'vitest'
import { checkSite, markdownLinks, parsePage, type SiteSnapshot } from './content.js'
import type { VersionsConfig } from './versions.js'

const config: VersionsConfig = {
  package: 'meocord',
  since: '4.0.0',
  provenance: { issuer: 'https://token.actions.githubusercontent.com', identities: [], integrityOnly: [] },
  lines: [
    { line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.0'] },
    { line: '4.0', status: 'current', guides: 'readme', versions: ['4.0.0'] },
  ],
}

const page = (frontmatter: string, body: string) => `---\n${frontmatter}\n---\n\n${body}\n`

const site = (overrides: Partial<SiteSnapshot> = {}): SiteSnapshot => ({
  config,
  pages: {
    '4.1': {
      guards: page(
        'id: guards\ntitle: Guards',
        '## Passing options\n\n::example{file="guards/owner.guard.ts" region="guard"}\n\nSee [the 4.0 page](/docs/4.0/guards#params) and [options](#passing-options).',
      ),
    },
    '4.0': {
      guards: page(
        'id: guards\ntitle: Guards\nsource: readme@4.0.0',
        '```ts\nconst ok = true\n```\n\nSee [latest](/docs/latest/guards).',
      ),
    },
  },
  readmeAnchors: { '4.0': { guards: 'guards', params: 'guards' } },
  migrating: { '4.1': '# Upgrading\n\n## Start\n', '4.0': '# Upgrading\n' },
  changelogs: {
    '4.1.0-beta.0': {
      version: '4.1.0-beta.0',
      sections: [
        {
          title: 'Patch Changes',
          entries: [
            {
              markdown: 'See [start](/docs/4.1/migrating#start) and [notes](/docs/4.1/changelog#4.1.0-beta.0).',
              breaking: true,
            },
          ],
        },
      ],
    },
    '4.0.0': { version: '4.0.0', sections: [] },
  },
  apis: new Set(['4.1.0-beta.0', '4.0.0']),
  examples: {
    '4.1': { 'src/guards/owner.guard.ts': '// #region guard\nexport class OwnerGuard {}\n// #endregion guard\n' },
    '4.0': {},
  },
  ...overrides,
})

describe('checkSite', () => {
  it('accepts a consistent site', () => {
    expect(checkSite(site())).toEqual([])
  })

  it('follows the latest and next aliases to their lines', () => {
    const pages = {
      ...site().pages,
      '4.0': {
        guards: page(
          'id: guards\ntitle: Guards',
          '[n](/docs/next/guards#passing-options) [m](/docs/next/guards#params)',
        ),
      },
    }

    expect(checkSite(site({ pages }))).toEqual([
      'content/4.0/guards.md: /docs/next/guards#params names no heading of that page',
    ])
  })

  it('reports pages without an id or title, and ids used twice', () => {
    const pages = {
      ...site().pages,
      '4.1': { a: page('title: A', 'x'), b: page('id: b', 'x'), c: page('id: b\ntitle: C', 'x') },
    }

    expect(checkSite(site({ pages }))).toEqual([
      'content/4.1/a.md: front matter has no id',
      'content/4.1/b.md: front matter has no title',
      'content/4.1/c.md: id "b" is also used by content/4.1/b.md',
    ])
  })

  it('keeps TypeScript out of written guides, but not out of imported ones', () => {
    const pages = { ...site().pages, '4.1': { a: page('id: a\ntitle: A', '```typescript\nconst x = 1\n```') } }

    expect(checkSite(site({ pages }))).toEqual([
      'content/4.1/a.md: TypeScript belongs in examples/4.1 and an ::example directive, not a code fence',
    ])
  })

  it('reports examples that do not exist, or lack the region', () => {
    const pages = {
      ...site().pages,
      '4.1': {
        a: page(
          'id: a\ntitle: A',
          '::example{file="missing.ts"}\n::example{file="guards/owner.guard.ts" region="nope"}\n::example{region="x"}',
        ),
      },
    }

    expect(checkSite(site({ pages }))).toEqual([
      'content/4.1/a.md: examples/4.1/src/missing.ts does not exist',
      'content/4.1/a.md: examples/4.1/src/guards/owner.guard.ts has no region "nope"',
      'content/4.1/a.md: an ::example names no file',
    ])
  })

  it('reports links to pages, headings, versions and guides that do not exist', () => {
    const links = [
      '[a](/docs/3.2/guards)',
      '[b](/docs/4.0/nowhere)',
      '[c](/docs/4.0/guards#nowhere)',
      '[d](/docs/4.1/migrating#nowhere)',
      '[e](/docs/4.1/changelog#4.0.0)',
      '[f](#nowhere)',
      '[g](../README.md)',
      '[h](https://example.com/page.md)',
      '`[i](/docs/9.9/in-code)`',
    ]
    const pages = { ...site().pages, '4.1': { a: page('id: a\ntitle: A', links.join('\n')) } }

    expect(checkSite(site({ pages }))).toEqual([
      'content/4.1/a.md: /docs/3.2/guards names a version the site does not document',
      'content/4.1/a.md: /docs/4.0/nowhere names no page of 4.0',
      'content/4.1/a.md: /docs/4.0/guards#nowhere names no heading of that page',
      'content/4.1/a.md: /docs/4.1/migrating#nowhere names no heading of the migration guide',
      'content/4.1/a.md: /docs/4.1/changelog#4.0.0 names no version of 4.1',
      'content/4.1/a.md: no heading for #nowhere',
      'content/4.1/a.md: ../README.md does not point at a page of the site',
    ])
  })

  it('reports missing generated data', () => {
    expect(
      checkSite(
        site({
          apis: new Set(['4.0.0']),
          changelogs: { '4.0.0': { version: '4.0.0', sections: [] } },
          migrating: { '4.1': '# x' },
          readmeAnchors: {},
        }),
      ),
    ).toEqual([
      // Without the anchors map, the imported page's headings are unknown too
      'content/4.1/guards.md: /docs/4.0/guards#params names no heading of that page',
      'line 4.0 imports its README but has no generated/readme-anchors/4.0.json',
      'line 4.0 has no generated/migrating/4.0.md',
      '4.1.0-beta.0 has no generated/api/4.1.0-beta.0.json',
      '4.1.0-beta.0 has no generated/changelog/4.1.0-beta.0.json',
    ])
  })

  it('reports a line without pages, and a link to a migration guide the line lacks', () => {
    const pages = {
      '4.1': {},
      '4.0': { guards: page('id: guards\ntitle: Guards\nsource: readme@4.0.0', '[m](/docs/4.0/migrating)') },
    }

    expect(checkSite(site({ pages, migrating: { '4.1': '# x' } }))).toEqual([
      'content/4.1 has no pages',
      'content/4.0/guards.md: /docs/4.0/migrating links a migration guide 4.0 does not have',
      'line 4.0 has no generated/migrating/4.0.md',
      'generated/changelog/4.1.0-beta.0.json: /docs/4.1/migrating#start names no heading of the migration guide',
    ])
  })
})

describe('parsePage and markdownLinks', () => {
  it('reads front matter, and treats a file without it as body only', () => {
    expect(parsePage(page('id: a\ntitle: "A: b"', 'Body'))).toEqual({
      frontmatter: { id: 'a', title: 'A: b' },
      body: '\nBody\n',
    })
    expect(parsePage('Body')).toEqual({ frontmatter: {}, body: 'Body' })
  })

  it('ignores links inside code', () => {
    expect(markdownLinks('[a](/x "t")\n```\n[b](/y)\n```\n`[c](/z)`')).toEqual(['/x'])
  })
})
