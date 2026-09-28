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
  it('lists every symbol by entry point with its page and summary', () => {
    const sections = model.sections()
    expect(sections.map(section => section.title)).toContain('meocord/decorator')
    const cooldown = sections.flatMap(section => section.symbols).find(symbol => symbol.name === 'Cooldown')
    expect(cooldown).toMatchObject({
      name: 'Cooldown',
      kind: 'function',
      href: '/docs/4.1/api/decorator/Cooldown',
      deprecated: false,
    })
    expect(cooldown!.summary).not.toMatch(/\n\n/)
    expect(model.params()).toContainEqual({ section: 'decorator', symbol: 'Cooldown' })
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
    // CooldownOptions' members, each once, in the interface's order, with its type
    expect(signature.params.map(param => param.name)).toEqual([
      'options',
      'options.bypass',
      'options.per',
      'options.seconds',
      'options.uses',
    ])
    const uses = signature.params.find(param => param.name === 'options.uses')!
    expect(uses.description).toBe('Calls allowed within the window. Defaults to `1`.')
    expect(text(uses.type)).toBe('number')
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
    expect(exact.href({ section: 'decorator', symbol: 'Cooldown' })).toBe(
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

  it('shows how an interface that can be called is called, in its body', () => {
    const metadata = model.symbol('common', 'MetadataDecorator')!
    expect(metadata.code.map(text)).toEqual([
      'interface MetadataDecorator<T> {\n  (value: T): ClassDecorator & MethodDecorator\n}',
    ])
    expect(metadata.signatures[0].params.map(param => param.name)).toEqual(['value'])
    expect(text(model.symbol('interface', 'GuardInterface')!.code[0])).toBe('interface GuardInterface')
  })
})

describe('ApiModel by kind', () => {
  // beta.6 is the first release whose every symbol carries its @group
  const beta6 = (
    JSON.parse(readFileSync('generated/api/4.1.0-beta.6.json', 'utf8')) as { project: JSONOutput.ProjectReflection }
  ).project
  const byKind = new ApiModel('4.1', beta6, versions, since, undefined, { by: 'kind' })

  it('files each symbol under the kind its @group names, the kinds in order, each by category then name', () => {
    const sections = byKind.sections()
    expect(sections.map(section => section.slug)).toEqual([
      'controllers',
      'decorators',
      'responses',
      'utilities',
      'testing',
      'configuration',
      'types',
    ])
    const decorators = sections.find(section => section.slug === 'decorators')!
    expect(decorators.title).toBe('Decorators')
    const order = decorators.symbols.map(symbol => `${symbol.category ?? ''}/${symbol.name}`)
    expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b, 'en')))
    expect(decorators.symbols.find(symbol => symbol.name === 'Cooldown')).toMatchObject({
      href: '/docs/4.1/api/decorators/Cooldown',
      category: 'Pipeline stages',
    })
    expect(byKind.symbol('decorators', 'Cooldown')).toMatchObject({ section: 'decorators', entry: 'meocord/decorator' })
  })

  it('gives a re-exported symbol one page, which lists every entry point that exports it', () => {
    const names = byKind.params().map(param => param.symbol)
    expect(names.filter(name => name === 'MeoCordApplication')).toHaveLength(1)
    const app = byKind.find('MeoCordApplication')!
    expect(byKind.symbol(app.section, 'MeoCordApplication')!.imports).toEqual(['meocord/core', 'meocord/interface'])
    // Either entry point finds the one page
    expect(byKind.locate('meocord/interface', 'MeoCordApplication')).toEqual(app)
    expect(byKind.locate('core', 'MeoCordApplication')).toEqual(app)
    expect(byKind.locate('decorator', 'MeoCordApplication')).toBeUndefined()
  })

  it("files an older release's symbols by the groups groupOf gives, and names one it cannot file", () => {
    const groups = new Map(
      byKind.sections().flatMap(section => section.symbols.map(symbol => [symbol.name, section.title] as const)),
    )
    const older = new ApiModel('4.1', project, versions, since, '4.1.0-beta.0', {
      by: 'kind',
      // The symbols beta.0 had and beta.6 does not, as the site files them
      groupOf: name =>
        groups.get(name) ??
        (['AutocompleteMetadata', 'CommandMetadata', 'MetadataKey', 'PIPED_BRAND'].includes(name)
          ? 'Types'
          : undefined),
    })
    expect(older.href(older.find('Cooldown')!)).toBe('/docs/4.1/api/4.1.0-beta.0/decorators/Cooldown')
    expect(() => new ApiModel('4.1', project, versions, since, '4.1.0-beta.0', { by: 'kind' })).toThrow(
      /^4\.1\.0-beta\.0: meocord\/\w+'s \w+ has no @group tag/,
    )
  })
})

