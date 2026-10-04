import { describe, expect, it } from 'vitest'
import type { JSONOutput } from 'typedoc'
import { apiKeys, computeSince, releasesOf, shownSince } from './since.js'

const project = (modules: Record<string, JSONOutput.DeclarationReflection[]>) =>
  ({
    children: Object.entries(modules).map(([name, children]) => ({ name, children })),
  }) as unknown as JSONOutput.ProjectReflection

const fn = (name: string, ...params: string[]) =>
  ({
    name,
    signatures: [{ name, parameters: params.map(param => ({ name: param })) }],
  }) as unknown as JSONOutput.DeclarationReflection

describe('apiKeys', () => {
  it('names symbols, members and parameters by entry point', () => {
    const keys = apiKeys(
      project({
        'meocord/core': [
          { name: 'ShardContext', children: [fn('call', 'service', 'method')] } as JSONOutput.DeclarationReflection,
          fn('respond', 'interaction'),
        ],
      }),
    )

    expect([...keys].sort()).toEqual([
      'meocord/core:ShardContext',
      'meocord/core:ShardContext.call',
      'meocord/core:ShardContext.call(method)',
      'meocord/core:ShardContext.call(service)',
      'meocord/core:respond',
      'meocord/core:respond(interaction)',
    ])
  })
})

describe('computeSince', () => {
  it('records the first version with a key, and the version it went away in', () => {
    const since = computeSince({
      '4.1.0-beta.0': new Set(['a', 'b']),
      '4.0.0': new Set(['a', 'c']),
      '4.0.0-beta.0': new Set(['c']),
    })

    expect(since).toEqual({
      a: { since: '4.0.0' },
      b: { since: '4.1.0-beta.0' },
      c: { since: '4.0.0-beta.0', removed: '4.1.0-beta.0' },
    })
  })

  it('forgets a removal once the key comes back', () => {
    expect(computeSince({ '1.0.0': new Set(['a']), '1.1.0': new Set(), '1.2.0': new Set(['a']) })).toEqual({
      a: { since: '1.0.0' },
    })
  })
})

describe('shownSince', () => {
  const releases = releasesOf({
    lines: [
      { versions: ['4.1.0-beta.0', '4.1.0-beta.5', '4.1.0'] },
      { versions: ['4.0.0-beta.0', '4.0.0', '4.0.1'] },
      { versions: ['4.2.0-beta.0'] },
    ],
  })

  it('lists the documented releases, leaving prereleases out', () => {
    expect([...releases].sort()).toEqual(['4.0.0', '4.0.1', '4.1.0'])
  })

  it('reads a prerelease as its release once that release is documented', () => {
    expect(shownSince('4.1.0-beta.5', releases)).toBe('4.1.0')
    expect(shownSince('4.0.0-beta.0', releases, '4.1.0')).toBe('4.0.0')
    expect(shownSince('4.0.0-beta.0', releases, '4.0.1')).toBe('4.0.0')
  })

  it('keeps a release, and a prerelease whose release is not documented yet', () => {
    expect(shownSince('4.0.1', releases)).toBe('4.0.1')
    expect(shownSince('4.2.0-beta.0', releases)).toBe('4.2.0-beta.0')
  })

  it('keeps the prerelease on a page of a version older than its release', () => {
    expect(shownSince('4.1.0-beta.0', releases, '4.1.0-beta.6')).toBe('4.1.0-beta.0')
    expect(shownSince('4.1.0-beta.0', releases, '4.1.0')).toBe('4.1.0')
  })
})
