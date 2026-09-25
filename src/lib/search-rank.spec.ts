import { describe, expect, it } from 'vitest'
import { API_WEIGHT, rankResults } from '@/lib/search-rank'

const result = (title: string, kind: string, score: number) => ({ title, kind, score })

describe('rankResults', () => {
  it('ranks a guide above API symbols that only start with the query', () => {
    const results = [
      result('CooldownOptions', 'api', 95),
      result('CooldownError', 'api', 94),
      result('Cooldowns', 'guide', 19),
    ]
    expect(rankResults('cooldown', results).map(entry => entry.title)).toEqual([
      'Cooldowns',
      'CooldownOptions',
      'CooldownError',
    ])
  })

  it('ranks the API symbol a query names exactly at its full score, whatever its case', () => {
    const results = [result('Invoking handlers', 'guide', 5), result('createMockInteraction', 'api', 19)]
    expect(rankResults('createmockinteraction', results)[0].title).toBe('createMockInteraction')
    expect(rankResults('create-mock-interaction', results)[0].title).toBe('createMockInteraction')
  })

  it('keeps guides and changelogs at their score, and ties in their order', () => {
    const results = [result('A', 'changelog', 3), result('B', 'guide', 3), result('C', 'api', 3 / API_WEIGHT)]
    expect(rankResults('x', results).map(entry => entry.title)).toEqual(['A', 'B', 'C'])
  })

  it('returns a new array and keeps each result as it was', () => {
    const results = [result('a', 'api', 1), result('b', 'guide', 1)]
    const ranked = rankResults('q', results)
    expect(ranked).not.toBe(results)
    expect(ranked[1]).toBe(results[0])
  })
})
