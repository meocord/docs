import { describe, expect, it } from 'vitest'
import type { JSONOutput } from 'typedoc'
import { ApiModel, type Token } from '@/lib/docs/api-model'
import { apiArticle } from '@/lib/docs/api-render'

const versions = { lines: [{ line: '4.1', status: 'current' as const }] }
const text = (tokens: Token[]) => tokens.map(token => token.text).join('')
const str = (value: string) => ({ type: 'intrinsic', name: value })
const parts = (value: string) => [{ kind: 'text', text: value }]

let id = 100
const decl = (fields: Record<string, unknown>) => ({ id: id++, variant: 'declaration', flags: {}, ...fields })
const sig = (fields: Record<string, unknown>) => ({ id: id++, variant: 'signature', kind: 4096, flags: {}, ...fields })

const target = decl({ name: 'Target', kind: 256 })
/** Every declaration shape the reference renders, in one small project. */
const project = {
  id: 0,
  name: 'meocord',
  variant: 'project',
  kind: 1,
  flags: {},
  children: [
    decl({
      name: 'meocord/core',
      kind: 2,
      children: [
        target,
        decl({
          name: 'Old',
          kind: 64,
          signatures: [
            sig({
              name: 'Old',
              comment: {
                summary: [...parts('Use '), { kind: 'inline-tag', tag: '@link', text: 'Target', target: target.id }],
                blockTags: [
                  { tag: '@deprecated', content: parts('Use Target.') },
                  { tag: '@throws', content: parts('When it fails.') },
                  { tag: '@returns', content: parts('Nothing useful.') },
                ],
              },
              parameters: [
                {
                  id: id++,
                  name: 'a',
                  variant: 'param',
                  kind: 32768,
                  flags: {},
                  type: str('string'),
                  defaultValue: "'x'",
                },
                {
                  id: id++,
                  name: 'rest',
                  variant: 'param',
                  kind: 32768,
                  flags: { isRest: true },
                  type: { type: 'array', elementType: str('number') },
                },
              ],
              type: { type: 'reference', name: 'Target', target: target.id },
            }),
            sig({ name: 'Old', type: str('void') }),
          ],
        }),
        decl({
          name: 'Store',
          kind: 128,
          flags: { isAbstract: true },
          typeParameters: [
            {
              id: id++,
              name: 'T',
              variant: 'typeParam',
              kind: 131072,
              flags: {},
              type: str('object'),
              default: str('object'),
            },
          ],
          extendedTypes: [{ type: 'reference', name: 'Base' }],
          implementedTypes: [{ type: 'reference', name: 'Target', target: target.id }],
          comment: {
            summary: parts('A store.'),
            blockTags: [
              { tag: '@see', content: [{ kind: 'inline-tag', tag: '@link', text: 'Target', target: target.id }] },
              { tag: '@example', content: [{ kind: 'code', text: '```ts\nnew Store()\n```' }] },
            ],
          },
          children: [
            decl({
              name: 'size',
              kind: 1024,
              flags: { isStatic: true, isReadonly: true },
              type: str('number'),
              comment: { summary: [], blockTags: [{ tag: '@defaultValue', content: [{ kind: 'code', text: '`0`' }] }] },
            }),
            decl({
              name: 'value',
              kind: 262144,
              getSignature: sig({ name: 'value', kind: 524288, type: str('string') }),
              setSignature: sig({
                name: 'value',
                kind: 1048576,
                parameters: [{ id: id++, name: 'next', variant: 'param', kind: 32768, flags: {}, type: str('string') }],
                type: str('void'),
              }),
            }),
            decl({
              name: 'gone',
              kind: 2048,
              flags: {},
              comment: { summary: [], blockTags: [{ tag: '@deprecated', content: [] }] },
              signatures: [
                sig({
                  name: 'gone',
                  type: str('void'),
                  comment: { summary: [], blockTags: [{ tag: '@example', content: parts('gone()') }] },
                }),
              ],
            }),
            decl({ name: 'inherited', kind: 2048, flags: { isInherited: true }, signatures: [] }),
          ],
        }),
        decl({
          name: 'Mode',
          kind: 8,
          children: [decl({ name: 'On', kind: 16, type: { type: 'literal', value: 'on' } })],
        }),
        decl({
          name: 'Alias',
          kind: 2097152,
          typeParameters: [{ id: id++, name: 'K', variant: 'typeParam', kind: 131072, flags: {} }],
          type: {
            type: 'reflection',
            declaration: decl({
              name: '__type',
              kind: 65536,
              signatures: [
                sig({
                  name: '__call',
                  parameters: [
                    { id: id++, name: 'x', variant: 'param', kind: 32768, flags: { isOptional: true }, type: str('K') },
                  ],
                  type: str('void'),
                }),
              ],
            }),
          },
        }),
        decl({
          name: 'VALUE',
          kind: 32,
          type: {
            type: 'reflection',
            declaration: decl({
              name: '__type',
              kind: 65536,
              children: [
                decl({ name: 'a', kind: 1024, flags: { isOptional: true, isReadonly: true }, type: str('string') }),
              ],
            }),
          },
        }),
        decl({ name: 'Namespaced', kind: 4 }),
      ],
    }),
  ],
} as unknown as JSONOutput.ProjectReflection

