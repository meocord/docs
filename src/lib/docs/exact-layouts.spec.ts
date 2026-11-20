import { describe, expect, it, vi } from 'vitest'
import { layoutKey, symbolDisplays } from '@/lib/docs/api-layout'
import { exactApiPage } from '@/lib/docs/api-render'
import { apiModel, lineVersions } from '@/lib/docs/api-site'

// The formatted code `bun run api:layout` writes, which unit runs don't have: one entry per display, and one no page shows
const FORMATTED = '<formatted>'
const UNSHOWN = layoutKey('declaration', 'declare const unshown: never')

vi.mock('@/lib/docs/api-site', async original => {
  const site = await original<typeof import('@/lib/docs/api-site')>()
  const { layoutKey, symbolDisplays } = await import('@/lib/docs/api-layout')
  return {
    ...site,
    apiLayouts: (line: string, version?: string) => {
      const model = site.apiModel(line, version)
      const keys = (model?.params() ?? []).flatMap(({ section, symbol }) =>
        symbolDisplays(model!.symbol(section, symbol)!).map(([form, text]) => layoutKey(form, text)),
      )
      return Object.fromEntries([...keys, UNSHOWN].map(key => [key, FORMATTED]))
    },
  }
})

describe('an exact version’s API page', () => {
  it('carries the formatted code of its own displays, and none other', () => {
    const line = '4.1'
    const version = lineVersions(line).at(-1)!
    const model = apiModel(line, version)!
    const { section } = model.params().find(param => param.symbol === 'MeoCordFactory')!
    const symbol = model.symbol(section, 'MeoCordFactory')!
    const page = exactApiPage(line, version, section, 'MeoCordFactory')!
    const shown = symbolDisplays(symbol).map(([form, text]) => layoutKey(form, text))
    expect(shown.length).toBeGreaterThan(0)
    expect(Object.keys(page.layouts).sort()).toEqual([...new Set(shown)].sort())
    expect(Object.values(page.layouts).every(code => code === FORMATTED)).toBe(true)
  })
})
