import type { JSONOutput } from 'typedoc'
import { describe, expect, it } from 'vitest'
import { configReference, configReferencePage } from './config-reference.js'

const text = (value: string) => ({ kind: 'text' as const, text: value })
const code = (value: string) => ({ kind: 'code' as const, text: value })

const member = (id: number, name: string, type: unknown, comment?: unknown, optional = true) => ({
  id,
  name,
  variant: 'declaration',
  kind: 1024,
  flags: optional ? { isOptional: true } : {},
  type,
  comment,
})

// A trimmed API document: MeoCordConfig nesting ShardingConfig, and a symbol of another entry point
const project = {
  id: 0,
  name: 'meocord',
  variant: 'project',
  kind: 1,
  flags: {},
  children: [
    {
      id: 1,
      name: 'meocord/interface',
      variant: 'declaration',
      kind: 2,
      flags: {},
      children: [
        {
          id: 10,
          name: 'MeoCordConfig',
          variant: 'declaration',
          kind: 256,
          flags: {},
          comment: { summary: [text('The configuration.')] },
          children: [
            member(11, 'discordToken', { type: 'intrinsic', name: 'string' }, { summary: [text('The token.')] }, false),
            member(
              12,
              'bundleDependencies',
              { type: 'intrinsic', name: 'boolean' },
              { summary: [text('Bundles.')], blockTags: [{ tag: '@defaultValue', content: [code('`false`')] }] },
            ),
            member(
              13,
              'externals',
              {
                type: 'array',
                elementType: {
                  type: 'union',
                  types: [
                    { type: 'intrinsic', name: 'string' },
                    {
                      type: 'reference',
                      target: { packageName: 'typescript', qualifiedName: 'RegExp' },
                      name: 'RegExp',
                    },
                  ],
                },
              },
              {
                summary: [
                  text('With '),
                  { kind: 'inline-tag', tag: '@link', text: 'bundleDependencies', target: 12 },
                  text(', see '),
                  { kind: 'inline-tag', tag: '@link', text: 'Defer', target: 31 },
                  text('.'),
                ],
                blockTags: [{ tag: '@example', content: [code("```ts\nexternals: ['x']\n```")] }],
              },
            ),
            member(
              14,
              'sharding',
              { type: 'reference', target: 20, name: 'ShardingConfig' },
              {
                summary: [text('Shards.')],
                blockTags: [{ tag: '@defaultValue', content: [code('```ts\nOne | connection\n```')] }],
              },
            ),
          ],
        },
        {
          id: 20,
          name: 'ShardingConfig',
          variant: 'declaration',
          kind: 256,
          flags: {},
          comment: { summary: [text('How the bot shards.')] },
          children: [
            member(21, 'mode', {
              type: 'union',
              types: [
                { type: 'literal', value: 'internal' },
                { type: 'literal', value: 'process' },
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 30,
      name: 'meocord/decorator',
      variant: 'declaration',
      kind: 2,
      flags: {},
      children: [{ id: 31, name: 'Defer', variant: 'declaration', kind: 64, flags: {} }],
    },
  ],
} as unknown as JSONOutput.ProjectReflection

const since = {
  'meocord/interface:MeoCordConfig.discordToken': { since: '4.0.0' },
  'meocord/interface:MeoCordConfig.sharding': { since: '4.1.0-beta.0' },
  'meocord/interface:ShardingConfig.mode': { since: '4.1.0-beta.0' },
}

describe('configReference', () => {
  const doc = configReference('4.1.0-beta.0', project, since)!

  it('reads each option with its type, default, first version, summary and examples', () => {
    expect(doc.groups[0].options).toEqual([
      { name: 'discordToken', type: 'string', required: true, since: '4.0.0', summary: 'The token.', examples: [] },
      {
        name: 'bundleDependencies',
        type: 'boolean',
        required: false,
        default: '`false`',
        summary: 'Bundles.',
        examples: [],
      },
      {
        name: 'externals',
        type: '(string | RegExp)[]',
        required: false,
        summary: 'With [`bundleDependencies`](#bundledependencies), see [`Defer`](/docs/4.1/api/decorator/Defer).',
        examples: ["```ts\nexternals: ['x']\n```"],
      },
      {
        name: 'sharding',
        type: 'ShardingConfig',
        required: false,
        default: '```ts\nOne | connection\n```',
        since: '4.1.0-beta.0',
        summary: 'Shards.',
        examples: [],
      },
    ])
  })

  it('adds a group for an option typed as an interface of the package', () => {
    expect(doc.groups[1]).toEqual({
      option: 'sharding',
      interface: 'ShardingConfig',
      summary: 'How the bot shards.',
      options: [
        {
          name: 'sharding.mode',
          type: "'internal' | 'process'",
          required: false,
          since: '4.1.0-beta.0',
          summary: '',
          examples: [],
        },
      ],
    })
  })

  it('gives nothing for a version without MeoCordConfig', () => {
    expect(configReference('4.1.0-beta.0', { ...project, children: [] }, since)).toBeUndefined()
  })
})

describe('configReferencePage', () => {
  const page = configReferencePage('4.1', configReference('4.1.0-beta.0', project, since)!)

  it('writes one section per option, nested options below their option', () => {
    expect(page).toMatch(/^---\nid: config-reference\n[\s\S]*source: config@4\.1\.0-beta\.0\n---\n/)
    expect(page.match(/^#+ .+$/gm)).toEqual([
      '## discordToken',
      '## bundleDependencies',
      '## externals',
      '## sharding',
      '### sharding.mode',
    ])
    expect(page).toContain('`sharding` is a [`ShardingConfig`](/docs/4.1/api/interface/ShardingConfig).')
  })

  it('puts type, default and first version in a table, a code-block default as one escaped line', () => {
    expect(page).toContain('| `string` | Required | 4.0.0 |')
    expect(page).toContain('| `(string \\| RegExp)[]` | None | Unknown |')
    expect(page).toContain('| `ShardingConfig` | One \\| connection | 4.1.0-beta.0 |')
  })
})
