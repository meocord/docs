import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { isComputedType, propertyKey, type Token } from '@/lib/docs/api-model'

// The package the 4.1 examples pin, whose own declarations TypeScript reads here, apart from TypeDoc
const pkgDir = realpathSync('examples/4.1/node_modules/meocord')
const version = (JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as { version: string }).version

const declarationFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? declarationFiles(path.join(dir, entry.name))
      : entry.name.endsWith('.d.ts')
        ? [path.join(dir, entry.name)]
        : [],
  )

/** Code compared by its words and symbols: spacing, grouping parentheses and a last `;` in braces aside. */
const normal = (code: string) => code.replace(/\s+/g, '').replace(/[()]/g, '').replace(/;}/g, '}').replace(/"/g, "'")

/** Each generic function's and method's type parameter lists, by `name` or `Owner.method`, as written. */
function declaredTypeParams(): Map<string, string[][]> {
  const printer = ts.createPrinter({ removeComments: true })
  const lists = new Map<string, string[][]>()
  const add = (key: string, params: ts.NodeArray<ts.TypeParameterDeclaration> | undefined, source: ts.SourceFile) => {
    if (!params?.length) return
    const list = params.map(param => normal(printer.printNode(ts.EmitHint.Unspecified, param, source)))
    lists.set(key, [...(lists.get(key) ?? []), list])
  }
  for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node.typeParameters, source)
      if ((ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
        for (const member of node.members)
          if ((ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) && ts.isIdentifier(member.name))
            add(`${node.name.text}.${member.name.text}`, member.typeParameters, source)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return lists
}

/** Each function's and method's parameter types, and each property's type, by `name`, `Owner.method` or `Owner.prop`, as written. */
function declaredTypes(): {
  params: Map<string, string[][]>
  properties: Map<string, string[]>
  names: Map<string, Set<string>>
  aliases: Map<string, string>
} {
  const printer = ts.createPrinter({ removeComments: true })
  const params = new Map<string, string[][]>()
  const properties = new Map<string, string[]>()
  // Each owner's property names as written: `[PIPED_BRAND]`, `'a name in words'` or `name`
  const names = new Map<string, Set<string>>()
  const aliases = new Map<string, string>()
  // An optional parameter's `?` says what a written `| undefined` would, so neither side names it
  const typeOf = (node: ts.TypeNode, source: ts.SourceFile, optional: boolean) => {
    const text = normal(printer.printNode(ts.EmitHint.Unspecified, node, source))
    return optional ? text.replace(/\|undefined$/, '') : text
  }
  const add = (key: string, list: ts.NodeArray<ts.ParameterDeclaration>, source: ts.SourceFile) => {
    const types = list
      .filter(param => !(ts.isIdentifier(param.name) && param.name.text === 'this'))
      .map(param => (param.type ? typeOf(param.type, source, !!param.questionToken) : ''))
    params.set(key, [...(params.get(key) ?? []), types])
  }
  for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node.parameters, source)
      if (ts.isTypeAliasDeclaration(node))
        aliases.set(
          node.name.text,
          normal(
            printer.printNode(ts.EmitHint.Unspecified, node, source).replace(/^(?:export |declare )+/, ''),
          ).replace(/;$/, ''),
        )
      if ((ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
        for (const member of node.members) {
          if (member.name && (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)))
            names.set(
              node.name.text,
              (names.get(node.name.text) ?? new Set()).add(
                printer.printNode(ts.EmitHint.Unspecified, member.name, source),
              ),
            )
          if (!member.name || !ts.isIdentifier(member.name)) continue
          const key = `${node.name.text}.${member.name.text}`
          if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) add(key, member.parameters, source)
          if ((ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) && member.type)
            properties.set(key, [...(properties.get(key) ?? []), typeOf(member.type, source, !!member.questionToken)])
        }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { params, properties, names, aliases }
}

const text = (tokens: Token[]) => tokens.map(token => token.text).join('')

/** The type parameters a signature's code opens with after its name, split at their top-level commas. */
function renderedTypeParams(name: string, code: Token[]): string[] | undefined {
  const text = code.map(token => token.text).join('')
  const start = text.indexOf(`${name}<`)
  if (start < 0) return undefined
  const params: string[] = []
  let depth = 0
  let current = ''
  for (let index = start + name.length + 1; index < text.length; index += 1) {
    const char = text[index]
    if (char === '>' && text[index - 1] !== '=' && depth === 0) break
    if ('<({['.includes(char)) depth += 1
    if ((char === '>' && text[index - 1] !== '=') || ')}]'.includes(char)) depth -= 1
    if (char === ',' && depth === 0) {
      params.push(normal(current))
      current = ''
    } else current += char
  }
  return [...params, normal(current)]
}

describe('type parameters', () => {
  beforeAll(() => vi.stubEnv('DOCS_NEXT', '1'))
  afterAll(() => vi.unstubAllEnvs())

  it("read as the pinned version's declarations write them: modifiers, constraints and defaults", async () => {
    const { apiModel, apiSections } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const declared = declaredTypeParams()
    let compared = 0
    const check = (key: string, name: string, code: Token[]) => {
      const lists = declared.get(key)
      const rendered = renderedTypeParams(name, code)
      if (!lists || !rendered) return
      expect(lists, `${key}: ${rendered.join(', ')}`).toContainEqual(rendered)
      compared += 1
    }
    for (const section of apiSections(model))
      for (const listing of section.symbols) {
        const symbol = model.symbol(section.slug, listing.name)
        if (!symbol) continue
        for (const signature of symbol.signatures) check(symbol.name, symbol.name, signature.code)
        for (const member of symbol.members)
          for (const signature of member.signatures) check(`${symbol.name}.${member.name}`, member.name, signature.code)
      }
    // Every generic decorator, helper and method among them, so a check of nothing can't pass
    expect(compared).toBeGreaterThan(30)
  })

  it('read parameter and property types as the declarations write them, constructor types with new', async () => {
    const { apiModel, apiSections } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const { params, properties, names, aliases } = declaredTypes()
    let compared = 0
    const check = (key: string, signature: { params: { name: string; type: Token[]; option?: boolean }[] }) => {
      const lists = params.get(key)
      if (!lists) return
      const rendered = signature.params.filter(param => !param.option).map(param => normal(text(param.type)))
      expect(lists, `${key}(${rendered.join(', ')})`).toContainEqual(rendered)
      compared += rendered.length
    }
    for (const section of apiSections(model))
      for (const listing of section.symbols) {
        const symbol = model.symbol(section.slug, listing.name)
        if (!symbol) continue
        for (const signature of symbol.signatures) check(symbol.name, signature)
        // A type alias whole, its object members' keys included: a computed key must not read as a string
        const alias = aliases.get(symbol.name)
        if (symbol.kind === 'type-alias' && alias) {
          expect(alias, symbol.name).toBe(normal(text(symbol.code[0] ?? [])).replace(/;$/, ''))
          compared += 1
        }
        for (const member of symbol.members) {
          const key = `${symbol.name}.${member.name}`
          for (const signature of member.signatures) check(key, signature)
          if (member.kind === 'property' && names.has(symbol.name)) {
            // Its name as written: a computed key stays one, a literal one is quoted where it must be
            const drawn =
              /^(?:(?:readonly|static|abstract|protected|public|declare) )*('(?:[^'\\]|\\.)*'|\[[^\]]+\]|[\w$]+)/.exec(
                text(member.code[0] ?? []),
              )?.[1]
            expect([...names.get(symbol.name)!], `${symbol.name} draws ${drawn}`).toContain(drawn)
            compared += 1
          }
          const written = properties.get(key)
          if (member.kind !== 'property' || !written) continue
          // `name?: type`, the type after the name and its `?`
          const line = text(member.code[0] ?? [])
          const type = line.slice(line.indexOf(': ', line.indexOf(member.name)) + 2)
          const optional = line.includes(`${member.name}?: `)
          expect(written, `${key}: ${type}`).toContain(
            optional ? normal(type).replace(/\|undefined$/, '') : normal(type),
          )
          compared += 1
        }
      }
    expect(compared).toBeGreaterThan(300)
  })
})