describe('ApiModel options', () => {
  const beta6 = (
    JSON.parse(readFileSync('generated/api/4.1.0-beta.6.json', 'utf8')) as { project: JSONOutput.ProjectReflection }
  ).project
  const byKind = new ApiModel('4.1', beta6, versions, since, undefined, { by: 'kind' })

  it('gives each property of an options object typed inline a row, with its type, docs and an anchor', () => {
    const meocord = byKind.symbol('decorators', 'MeoCord')!
    const i18n = meocord.signatures[0].params.find(param => param.name === 'options.i18n')!
    expect(i18n).toMatchObject({ anchor: 'i18n', optional: true })
    expect(text(i18n.type)).not.toBe('')
    expect(i18n.description).not.toBe('')
    expect(meocord.anchors).toEqual(expect.arrayContaining(['i18n', 'theme', 'providers', 'cooldownstore']))
    // Each theme group, and beneath it the roles of the …Overrides interface it is typed by
    expect(byKind.symbol('decorators', 'UseTheme')!.anchors).toEqual(
      expect.arrayContaining(['buttons', 'colors', 'emojis', 'colors-primary', 'emojis-loading']),
    )
    expect(byKind.href({ ...byKind.find('MeoCord')!, member: 'cooldownStore' })).toBe(
      '/docs/4.1/api/decorators/MeoCord#cooldownstore',
    )
  })
})

describe('ApiModel option types inline', () => {
  const beta6 = (
    JSON.parse(readFileSync('generated/api/4.1.0-beta.6.json', 'utf8')) as { project: JSONOutput.ProjectReflection }
  ).project
  const byKind = new ApiModel('4.1', beta6, versions, since, undefined, { by: 'kind' })
  const rows = (name: string) => byKind.symbol('decorators', name)!.signatures.flatMap(signature => signature.params)

  it("shows an options interface's members under the parameter it types, with each member's own since", () => {
    const defer = rows('Defer').filter(param => param.name.startsWith('options.'))
    expect(defer.map(param => param.name)).toEqual(expect.arrayContaining(['options.ephemeral', 'options.mode']))
    expect(defer.every(param => param.type.length > 0)).toBe(true)
    const help = rows('MessageHandler').find(param => param.name === 'options.hidden')!
    expect(help).toMatchObject({ anchor: 'hidden', since: '4.1.0-beta.6' })
  })

  it('shows them one level into an inline options object, and for each part of an intersection', () => {
    const messages = rows('MeoCord').filter(param => param.name.startsWith('options.messages.'))
    expect(messages.find(param => param.name === 'options.messages.prefix')).toMatchObject({
      anchor: 'messages-prefix',
    })
    expect(byKind.symbol('decorators', 'MeoCord')!.anchors).toContain('messages-prefix')
    // Cooldown's options are CooldownOptions and an object of its own
    expect(rows('Cooldown').map(param => param.name)).toEqual(
      expect.arrayContaining(['options.seconds', 'options.uses']),
    )
    // A class is not an options type: the translator keeps its link to its own page
    expect(rows('MeoCord').some(param => param.name.startsWith('options.i18n.'))).toBe(false)
  })
})

describe('ApiModel option rows on beta.7', () => {
  const beta7 = (
    JSON.parse(readFileSync('generated/api/4.1.0-beta.7.json', 'utf8')) as { project: JSONOutput.ProjectReflection }
  ).project
  const byKind = new ApiModel('4.1', beta7, versions, since, undefined, { by: 'kind' })

  it("lists an option both parts of an intersection declare once, with the inline part's type and text", () => {
    for (const signature of byKind.symbol('decorators', 'Cooldown')!.signatures) {
      const names = signature.params.map(param => param.name)
      expect(names.length).toBe(new Set(names).size)
    }
    const by = byKind
      .symbol('decorators', 'Cooldown')!
      .signatures.flatMap(signature => signature.params)
      .filter(param => param.name === 'options.by')
    expect(by.some(param => !param.optional && param.description !== '')).toBe(true)
  })

  it('anchors an option by the signatures declaring it: plain in the first, numbered in each after', () => {
    const anchors = byKind
      .symbol('decorators', 'Cooldown')!
      .signatures.map(signature => signature.params.filter(param => param.anchor).map(param => param.anchor))
    expect(anchors.length).toBeGreaterThan(1)
    expect(anchors[0]).toContain('by')
    expect(anchors[1]).toContain('by-2')
    expect(anchors.flat().filter(anchor => anchor!.endsWith('-option'))).toEqual([])
    // A signature without options doesn't take the plain anchors from the one that has them
    const hidden = byKind
      .symbol('decorators', 'MessageHandler')!
      .signatures.flatMap(signature => signature.params)
      .find(param => param.name === 'options.hidden')!
    expect(hidden.anchor).toBe('hidden')
  })

  it("reads a destructured parameter as it binds, and a return written with an alias's name as written", () => {
    const usage = byKind.symbol('responses', 'MessageUsageError')!
    const constructor = usage.members.find(member => member.name === 'constructor')!
    expect(constructor.code[0]!.map(token => token.text).join('')).toContain('{ serverOnly, dmOnly, quiet }?:')
    // A destructured parameter a @param names keeps that name
    const suite = byKind.symbol('testing', 'testCooldownStore')!
    expect(suite.signatures[0]!.params.map(param => param.name)).toContain('framework')
    // discord.js resolves, so a return naming its Message reads as written
    const message = byKind.symbol('testing', 'createMockMessage')!
    expect(message.signatures[0]!.returns!.type.map(token => token.text).join('')).toMatch(/^DeepMocked<Message> & \{/)
  })

  it("gives an option named like one of the window's ids an anchor of its own, not none", () => {
    const content = byKind
      .symbol('testing', 'createMockMessage')!
      .signatures.flatMap(signature => signature.params)
      .find(param => param.name === 'overrides.content')!
    expect(content.anchor).toBe('content-option')
  })
})
