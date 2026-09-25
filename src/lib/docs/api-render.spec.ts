import { describe, expect, it } from 'vitest'
import { apiArticle, apiSidebar } from '@/lib/docs/api-render'
import { apiModel } from '@/lib/docs/api-site'

const model = apiModel('4.1')!

describe('apiArticle', () => {
  it('lists the sections and members in the table of contents, at their anchors', () => {
    const { toc } = apiArticle(model.symbol('core', 'ShardContext')!)
    expect(toc.filter(entry => entry.depth === 2).map(entry => entry.id)).toEqual(['examples', 'members'])
    const members = toc.filter(entry => entry.depth === 3)
    expect(members.length).toBeGreaterThan(0)
    expect(members.every(entry => entry.id === entry.title.toLowerCase())).toBe(true)
  })

  it('gives a function its parameters, returns and examples', () => {
    const { toc } = apiArticle(model.symbol('decorator', 'Cooldown')!)
    expect(toc.map(entry => entry.id)).toEqual(['parameters', 'returns', 'examples'])
  })

  it('keeps a section anchor clear of a member with the same name', () => {
    const symbol = { ...model.symbol('core', 'ShardContext')! }
    symbol.members = [{ ...symbol.members[0], name: 'members', anchor: 'members' }]
    const ids = apiArticle(symbol).toc.map(entry => entry.id)
    expect(ids).toContain('members-section')
    expect(ids).toContain('members')
  })
})

describe('apiSidebar', () => {
  it('follows the guides with one group per entry point, marking the current symbol', () => {
    const current = model.href({ entry: 'meocord/decorator', symbol: 'Cooldown' })
    const groups = apiSidebar('4.1', model, current)
    const decorator = groups.find(group => group.title === 'meocord/decorator')!
    expect(decorator.items.find(item => item.current)?.title).toBe('Cooldown')
    expect(groups.findIndex(group => group.title.startsWith('meocord/'))).toBeGreaterThan(0)
  })
})