describe('option rows', () => {
  beforeAll(() => vi.stubEnv('DOCS_NEXT', '1'))
  afterAll(() => vi.unstubAllEnvs())

  it('show a computed type as the checker resolved it, and a named one as written', async () => {
    const { apiModel } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const cooldown = model.symbol('decorators', 'Cooldown')!
    const byForm = cooldown.signatures.find(signature => text(signature.code).includes("['by']"))!
    // The signature as written; the row that explains `by` with the function it takes
    expect(text(byForm.code)).toContain("by: NonNullable<CooldownOptions<P>['by']>")
    const by = byForm.params.find(param => param.name === 'options.by')!
    expect(text(by.type)).toBe(
      '(context: ExecutionContext, params: P) => CooldownKey | undefined | Promise<CooldownKey | undefined>',
    )
    // A mapped type over a type parameter resolves to nothing plainer, so its row reads as written
    const meocord = model.symbol('decorators', 'MeoCord')!
    const guards = meocord.signatures[0]!.params.find(param => param.name === 'options.guards')!
    expect(text(guards.type)).toContain('[K in keyof G]')
  })

  it("follow the declaration's order, as @MeoCord's options do", async () => {
    // @MeoCord's options object as its declaration orders it
    let written: string[] = []
    for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        const options =
          ts.isFunctionDeclaration(node) && node.name?.text === 'MeoCord' ? node.parameters[0]?.type : undefined
        if (options && ts.isTypeLiteralNode(options))
          written = options.members.flatMap(member =>
            member.name && ts.isIdentifier(member.name) ? [member.name.text] : [],
          )
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    const { apiModel } = await import('@/lib/docs/api-site')
    const meocord = apiModel('4.1', version)!.symbol('decorators', 'MeoCord')!
    const rows = meocord.signatures[0]!.params.filter(param => param.option && param.name.split('.').length === 2).map(
      param => param.name.slice('options.'.length),
    )
    expect(written.slice(0, 2)).toEqual(['controllers', 'clientOptions'])
    expect(rows).toEqual(written)
  })

  it("list every interface's members in its declaration's order", async () => {
    // Each interface's own members as declared, an overload's name once
    const declared = new Map<string, string[]>()
    for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node)) {
          const names = node.members.flatMap(member => (member.name ? [member.name.getText(source)] : []))
          declared.set(node.name.text, [...new Set([...(declared.get(node.name.text) ?? []), ...names])])
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    const { apiModel, apiSections } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    let compared = 0
    for (const section of apiSections(model))
      for (const listing of section.symbols) {
        const symbol = model.symbol(section.slug, listing.name)
        const own = symbol?.kind === 'interface' ? declared.get(symbol.name) : undefined
        if (!symbol || !own) continue
        const drawn = symbol.members.map(member => member.name).filter(name => own.includes(name))
        expect(drawn, symbol.name).toEqual(own.filter(name => drawn.includes(name)))
        compared += 1
      }
    expect(compared).toBeGreaterThan(50)
  })

  it("list the theme's roles for a parameter written by the name of a computed type", async () => {
    const { apiModel } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const useTheme = model.symbol('decorators', 'UseTheme')!
    expect(text(useTheme.signatures[0]!.code)).toBe('UseTheme(theme: ThemeOverride): ClassDecorator & MethodDecorator')
    const rows = (params: { name: string; option?: boolean }[]) =>
      params.filter(param => param.option).map(param => param.name)
    expect(rows(useTheme.signatures[0]!.params)).toEqual(
      expect.arrayContaining(['theme.buttons', 'theme.buttons.danger', 'theme.colors.primary', 'theme.emojis.loading']),
    )
    const builder = model.symbol('testing', 'TestingModuleBuilder')!
    const overrideTheme = builder.members.find(member => member.name === 'overrideTheme')!.signatures[0]!
    expect(rows(overrideTheme.params)).toEqual(rows(useTheme.signatures[0]!.params))
  })
})