const model = new ApiModel('4.1', project, versions, {
  'meocord/core:Store.size': { since: '4.1.1' },
  'meocord/core:Store': { since: '4.1.0' },
})

describe('ApiModel, on every declaration shape', () => {
  it('writes deprecation, overloads, defaults, rest parameters, throws and returns', () => {
    const old = model.symbol('core', 'Old')!
    expect(old.deprecated).toBe('Use Target.')
    expect(old.description).toBe('Use [`Target`](/docs/latest/api/core/Target)')
    expect(old.code.map(text)).toEqual(['Old(a?: string, ...rest: number[]): Target', 'Old(): void'])
    const [first, second] = old.signatures
    expect(first.params.map(param => [param.name, param.optional, param.defaultValue])).toEqual([
      ['a', true, "'x'"],
      ['...rest', false, undefined],
    ])
    expect(first.throws).toEqual(['When it fails.'])
    expect(first.returns?.description).toBe('Nothing useful.')
    expect(second.returns).toBeUndefined()
  })

  it('writes a class with type parameters, heritage, see-also and each kind of member', () => {
    const store = model.symbol('core', 'Store')!
    expect(text(store.code[0])).toBe('abstract class Store<T extends object = object> extends Base implements Target')
    expect(store.seeAlso).toEqual([{ text: 'Target', href: '/docs/latest/api/core/Target' }])
    expect(store.examples).toEqual(['```ts\nnew Store()\n```'])
    const [size, value, gone] = store.members
    expect(store.members.map(member => member.name)).toEqual(['size', 'value', 'gone'])
    expect(text(size.code[0])).toBe('static readonly size: number')
    expect(size).toMatchObject({ defaultValue: '0', since: '4.1.1' })
    expect(value.code.map(text)).toEqual(['get value(): string', 'set value(next: string)'])
    expect(gone.deprecated).toBe('Deprecated.')
    expect(gone.signatures[0].examples).toEqual(['gone()'])
  })

  it('writes enums, type aliases, variables and anything else by name', () => {
    expect(text(model.symbol('core', 'Mode')!.code[0])).toBe('enum Mode')
    expect(text(model.symbol('core', 'Mode')!.members[0].code[0])).toBe("On = 'on'")
    expect(text(model.symbol('core', 'Alias')!.code[0])).toBe('type Alias<K> = (x?: K) => void')
    expect(text(model.symbol('core', 'VALUE')!.code[0])).toBe('const VALUE: { readonly a?: string }')
    expect(text(model.symbol('core', 'Namespaced')!.code[0])).toBe('Namespaced')
    expect(model.entries()[0].symbols.find(symbol => symbol.name === 'Old')?.deprecated).toBe(true)
  })

  it('renders each of them into an article with its sections', () => {
    const old = apiArticle(model.symbol('core', 'Old')!)
    expect(old.toc.map(entry => entry.id)).toEqual(['parameters', 'returns', 'throws'])
    const store = apiArticle(model.symbol('core', 'Store')!)
    expect(store.toc.map(entry => entry.id)).toEqual(['examples', 'members', 'size', 'value', 'gone', 'see-also'])
    expect(apiArticle(model.symbol('core', 'Mode')!).toc.map(entry => entry.id)).toEqual(['members', 'on'])
  })
})

