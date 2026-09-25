import { describe, expect, it } from 'vitest'
import { flatten, groupHits, jumps, lineOf, type Hit, type PaletteEntry } from '@/lib/search-client'
import type { SearchLine } from '@/lib/search-manifest'

const line = (name: string, status: SearchLine['status']): SearchLine => ({
  line: name,
  status,
  search: `/_pagefind/${name}.0123456789/`,
  palette: `/palette/${name}.0123456789.json`,
  documents: 1,
})
const LINES = [line('4.1', 'prerelease'), line('4.0', 'current'), line('3.9', 'archived')]

describe('lineOf', () => {
  it('reads the line from a docs path, latest as the current line', () => {
    expect(lineOf('/docs/4.1/guards', LINES)?.line).toBe('4.1')
    expect(lineOf('/docs/latest/guards', LINES)?.line).toBe('4.0')
    expect(lineOf('/docs/3.9/x', LINES)?.line).toBe('3.9')
  })

  it('uses the current line anywhere else, and for a line it does not know', () => {
    expect(lineOf('/', LINES)?.line).toBe('4.0')
    expect(lineOf('/docs/9.9/x', LINES)?.line).toBe('4.0')
    expect(lineOf('/', [line('4.1', 'prerelease')])?.line).toBe('4.1')
    expect(lineOf('/', [])).toBeUndefined()
  })
})

const ENTRIES: PaletteEntry[] = [
  { name: 'CooldownOptions', kind: 'interface', url: '/docs/4.1/api/interface/CooldownOptions', entry: 'interface' },
  { name: 'Cooldown', kind: 'function', url: '/docs/4.1/api/decorator/Cooldown', entry: 'decorator' },
  { name: 'Cooldowns', kind: 'guide', url: '/docs/4.1/cooldowns' },
  { name: 'Guard', kind: 'function', url: '/docs/4.1/api/decorator/Guard', entry: 'decorator' },
]

describe('jumps', () => {
  it('offers names that start with the query, the exact one first, then the shortest', () => {
    expect(jumps(ENTRIES, 'cooldown').map(hit => hit.title)).toEqual(['Cooldown', 'Cooldowns', 'CooldownOptions'])
    expect(jumps(ENTRIES, 'cooldown', 1).map(hit => hit.title)).toEqual(['Cooldown'])
  })

  it('describes each jump, and offers nothing for a single character', () => {
    const [symbol] = jumps(ENTRIES, 'guard')
    expect(symbol).toMatchObject({ url: '/docs/4.1/api/decorator/Guard', excerpt: 'function in meocord/decorator' })
    expect(jumps(ENTRIES, 'cooldowns')[0].excerpt).toBe('Guide')
    expect(jumps(ENTRIES, 'c')).toEqual([])
  })
})

const hit = (title: string, kind: string, score: number, url = `/docs/4.1/${title}`): Hit => ({
  url,
  title,
  kind,
  excerpt: '',
  sections: [],
  score,
})

describe('groupHits', () => {
  it('groups ranked results by kind, jumps first, leaving jumps out of their group', () => {
    const jumped = [hit('Cooldown', 'function', 0, '/docs/4.1/api/decorator/Cooldown')]
    const groups = groupHits(
      'cooldown',
      [
        hit('CooldownOptions', 'api', 95),
        hit('Cooldown', 'api', 90, '/docs/4.1/api/decorator/Cooldown'),
        hit('Cooldowns', 'guide', 19),
        hit('4.1 changelog', 'changelog', 5),
      ],
      jumped,
    )
    expect(groups.map(group => [group.kind, group.hits.map(entry => entry.title)])).toEqual([
      ['jump', ['Cooldown']],
      ['guide', ['Cooldowns']],
      ['api', ['CooldownOptions']],
      ['changelog', ['4.1 changelog']],
    ])
    expect(flatten(groups).map(entry => entry.title)).toEqual([
      'Cooldown',
      'Cooldowns',
      'CooldownOptions',
      '4.1 changelog',
    ])
  })

  it('leaves out empty groups', () => {
    expect(groupHits('x', [hit('A', 'guide', 1)]).map(group => group.kind)).toEqual(['guide'])
    expect(groupHits('x', [])).toEqual([])
  })
})