describe('isComputedType', () => {
  it('knows a type worked out from others from one named', () => {
    for (const type of ['indexedAccess', 'conditional', 'mapped', 'query'])
      expect(isComputedType({ type }), type).toBe(true)
    expect(isComputedType({ type: 'typeOperator', operator: 'keyof' })).toBe(true)
    expect(isComputedType({ type: 'reference', package: 'typescript' })).toBe(true)
    expect(isComputedType({ type: 'typeOperator', operator: 'readonly' })).toBe(false)
    expect(isComputedType({ type: 'reference', package: 'meocord' })).toBe(false)
    expect(isComputedType({ type: 'reflection' })).toBe(false)
  })
})

describe('propertyKey', () => {
  it('writes a name that is no identifier in quotes, as a declaration must', () => {
    expect(propertyKey('theme')).toBe('theme')
    expect(propertyKey('$ref')).toBe('$ref')
    expect(propertyKey('0')).toBe('0')
    expect(propertyKey('not a param of the pattern')).toBe("'not a param of the pattern'")
    expect(propertyKey("it's")).toBe("'it\\'s'")
  })

  it('keeps a computed key a computed key: a symbol, not a string', async () => {
    const { apiModel } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const declaration = (name: string) => text(model.symbol(model.find(name)!.section, name)!.code[0]!)
    expect(declaration('Piped')).toBe('type Piped<T> = T & { readonly [PIPED_BRAND]?: true }')
    expect(declaration('Token')).toBe('type Token<T> = symbol & { readonly [tokenType]?: T }')
    expect(propertyKey('[tokenType]', true)).toBe('[tokenType]')
  })

  it("quotes RootTheme's reserved-role member in its declaration", async () => {
    const { apiModel } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const found = model.find('RootTheme')!
    expect(text(model.symbol(found.section, 'RootTheme')!.code[0]!)).toContain(
      "{ 'MeoCord reserves these theme roles; rename yours': ReservedTaken }",
    )
  })
})