describe('ApiModel, on what a function returns', () => {
  const param = (name: string, type: unknown) => ({ id: id++, name, variant: 'param', kind: 32768, flags: {}, type })
  const returning = (name: string, type: unknown) => decl({ name, kind: 64, signatures: [sig({ name, type })] })
  const decorator = (...params: unknown[]) => ({
    type: 'reflection',
    declaration: decl({
      name: '__type',
      kind: 65536,
      signatures: [sig({ name: '__type', parameters: params, type: str('void') })],
    }),
  })
  const ref = (name: string, target?: number) => ({ type: 'reference', name, ...(target ? { target } : {}) })
  const alias = decl({
    name: 'Both',
    kind: 2097152,
    type: { type: 'intersection', types: [ref('ClassDecorator'), ref('MethodDecorator')] },
  })
  const factories = {
    id: 0,
    name: 'meocord',
    variant: 'project',
    kind: 1,
    flags: {},
    children: [
      decl({
        name: 'meocord/decorator',
        kind: 2,
        children: [
          alias,
          returning('OnClass', decorator(param('target', str('any')))),
          returning('OnProperty', decorator(param('target', str('object')), param('propertyKey', str('string')))),
          returning(
            'OnMethod',
            decorator(param('target', str('object')), param('key', str('string')), param('d', str('any'))),
          ),
          returning(
            'OnParameter',
            decorator(param('target', str('object')), param('key', str('string')), param('index', str('number'))),
          ),
          returning('Named', ref('PropertyDecorator')),
          returning('Aliased', ref('Both', alias.id)),
          returning('Mixed', { type: 'intersection', types: [ref('ClassDecorator'), ref('PropertyDecorator')] }),
          returning('Callback', decorator(param('value', str('string')))),
          returning('Plain', str('string')),
        ],
      }),
    ],
  } as unknown as JSONOutput.ProjectReflection
  const decorators = new ApiModel('4.1', factories, versions)
  const decorates = (name: string) => decorators.symbol('decorator', name)!.signatures[0].returns?.decorates

  it('names the target of a decorator it returns, by its type or its parameters', () => {
    expect(decorates('OnClass')).toBe('class')
    expect(decorates('OnProperty')).toBe('property')
    expect(decorates('OnMethod')).toBe('method')
    expect(decorates('OnParameter')).toBe('parameter')
    expect(decorates('Named')).toBe('property')
    expect(decorates('Aliased')).toBe('class or method')
  })

  it('names nothing for a function that returns something else', () => {
    expect(decorates('Mixed')).toBeUndefined()
    expect(decorates('Callback')).toBeUndefined()
    expect(decorates('Plain')).toBeUndefined()
  })
})

describe('ApiModel, on an interface that can be called', () => {
  const param = (name: string, type: unknown) => ({ id: id++, name, variant: 'param', kind: 32768, flags: {}, type })
  const callable = decl({
    name: 'Handler',
    kind: 256,
    extendedTypes: [{ type: 'reference', name: 'Base' }],
    signatures: [
      sig({ name: 'Handler', parameters: [param('value', str('string'))], type: str('void') }),
      sig({
        name: 'Handler',
        typeParameters: [{ id: id++, name: 'T', variant: 'typeParam', kind: 131072, flags: {} }],
        parameters: [param('value', { type: 'reference', name: 'T' }), param('count', str('number'))],
        type: { type: 'reference', name: 'T' },
      }),
    ],
  })
  const project = {
    id: 0,
    name: 'meocord',
    variant: 'project',
    kind: 1,
    flags: {},
    children: [decl({ name: 'meocord/core', kind: 2, children: [callable] })],
  } as unknown as JSONOutput.ProjectReflection

  it('writes each call signature in its body, after its heritage', () => {
    const handler = new ApiModel('4.1', project, versions).symbol('core', 'Handler')!
    expect(handler.code.map(text)).toEqual([
      'interface Handler extends Base {\n  (value: string): void\n  <T>(value: T, count: number): T\n}',
    ])
    expect(handler.signatures).toHaveLength(2)
  })
})
