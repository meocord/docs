import { describe, expect, it } from 'vitest'
import { API_KINDS } from '@/lib/docs/api-model'
import {
  apiArrangement,
  apiKindParams,
  apiLandingHref,
  apiLayouts,
  apiModel,
  apiParams,
  exactApiParams,
  lineVersions,
  newestFirst,
  resolveSiteHref,
} from '@/lib/docs/api-site'

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
    const versions = lineVersions('4.0')
    const newest = versions[0]
    expect(versions).toEqual(newestFirst(versions))
    expect(newest).toMatch(/^4\.0\.\d+$/)
    expect(apiModel('4.0')).toBeDefined()
    expect(apiModel('4.0', '4.0.0-beta.2')?.href({ section: 'core', symbol: 'MeoCordFactory' })).toBe(
      '/docs/4.0/api/4.0.0-beta.2/core/MeoCordFactory',
    )
    expect(apiModel('4.0')).toBe(apiModel('4.0'))
  })

  it('opens a line by entry point where every app starts, MeoCordFactory, and has none for an unknown line', () => {
    expect(apiLandingHref('4.0')).toBe('/docs/latest/api/core/MeoCordFactory')
    expect(apiLandingHref('9.9')).toBeUndefined()
  })

  it('has no API for a version outside the line or not documented', () => {
    expect(apiModel('4.0', '4.1.0-beta.0')).toBeUndefined()
    expect(apiModel('4.0', '4.0.9')).toBeUndefined()
    expect(apiModel('9.9')).toBeUndefined()
  })

  it('lists the pages to prerender for each line and every exact version', () => {
    expect(apiParams()).toContainEqual({ line: '4.1', section: 'decorators', symbol: 'Cooldown' })
    const exact = exactApiParams()
    expect(exact).toContainEqual({ line: '4.0', version: '4.0.0-beta.2', section: 'core', symbol: 'MeoCordFactory' })
    expect(new Set(exact.map(param => param.version))).toEqual(
      new Set([...lineVersions('4.0'), ...lineVersions('4.1')]),
    )
  })
})

describe('apiLayouts', () => {
  it('fails a production build for a version whose code was not formatted, and lets dev show it on one line', () => {
    expect(() => apiLayouts('4.1', '4.1.9-missing', true)).toThrow('run `bun run api:layout`')
    expect(apiLayouts('4.1', '4.1.9-absent', false)).toEqual({})
  })
})

describe('the site API by kind', () => {
  it('arranges a line with a Guide by kind, and opens it on its index; 4.0 stays by entry point', () => {
    expect(apiArrangement('4.1')).toBe('kind')
    expect(apiArrangement('4.0')).toBe('entry')
    expect(apiLandingHref('4.1')).toBe('/docs/4.1/api')
    expect(apiLandingHref('4.0')).toBe('/docs/latest/api/core/MeoCordFactory')
  })

  it('files every symbol of every 4.1 release under a kind, older releases by the newest one', () => {
    const slugs = new Set<string>(API_KINDS.map(kind => kind.slug))
    const exact = exactApiParams().filter(param => param.line === '4.1')
    expect(new Set(exact.map(param => param.version))).toEqual(new Set(lineVersions('4.1')))
    expect(exact.every(param => slugs.has(param.section))).toBe(true)
    expect(apiKindParams()).toContainEqual({ line: '4.1', section: 'decorators' })
    expect(apiKindParams().some(param => param.line === '4.0')).toBe(false)
  })

  it('sends a stored link by entry point to the page by kind, a member and an exact version included', () => {
    expect(resolveSiteHref('/docs/4.1/api/decorator/Cooldown#options')).toBe(
      '/docs/4.1/api/decorators/Cooldown#options',
    )
    expect(resolveSiteHref('/docs/4.1/api/4.1.0-beta.0/decorator/Cooldown')).toBe(
      '/docs/4.1/api/4.1.0-beta.0/decorators/Cooldown',
    )
    // A line by entry point, and a link that is not to the API, resolve as stored links do
    expect(resolveSiteHref('/docs/4.0/api/core/MeoCordFactory')).toBe('/docs/latest/api/core/MeoCordFactory')
    expect(resolveSiteHref('/docs/4.1/guards#testing')).toBe('/docs/4.1/guards#testing')
  })
})
