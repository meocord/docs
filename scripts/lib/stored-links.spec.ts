import { describe, expect, it } from 'vitest'
import { parseStored, storedHref } from './stored-links.js'

const lines = ['4.0', '4.1']

describe('storedHref', () => {
  it('names the line, whatever its status', () => {
    expect(storedHref({ kind: 'guide', line: '4.0', slug: 'guards', anchor: 'params' })).toBe('/docs/4.0/guards#params')
    expect(storedHref({ kind: 'changelog', line: '4.1', version: '4.1.0-beta.0' })).toBe(
      '/docs/4.1/changelog#v4.1.0-beta.0',
    )
  })
})

describe('parseStored', () => {
  it('reads every kind of stored link', () => {
    expect(parseStored('/docs/4.0', lines)).toEqual({ target: { kind: 'line', line: '4.0' } })
    expect(parseStored('/docs/4.1/guards#params', lines)).toEqual({
      target: { kind: 'guide', line: '4.1', slug: 'guards', anchor: 'params' },
    })
    expect(parseStored('/docs/4.1/api/decorator/Defer', lines)).toMatchObject({
      target: { kind: 'api', entry: 'decorator', symbol: 'Defer' },
    })
    expect(parseStored('/docs/4.1/api/4.1.0-beta.0/core/ShardContext#call', lines)).toMatchObject({
      target: { kind: 'api', version: '4.1.0-beta.0', member: 'call' },
    })
    expect(parseStored('/docs/4.1/changelog#v4.1.0-beta.0', lines)).toMatchObject({
      target: { kind: 'changelog', version: '4.1.0-beta.0' },
    })
    expect(parseStored('/docs/4.0/migrating#start', lines)).toMatchObject({
      target: { kind: 'migrating', anchor: 'start' },
    })
    expect(parseStored('/docs/4.0/missing/defer', lines)).toMatchObject({ target: { kind: 'missing', id: 'defer' } })
  })

  it('says why a link is not a stored one', () => {
    expect(parseStored('/elsewhere', lines)).toEqual({ problem: 'is not a docs link' })
    expect(parseStored('/docs/4.1/api/core', lines)).toMatchObject({
      problem: expect.stringContaining('is not a valid link'),
    })
    expect(parseStored('/docs/4.1/a/b', lines)).toEqual({ problem: 'names no page' })
    expect(parseStored('/docs/4.1/Guards', lines)).toMatchObject({
      problem: expect.stringContaining('is not a valid page slug'),
    })
  })
})
