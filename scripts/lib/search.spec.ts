import { describe, expect, it } from 'vitest'
import type { ApiDocument } from './api.js'
import { parsePage } from './content.js'
import {
  apiDocuments,
  changelogDocument,
  guideDocument,
  markdownText,
  migratingDocument,
  paletteIndex,
  searchHtml,
  splitSections,
} from './search.js'
import type { VersionsConfig } from './versions.js'

const config = {
  package: 'meocord',
  since: '4.0.0',
  provenance: { issuer: 'x', identities: [], integrityOnly: [] },
  lines: [
    { line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.0', '4.1.0-beta.1'] },
    { line: '4.0', status: 'current', guides: 'readme', versions: ['4.0.0'] },
  ],
} as VersionsConfig

const summary = (text: string) => ({ summary: [{ kind: 'text' as const, text }] })

/** A small TypeDoc project: a function, a class with an own and an inherited member, and a bad name. */
const api = {
  meta: { package: 'meocord', version: '4.1.0-beta.1', integrity: 'x', typedoc: '0.28' },
  project: {
    id: 0,
    name: 'meocord',
    variant: 'project',
    kind: 1,
    flags: {},
    children: [
      {
        id: 1,
        name: 'meocord/decorator',
        variant: 'declaration',
        kind: 2,
        flags: {},
        children: [
          {
            id: 2,
            name: 'Cooldown',
            variant: 'declaration',
            kind: 64,
            flags: {},
            signatures: [
              {
                id: 3,
                name: 'Cooldown',
                variant: 'signature',
                kind: 4096,
                flags: {},
                comment: {
                  ...summary('Limits how often a handler runs.'),
                  blockTags: [{ tag: '@deprecated', content: [{ kind: 'text', text: 'Use Throttle.' }] }],
                },
                parameters: [
                  { id: 4, name: 'options', variant: 'param', kind: 32768, flags: {}, comment: summary('The window.') },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 5,
        name: 'meocord/core',
        variant: 'declaration',
        kind: 2,
        flags: {},
        children: [
          {
            id: 6,
            name: 'MeoCordApp',
            variant: 'declaration',
            kind: 128,
            flags: {},
            comment: {
              summary: [
                { kind: 'text', text: 'The app. See ' },
                { kind: 'code', text: '`start`' },
              ],
            },
            children: [
              {
                id: 7,
                name: 'startShards',
                variant: 'declaration',
                kind: 2048,
                flags: {},
                comment: summary('Starts shards.'),
              },
              { id: 8, name: 'on', variant: 'declaration', kind: 2048, flags: { isInherited: true } },
              { id: 9, name: 'size', variant: 'declaration', kind: 1024, flags: {} },
            ],
          },
          { id: 10, name: '"quoted"', variant: 'declaration', kind: 32, flags: {} },
        ],
      },
    ],
  },
} as unknown as ApiDocument

describe('markdownText', () => {
  it('keeps the words and code, and drops the markup', () => {
    const text = markdownText(
      [
        '## Options',
        'Use **`@Cooldown`** with a [window](/docs/4.1/cooldowns#window) and _care_.',
        '![diagram](/d.png)',
        '> A note <br/> here',
        '- one',
        '1. two',
        '| a | b |',
        '| --- | --- |',
        '```ts',
        'const x = 1',
        '```',
      ].join('\n'),
    )
    expect(text).toBe(
      'Options\nUse @Cooldown with a window and _care_.\ndiagram\nA note here\none\ntwo\na b\nconst x = 1',
    )
  })

  it('expands an example into its code, and drops one it cannot read', () => {
    const examples = (file: string, region?: string) => (file === 'a.ts' ? `code of ${region}` : undefined)
    expect(markdownText('::example{file="a.ts" region="guard"}\n::example{file="missing.ts"}', examples)).toBe(
      'code of guard',
    )
  })
})

describe('splitSections', () => {
  it('splits at h2 with anchors slugged across every heading, as the page ids are', () => {
    const sections = splitSections(
      'Intro text.\n\n# Title\n## Setup\nA\n### Detail\nB\n## Setup\nC\n```\n## not a heading\n```',
    )
    expect(sections).toEqual([
      { anchor: undefined, heading: undefined, text: 'Intro text.\n\nTitle' },
      { anchor: 'setup', heading: 'Setup', text: 'A\nDetail\nB' },
      { anchor: 'setup-1', heading: 'Setup', text: 'C\n## not a heading' },
    ])
  })

  it('splits a page imported from a README at its ### headings, which are its sections', () => {
    expect(splitSections('Lead.\n### Setup\nA\n#### Detail\nB\n```\n## in code\n```\n### Run\nC')).toEqual([
      { anchor: undefined, heading: undefined, text: 'Lead.' },
      { anchor: 'setup', heading: 'Setup', text: 'A\nDetail\nB\n## in code' },
      { anchor: 'run', heading: 'Run', text: 'C' },
    ])
  })

  it('drops an empty lead section', () => {
    expect(splitSections('## Only\ntext')).toEqual([{ anchor: 'only', heading: 'Only', text: 'text' }])
  })
})

describe('documents', () => {
  it('builds a guide at its emitted URL, titled from its front matter', () => {
    const page = parsePage(
      "---\nid: guards\ntitle: 'Guards'\n---\nGuards run first.\n## Global guards\nEvery handler.\n",
    )
    const document = guideDocument('4.0', 'guards', page, config)
    expect(document).toMatchObject({ url: '/docs/latest/guards', title: 'Guards', kind: 'guide', line: '4.0' })
    expect(document.sections.map(section => section.anchor)).toEqual([undefined, 'global-guards'])
    expect(guideDocument('4.1', 'x', parsePage('body'), config).title).toBe('x')
  })

  it('builds the migration guide and the changelog, one section per version at its anchor', () => {
    expect(migratingDocument('4.1', '## From 4.0\nSteps.', config)).toMatchObject({
      url: '/docs/4.1/migrating',
      sections: [{ anchor: 'from-40', heading: 'From 4.0', text: 'Steps.' }],
    })
    const changelog = changelogDocument(
      '4.1',
      [
        {
          version: '4.1.0-beta.1',
          sections: [{ title: 'Patch Changes', entries: [{ markdown: 'Fix `x`.', breaking: false }] }],
        },
        { version: '4.1.0-beta.0', sections: [] },
      ],
      config,
    )
    expect(changelog.url).toBe('/docs/4.1/changelog')
    expect(changelog.sections).toEqual([
      { anchor: 'v4.1.0-beta.1', heading: '4.1.0-beta.1', text: 'Fix x.' },
      { anchor: 'v4.1.0-beta.0', heading: '4.1.0-beta.0', text: '' },
    ])
  })

  it('builds one API document per symbol, own members as sections, names unsafe in a URL left out', () => {
    const documents = apiDocuments('4.1', api, config)
    expect(documents.map(document => document.url)).toEqual([
      '/docs/4.1/api/decorator/Cooldown',
      '/docs/4.1/api/core/MeoCordApp',
    ])
    const [cooldown, app] = documents
    expect(cooldown.sections[0].text).toContain('function Cooldown meocord/decorator')
    expect(cooldown.sections[0].text).toContain('options The window.')
    expect(cooldown.sections[0].text).toContain('Use Throttle.')
    expect(app.sections.map(section => section.anchor)).toEqual([undefined, 'startshards', 'size'])
    expect(app.sections[0].text).toContain('The app. See start')
    expect(app.sections[2].text).toBe('property size')
  })
})

describe('paletteIndex', () => {
  it('lists guides and symbols with entry, kind, since and deprecation, in a stable order', () => {
    const guides = [guideDocument('4.1', 'guards', parsePage("---\ntitle: 'Guards'\n---\n"), config)]
    const since = { 'meocord/decorator:Cooldown': { since: '4.1.0-beta.0' } }
    expect(paletteIndex('4.1', guides, api, since, config)).toEqual([
      { name: 'MeoCordApp', kind: 'class', url: '/docs/4.1/api/core/MeoCordApp', entry: 'core' },
      {
        name: 'Cooldown',
        kind: 'function',
        url: '/docs/4.1/api/decorator/Cooldown',
        entry: 'decorator',
        since: '4.1.0-beta.0',
        deprecated: true,
      },
      { name: 'Guards', kind: 'guide', url: '/docs/4.1/guards' },
    ])
    expect(paletteIndex('4.1', [], undefined, {}, config)).toEqual([])
  })
})

describe('searchHtml', () => {
  it('writes the title as meta, the line and kind as filters, and each section under its anchor', () => {
    const html = searchHtml(
      {
        url: '/docs/4.1/guards',
        title: 'Guards & <more>',
        kind: 'guide',
        line: '4.1',
        sections: [
          { text: 'See /docs/4.0/guards for the old way.' },
          { anchor: 'global', heading: 'Global', text: 'a < b' },
        ],
      },
      config,
    )
    expect(html).toContain('<h1 data-pagefind-meta="title">Guards &amp; &lt;more&gt;</h1>')
    expect(html).toContain('<span data-pagefind-filter="line" hidden>4.1</span>')
    expect(html).toContain('<span data-pagefind-filter="kind" hidden>guide</span>')
    expect(html).toContain('<p>See /docs/latest/guards for the old way.</p>')
    expect(html).toContain('<h2 id="global">Global</h2><p>a &lt; b</p>')
  })
})
