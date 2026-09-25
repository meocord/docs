import { describe, expect, it } from 'vitest'
import { apiModel, apiParams, exactApiParams, lineVersions, newestFirst } from '@/lib/docs/api-site'

describe('newestFirst', () => {
  it('orders releases ahead of their prereleases, and prereleases numerically', () => {
    expect(newestFirst(['4.0.0-beta.2', '4.0.0', '4.0.0-beta.10', '4.0.1', '3.9.0'])).toEqual([
      '4.0.1',
      '4.0.0',
      '4.0.0-beta.10',
      '4.0.0-beta.2',
      '3.9.0',
    ])
  })
})

describe('the site API', () => {
  it('builds a line from its newest version, and an exact version on request', () => {
    const newest = lineVersions('4.0')[0]
    expect(newest).toBe('4.0.0')
    expect(apiModel('4.0')).toBeDefined()
    expect(apiModel('4.0', '4.0.0-beta.2')?.href({ entry: 'meocord/core', symbol: 'MeoCordFactory' })).toBe(
      '/docs/4.0/api/4.0.0-beta.2/core/MeoCordFactory',
    )
    expect(apiModel('4.0')).toBe(apiModel('4.0'))
  })

  it('has no API for a version outside the line or not documented', () => {
    expect(apiModel('4.0', '4.1.0-beta.0')).toBeUndefined()
    expect(apiModel('4.0', '4.0.9')).toBeUndefined()
    expect(apiModel('9.9')).toBeUndefined()
  })

  it('lists the pages to prerender for each line and every exact version', () => {
    expect(apiParams()).toContainEqual({ line: '4.1', entry: 'decorator', symbol: 'Cooldown' })
    const exact = exactApiParams()
    expect(exact).toContainEqual({ line: '4.0', version: '4.0.0-beta.2', entry: 'core', symbol: 'MeoCordFactory' })
    expect(new Set(exact.map(param => param.version))).toEqual(
      new Set([...lineVersions('4.0'), ...lineVersions('4.1')]),
    )
  })
})
