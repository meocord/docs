import { describe, expect, it } from 'vitest'
import { checkSite, markdownLinks, parsePage, type SiteSnapshot } from './content.js'
import type { ConfigDocument } from './config-reference.js'
import type { VersionsConfig } from './versions.js'

// 4.0 shows pages imported from its README; 4.1 has authored guides and is what the site shows for it
const config: VersionsConfig = {
  package: 'meocord',
  since: '4.0.0',
  provenance: { issuer: 'https://token.actions.githubusercontent.com', identities: [], integrityOnly: [] },
  lines: [
    { line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.0'] },
    { line: '4.0', status: 'current', guides: 'readme', versions: ['4.0.0'] },
  ],
}

const reference = (version: string): ConfigDocument => ({
  version,
  groups: [
    {
      interface: 'MeoCordConfig',
      summary: '',
      options: [
        {
          name: 'externals',
          type: 'string[]',
          required: false,
          summary: 'See [`appName`](#appname).',
          examples: ["```ts\nexternals: ['x']\n```"],
        },
        { name: 'appName', type: 'string', required: false, summary: 'Shown in logs.', examples: [] },
      ],
    },
  ],
})

const page = (frontmatter: string, body: string) => `---\n${frontmatter}\n---\n\n${body}\n`

const site = (overrides: Partial<SiteSnapshot> = {}): SiteSnapshot => ({
  config,
  authored: {
    '4.1': {
      guards: page(
        'id: guards\ntitle: Guards',
        '## Passing options\n\n::example{file="guards/owner.guard.ts" region="guard"}\n\nSee [the 4.0 page](/docs/4.0/guards#params) and [options](#passing-options).',
      ),
    },
    '4.0': {},
  },
  readme: {
    '4.1': {},
    '4.0': {
      guards: page(
        'id: guards\ntitle: Guards\nsource: readme@4.0.0',
        '```ts\nconst ok = true\n```\n\nSee [4.1](/docs/4.1/guards).',
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
              markdown:
                'See [start](/docs/4.1/migrating#start), [notes](/docs/4.1/changelog#v4.1.0-beta.0) and [Defer](/docs/4.1/api/decorator/Defer).',
              breaking: true,
            },
          ],
        },
      ],
    },
    '4.0.0': { version: '4.0.0', sections: [] },
  },
  apis: new Set(['4.1.0-beta.0', '4.0.0']),
  configs: { '4.1.0-beta.0': reference('4.1.0-beta.0'), '4.0.0': reference('4.0.0') },
  examples: {
    '4.1': { 'src/guards/owner.guard.ts': '// #region guard\nexport class OwnerGuard {}\n// #endregion guard\n' },
    '4.0': {},
  },
  ...overrides,
})

const withAuthored = (pages: Record<string, string>) =>
  site({ authored: { ...site().authored, '4.1': { ...site().authored['4.1'], ...pages } } })

