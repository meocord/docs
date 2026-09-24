import { describe, expect, it } from 'vitest'
import type { JSONOutput } from 'typedoc'
import { apiKeys, computeSince } from './since.js'

const project = (modules: Record<string, JSONOutput.DeclarationReflection[]>) =>
  ({ children: Object.entries(modules).map(([name, children]) => ({ name, children })) }) as unknown as JSONOutput.ProjectReflection

const fn = (name: string, ...params: string[]) => ({ name, signatures: [{ name, parameters: params.map(param => ({ name: param })) }] }) as unknown as JSONOutput.DeclarationReflection

describe('apiKeys', () => {
  it('names symbols, members and parameters by entry point', () => {
    const keys = apiKeys(project({ 'meocord/core': [{ name: 'ShardContext', children: [fn('call', 'service', 'method')] } as JSONOutput.DeclarationReflection, fn('respond', 'interaction')] }))

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

    expect(since).toEqual({ a: { since: '4.0.0' }, b: { since: '4.1.0-beta.0' }, c: { since: '4.0.0-beta.0', removed: '4.1.0-beta.0' } })
  })

  it('forgets a removal once the key comes back', () => {
    expect(computeSince({ '1.0.0': new Set(['a']), '1.1.0': new Set(), '1.2.0': new Set(['a']) })).toEqual({ a: { since: '1.0.0' } })
  })
})
