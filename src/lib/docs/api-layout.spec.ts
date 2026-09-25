import { describe, expect, it } from 'vitest'
import { decoratorSummary, highlightSource, unwrap, wrap, wrapper } from '@/lib/docs/api-layout'

describe('wrapper', () => {
  it('writes each display as the TypeScript it reads as', () => {
    expect(wrapper('returns', 'string').before).toBe('type T = ')
    expect(wrapper('param', 'string').before).toBe('type T = ')
    expect(wrapper('member', 'x: string')).toEqual({ before: 'declare class C {\n', after: '\n}', indent: '  ' })
    expect(wrapper('declaration', 'Command(name: string): void').before).toBe('declare function ')
    expect(wrapper('declaration', 'const DEFAULTS: Options').before).toBe('declare ')
    expect(wrapper('declaration', 'type Handler = () => void')).toEqual({ before: '', after: '', indent: '' })
    expect(wrapper('declaration', 'abstract class Store<T>').after).toBe(' {}')
    expect(wrapper('declaration', 'interface Options').after).toBe(' {}')
  })
})

describe('wrap', () => {
  it('maps each display character to its place in the source', () => {
    const { source, start } = wrap('member', 'get(\n  key: string,\n): T')
    expect(source).toBe('declare class C {\n  get(\n    key: string,\n  ): T\n}')
    const display = 'get(\n  key: string,\n): T'
    expect([...display].every((char, index) => source[start[index]] === char)).toBe(true)
  })
})

describe('unwrap', () => {
  it('takes the wrapper off a formatted source', () => {
    expect(unwrap('returns', 'A | B', 'type T = A<\n  B\n>\n')).toBe('A<\n  B\n>')
    expect(unwrap('returns', 'A | B', 'type T =\n  | A\n  | B\n')).toBe('| A\n| B')
    expect(unwrap('member', 'x', 'declare class C {\n  get(\n    key: string,\n  ): T\n}\n')).toBe(
      'get(\n  key: string,\n): T',
    )
  })

  it('refuses a result whose wrapper the formatter changed', () => {
    expect(unwrap('returns', 'A', 'type U = A')).toBeUndefined()
    expect(unwrap('member', 'x', 'declare class C {\nx\n}')).toBeUndefined()
  })
})

describe('decoratorSummary', () => {
  it('names what the decorator applies to', () => {
    expect(decoratorSummary('method')).toBe('Returns a method decorator.')
    expect(decoratorSummary('parameter')).toBe('Returns a parameter decorator.')
    expect(decoratorSummary('class or method')).toBe('Returns a decorator for a class or a method.')
  })
})

describe('highlightSource', () => {
  it("reads a constructor's new as a keyword a class body holds, keeping every offset", () => {
    const display = 'new Store(\n  size: number,\n)'
    const { source, start } = highlightSource('member', display)
    expect(source).toBe('declare class C {\n  get Store(\n    size: number,\n  )\n}')
    expect(start).toEqual(wrap('member', display).start)
    expect(highlightSource('member', 'size: number').source).toBe(wrap('member', 'size: number').source)
  })
})