describe('checkSite', () => {
  it('accepts a consistent site', () => {
    expect(checkSite(site())).toEqual([])
  })

  it('rejects stored links through latest or next, and links not in their stored form', () => {
    const links = [
      '[a](/docs/latest/guards)',
      '[b](/docs/next/guards)',
      '[c](/docs/4.1/api/meocord/decorator/Defer)',
      '[d](/docs/4.1)',
      '[e](/docs/4.1#top)',
    ]

    expect(checkSite(withAuthored({ a: page('id: a\ntitle: A', links.join('\n')) }))).toEqual([
      'content/4.1/a.md: /docs/latest/guards names latest; a stored link names its line, which keeps its meaning when statuses change',
      'content/4.1/a.md: /docs/next/guards names next; a stored link names its line, which keeps its meaning when statuses change',
      'content/4.1/a.md: /docs/4.1/api/meocord/decorator/Defer has more path than an API link takes',
      'content/4.1/a.md: /docs/4.1#top names no page',
    ])
  })

  it('reports pages without an id or title, and ids used twice', () => {
    const pages = { a: page('title: A', 'x'), b: page('id: b', 'x'), c: page('id: b\ntitle: C', 'x') }

    expect(checkSite(withAuthored(pages))).toEqual([
      'content/4.1/a.md: front matter has no id',
      'content/4.1/b.md: front matter has no title',
      'content/4.1/c.md: id "b" is also used by content/4.1/b.md',
    ])
  })

  it('keeps TypeScript and imported pages out of authored guides', () => {
    const pages = {
      a: page('id: a\ntitle: A', '```typescript\nconst x = 1\n```'),
      b: page('id: b\ntitle: B\nsource: readme@4.1.0-beta.0', 'Imported.'),
    }

    expect(checkSite(withAuthored(pages))).toEqual([
      'content/4.1/a.md: TypeScript belongs in examples/4.1 and an ::example directive, not a code fence',
      'content/4.1/b.md: a page imported from a README belongs in generated/readme/4.1',
    ])
  })

  it('reports examples that do not exist, or lack the region', () => {
    const pages = {
      a: page(
        'id: a\ntitle: A',
        '::example{file="missing.ts"}\n::example{file="guards/owner.guard.ts" region="nope"}\n::example{region="x"}',
      ),
    }

    expect(checkSite(withAuthored(pages))).toEqual([
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
      '[e](/docs/4.1/changelog#v4.0.0)',
      '[e2](/docs/4.1/changelog#4.1.0-beta.0)',
      '[f](#nowhere)',
      '[g](../README.md)',
      '[h](https://example.com/page.md)',
      '`[i](/docs/9.9/in-code)`',
    ]

    expect(checkSite(withAuthored({ a: page('id: a\ntitle: A', links.join('\n')) }))).toEqual([
      'content/4.1/a.md: /docs/3.2/guards names a version the site does not document',
      'content/4.1/a.md: /docs/4.0/nowhere names no page of generated/readme/4.0',
      'content/4.1/a.md: /docs/4.0/guards#nowhere names no heading of that page',
      'content/4.1/a.md: /docs/4.1/migrating#nowhere names no heading of the migration guide',
      'content/4.1/a.md: /docs/4.1/changelog#v4.0.0 is not a valid link: 4.0.0 is not a version of line 4.1.',
      'content/4.1/a.md: /docs/4.1/changelog#4.1.0-beta.0 is not in its stored form, /docs/4.1/changelog#v4.1.0-beta.0',
      'content/4.1/a.md: no heading for #nowhere',
      'content/4.1/a.md: ../README.md does not point at a page of the site',
    ])
  })

  it('resolves links into a line from its own pages in their set, and from elsewhere in what the site shows', () => {
    // 4.0 shows its imported pages; a 4.0 page authored ahead of the switch links the authored set
    const authored = { ...site().authored, '4.0': { intro: page('id: intro\ntitle: Intro', '[g](/docs/4.0/guards)') } }

    expect(checkSite(site({ authored }))).toEqual([
      'content/4.0/intro.md: /docs/4.0/guards names no page of content/4.0',
    ])
    expect(checkSite(withAuthored({ a: page('id: a\ntitle: A', '[intro](/docs/4.0/intro)') }))).toEqual([
      'content/4.1/a.md: /docs/4.0/intro names no page of generated/readme/4.0',
    ])
  })

  it('keeps each line’s pages where its guide source says, and nowhere else', () => {
    const readme = { '4.1': { stale: page('id: stale\ntitle: Stale\nsource: readme@4.1.0-beta.0', 'x') }, '4.0': {} }

    expect(checkSite(site({ readme, authored: { '4.1': {}, '4.0': {} } }))).toEqual([
      'content/4.1 has no pages',
      "generated/readme/4.1 is still there, though 4.1's guides are authored",
      'generated/readme/4.0 has no pages',
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

  it('shows the configuration reference as an authored page, and refuses one written by hand', () => {
    const links = page(
      'id: a\ntitle: A',
      '[c](/docs/4.1/config-reference#appname) [x](/docs/4.1/config-reference#nope)',
    )

    expect(checkSite(withAuthored({ a: links }))).toEqual([
      'content/4.1/a.md: /docs/4.1/config-reference#nope names no heading of that page',
    ])
    expect(checkSite(withAuthored({ 'config-reference': page('id: config-reference\ntitle: C', 'x') }))).toEqual([
      'content/4.1/config-reference.md: the configuration reference is generated',
    ])
  })

  it('reports a version without its configuration reference', () => {
    expect(checkSite(site({ configs: { '4.1.0-beta.0': reference('4.1.0-beta.0') } }))).toEqual([
      '4.0.0 has no generated/config/4.0.0.json',
    ])
  })

  it('reports a link to a migration guide the line lacks', () => {
    const readme = {
      '4.1': {},
      '4.0': { guards: page('id: guards\ntitle: Guards\nsource: readme@4.0.0', '[m](/docs/4.0/migrating)') },
    }

    expect(checkSite(site({ readme, migrating: { '4.1': '# Upgrading\n\n## Start\n' } }))).toEqual([
      'generated/readme/4.0/guards.md: /docs/4.0/migrating links a migration guide 4.0 does not have',
      'line 4.0 has no generated/migrating/4.0.md',
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
