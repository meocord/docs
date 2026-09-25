import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { JSONOutput } from 'typedoc'
import { ApiModel, kindName, type Token } from '@/lib/docs/api-model'
import type { VersionsManifest } from '@/lib/urls'

// A published version's API never changes, so the tests read the real one.
const project = (
  JSON.parse(readFileSync('generated/api/4.1.0-beta.0.json', 'utf8')) as { project: JSONOutput.ProjectReflection }
).project
const since = JSON.parse(readFileSync('generated/since.json', 'utf8'))
const versions: VersionsManifest = {
  lines: [
    { line: '4.1', status: 'prerelease' },
    { line: '4.0', status: 'current' },
  ],
}
const model = new ApiModel('4.1', project, versions, since)
const text = (tokens: Token[]) => tokens.map(token => token.text).join('')

describe('ApiModel', () => {
  it('lists every symbol by entry point with its page', () => {
    const entries = model.entries()
    expect(entries.map(group => group.entry)).toContain('meocord/decorator')
    const cooldown = entries.flatMap(group => group.symbols).find(symbol => symbol.name === 'Cooldown')
    expect(cooldown).toEqual({
      name: 'Cooldown',
      kind: 'function',
      href: '/docs/4.1/api/decorator/Cooldown',
      deprecated: false,
    })
    expect(model.params()).toContainEqual({ entry: 'decorator', symbol: 'Cooldown' })
  })

  it('describes a function: signature with linked types, params with their properties, returns and examples', () => {
    const cooldown = model.symbol('decorator', 'Cooldown')!
    expect(cooldown).toMatchObject({
      name: 'Cooldown',
      kind: 'function',
      entry: 'meocord/decorator',
      since: '4.1.0-beta.0',
    })
    expect(text(cooldown.code[0])).toBe('Cooldown(options: CooldownOptions): ClassDecorator & MethodDecorator')
    expect(cooldown.code[0].find(token => token.text === 'CooldownOptions')?.href).toBe(
      '/docs/4.1/api/interface/CooldownOptions',
    )
    const [signature] = cooldown.signatures
    expect(signature.params.map(param => param.name)).toEqual([
      'options',
      'options.seconds',
      'options.uses',
      'options.per',
      'options.bypass',
    ])
    expect(signature.params[2].description).toBe('Calls allowed within the window. Defaults to `1`.')
    expect(text(signature.returns!.type)).toBe('ClassDecorator & MethodDecorator')
    expect(signature.examples[0]).toMatch(/^```ts\n@Command\('daily'/)
    expect(cooldown.description).toMatch(/^Limits how often a handler runs/)
  })

  it('describes a class with its own members at their anchors', () => {
    const shards = model.symbol('meocord/core', 'ShardContext')!
    expect(shards.kind).toBe('class')
    expect(text(shards.code[0])).toMatch(/^class ShardContext/)
    const constructor = shards.members.find(member => member.name === 'constructor')!
    expect(constructor.anchor).toBe('constructor')
    expect(text(constructor.code[0])).toMatch(/^new ShardContext\(/)
    expect(shards.members.every(member => member.anchor === member.name.toLowerCase())).toBe(true)
  })

  it('links an exact version to its own pages', () => {
    const exact = new ApiModel('4.1', project, versions, since, '4.1.0-beta.0')
    expect(exact.href({ entry: 'meocord/decorator', symbol: 'Cooldown' })).toBe(
      '/docs/4.1/api/4.1.0-beta.0/decorator/Cooldown',
    )
    expect(exact.symbol('decorator', 'Cooldown')!.code[0].find(token => token.href)?.href).toBe(
      '/docs/4.1/api/4.1.0-beta.0/interface/CooldownOptions',
    )
  })

  it('finds nothing for an unknown symbol or entry', () => {
    expect(model.symbol('decorator', 'Nope')).toBeUndefined()
    expect(model.symbol('nope', 'Cooldown')).toBeUndefined()
  })

  it('writes every kind of type TypeDoc emits, and links only documented symbols', () => {
    const type = (value: unknown) => text(model.type(value as JSONOutput.SomeType))
    expect(
      type({
        type: 'union',
        types: [
          { type: 'literal', value: 'a' },
          { type: 'literal', value: null },
        ],
      }),
    ).toBe("'a' | null")
    expect(
      type({
        type: 'array',
        elementType: {
          type: 'union',
          types: [
            { type: 'intrinsic', name: 'string' },
            { type: 'intrinsic', name: 'number' },
          ],
        },
      }),
    ).toBe('(string | number)[]')
    expect(
      type({
        type: 'tuple',
        elements: [
          { type: 'namedTupleMember', name: 'a', isOptional: true, element: { type: 'intrinsic', name: 'string' } },
        ],
      }),
    ).toBe('[a?: string]')
    expect(type({ type: 'typeOperator', operator: 'keyof', target: { type: 'intrinsic', name: 'object' } })).toBe(
      'keyof object',
    )
    expect(
      type({
        type: 'indexedAccess',
        objectType: { type: 'reference', name: 'T' },
        indexType: { type: 'literal', value: 'k' },
      }),
    ).toBe("T['k']")
    expect(
      type({
        type: 'conditional',
        checkType: { type: 'reference', name: 'T' },
        extendsType: { type: 'intrinsic', name: 'string' },
        trueType: { type: 'literal', value: 1 },
        falseType: { type: 'literal', value: 2 },
      }),
    ).toBe('T extends string ? 1 : 2')
    expect(
      type({
        type: 'mapped',
        parameter: 'K',
        parameterType: { type: 'reference', name: 'Keys' },
        templateType: { type: 'intrinsic', name: 'boolean' },
        optionalModifier: '+',
        readonlyModifier: '+',
      }),
    ).toBe('{ readonly [K in Keys]?: boolean }')
    expect(type({ type: 'templateLiteral', head: 'on', tail: [[{ type: 'reference', name: 'E' }, '!']] })).toBe(
      '`on${E}!`',
    )
    expect(
      type({ type: 'predicate', name: 'x', asserts: false, targetType: { type: 'intrinsic', name: 'string' } }),
    ).toBe('x is string')
    expect(type({ type: 'query', queryType: { type: 'reference', name: 'foo' } })).toBe('typeof foo')
    expect(type({ type: 'inferred', name: 'U' })).toBe('infer U')
    expect(type({ type: 'rest', elementType: { type: 'intrinsic', name: 'string' } })).toBe('...string')
    expect(type({ type: 'optional', elementType: { type: 'intrinsic', name: 'string' } })).toBe('string?')
    expect(type({ type: 'literal', value: { negative: true, value: '5' } })).toBe('-5n')
    expect(type({ type: 'unknown', name: 'Weird<T>' })).toBe('Weird<T>')
    expect(
      type({
        type: 'reference',
        name: 'Map',
        target: { packageName: 'typescript', qualifiedName: 'Map' },
        typeArguments: [{ type: 'intrinsic', name: 'string' }],
      }),
    ).toBe('Map<string>')
    expect(model.type({ type: 'reference', name: 'Map', target: -1 } as JSONOutput.SomeType)[0].href).toBeUndefined()
    expect(
      type({
        type: 'reflection',
        declaration: { id: 0, name: '__type', variant: 'declaration', kind: 65536, flags: {}, children: [] },
      }),
    ).toBe('{}')
  })

  it('names reflection kinds', () => {
    expect([64, 128, 256, 2097152, 32, 8, 1024, 99].map(kindName)).toEqual([
      'function',
      'class',
      'interface',
      'type-alias',
      'variable',
      'enum',
      'property',
      'declaration',
    ])
  })
})
