import type { JSONOutput } from 'typedoc'
import type { DecoratorTarget } from '@/lib/docs/api-layout'
import type { VersionsManifest } from '@/lib/urls'
import { docsHref, entrySegment, memberAnchor, sectionSegment } from '@/lib/urls'

type Declaration = JSONOutput.DeclarationReflection
type Signature = JSONOutput.SignatureReflection
type Parameter = JSONOutput.ParameterReflection
type SomeType = JSONOutput.SomeType
type Comment = JSONOutput.Comment
type CommentPart = JSONOutput.CommentDisplayPart

/** A piece of rendered code: its text, and where it links when it names a documented symbol. */
export interface Token {
  text: string
  href?: string
}

export interface ApiParam {
  name: string
  type: Token[]
  optional: boolean
  defaultValue?: string
  since?: string
  /** Markdown. */
  description: string
}

export interface ApiSignature {
  /** The declaration as code: `Cooldown(options: CooldownOptions): ClassDecorator`. */
  code: Token[]
  /** Markdown. */
  description: string
  params: ApiParam[]
  /** Its type, and what it decorates when the function is a decorator factory. */
  returns?: { type: Token[]; description: string; decorates?: DecoratorTarget }
  throws: string[]
  examples: string[]
}

export interface ApiMember {
  name: string
  anchor: string
  kind: string
  /** The member as code, one line per overload. */
  code: Token[][]
  description: string
  signatures: ApiSignature[]
  defaultValue?: string
  since?: string
  deprecated?: string
  examples: string[]
}

export interface ApiSymbol {
  name: string
  kind: string
  /** The entry point, as imported: `meocord/decorator`. */
  entry: string
  /** Every entry point it can be imported from, the one that declares it first. */
  imports: string[]
  /** Its section's URL segment: its entry point's, or its kind's where the API is arranged by kind. */
  section: string
  /** The sub-group its `@category` tag files it under within its kind, such as `Pipeline stages`. */
  category?: string
  /** The declaration as code, one line per overload, as for a member. */
  code: Token[][]
  description: string
  signatures: ApiSignature[]
  members: ApiMember[]
  since?: string
  deprecated?: string
  examples: string[]
  seeAlso: Token[]
  /** The kind of API its `@group` tag files it under, such as `Decorators`; undefined where it has none. */
  group?: string
}

export interface SinceData {
  since: string
  removed?: string
}

/** A symbol in a section's list: what an index, a kind's page and the sidebar show of it. */
export interface ApiListing {
  name: string
  kind: string
  href: string
  deprecated: boolean
  category?: string
  /** The first paragraph of its doc comment, as Markdown. */
  summary: string
}

/** One section of an API: an entry point's symbols, or a kind's. */
export interface ApiSection {
  /** Its URL segment: `core`, or `decorators`. */
  slug: string
  /** What it is called: `meocord/core`, or `Decorators`. */
  title: string
  symbols: ApiListing[]
}

/** The kinds a by-kind API files its symbols under: each one's `@group` tag, URL segment and title, in order. */
export const API_KINDS = [
  { group: 'Controllers', slug: 'controllers', title: 'Controllers' },
  { group: 'Decorators', slug: 'decorators', title: 'Decorators' },
  { group: 'Responses', slug: 'responses', title: 'Responses' },
  { group: 'Utilities', slug: 'utilities', title: 'Utilities' },
  { group: 'Testing', slug: 'testing', title: 'Testing' },
  { group: 'Configuration', slug: 'configuration', title: 'Configuration' },
  { group: 'CLI', slug: 'cli', title: 'CLI' },
  { group: 'Types', slug: 'types', title: 'Types' },
] as const

/**
 * How an API's pages are arranged: by entry point, `/api/core/MeoCordFactory`, or by kind,
 * `/api/controllers/MeoCordFactory`, the kind named by each symbol's `@group` tag. `groupOf` names the
 * group of a symbol that has no tag, such as one from a release before the tags; one with neither fails.
 */
export type ApiScheme = { by: 'entry' } | { by: 'kind'; groupOf?: (name: string) => string | undefined }

interface Location {
  section: string
  symbol: string
  member?: string
}

interface Filed {
  section: string
  /** The entry points that export it, the declaring one first. */
  entries: string[]
  declaration: Declaration
  category?: string
}

/** A reflection kind as a word: `class`, `function`, `type-alias`, from TypeDoc's numeric kinds. */
const KINDS: Record<number, string> = {
  2: 'module',
  4: 'namespace',
  8: 'enum',
  16: 'enum-member',
  32: 'variable',
  64: 'function',
  128: 'class',
  256: 'interface',
  512: 'constructor',
  1024: 'property',
  2048: 'method',
  262144: 'accessor',
  2097152: 'type-alias',
  4194304: 'reference',
}
export const kindName = (kind: number) => KINDS[kind] ?? 'declaration'

const SAFE_NAME = /^[A-Za-z_$][\w$]*$/

/**
 * One line's API, from its TypeDoc JSON, for the reference pages: every documented symbol with
 * its signatures, parameters and members, types linked to the pages of the symbols they name.
 * With `version`, links go to that exact version's pages instead of the line's.
 */
export class ApiModel {
  readonly #byId = new Map<number, Location>()
  readonly #declarations = new Map<string, Filed>()
  readonly #aliases = new Map<number, SomeType>()
  readonly #titles = new Map<string, string>()

  constructor(
    readonly line: string,
    project: JSONOutput.ProjectReflection,
    readonly versions: VersionsManifest,
    readonly since: Record<string, SinceData> = {},
    readonly version?: string,
    readonly scheme: ApiScheme = { by: 'entry' },
  ) {
    const reexports: { entry: string; declaration: Declaration; target: number }[] = []
    for (const entryModule of project.children ?? []) {
      for (const declaration of entryModule.children ?? []) {
        if (!SAFE_NAME.test(declaration.name)) continue
        const target = (declaration as { target?: unknown }).target
        // By kind, a re-export is the symbol it names, which gets one page listing both entry points
        if (scheme.by === 'kind' && declaration.kind === 4194304 && typeof target === 'number') {
          reexports.push({ entry: entryModule.name, declaration, target })
          continue
        }
        this.#file(entryModule.name, declaration)
      }
    }
    for (const { entry, declaration, target } of reexports) {
      const location = this.#byId.get(target)
      const filed = location && this.#declarations.get(`${location.section}/${location.symbol}`)
      if (!filed) this.#file(entry, declaration)
      else if (!filed.entries.includes(entry)) filed.entries.push(entry)
    }
  }

  #file(entry: string, declaration: Declaration) {
    const section = this.scheme.by === 'entry' ? entrySegment(entry) : this.#kindOf(entry, declaration)
    const key = `${section}/${declaration.name}`
    const taken = this.#declarations.get(key)
    if (taken) {
      throw new Error(
        `${this.#source()}: ${entry}'s ${declaration.name} and ${taken.entries[0]}'s would share /api/${key}.`,
      )
    }
    this.#declarations.set(key, {
      section,
      entries: [entry],
      declaration,
      category: blockTag(declaration, '@category'),
    })
    this.#titles.set(section, this.scheme.by === 'entry' ? entry : API_KINDS.find(kind => kind.slug === section)!.title)
    this.#byId.set(declaration.id, { section, symbol: declaration.name })
    if (declaration.kind === 2097152 && declaration.type) this.#aliases.set(declaration.id, declaration.type)
    for (const member of declaration.children ?? []) {
      if (SAFE_NAME.test(member.name))
        this.#byId.set(member.id, { section, symbol: declaration.name, member: member.name })
    }
  }

  /** The kind a symbol is filed under, from its `@group` tag or, without one, the scheme's `groupOf`. */
  #kindOf(entry: string, declaration: Declaration): string {
    const tagged = blockTag(declaration, '@group')
    const group = tagged ?? (this.scheme.by === 'kind' ? this.scheme.groupOf?.(declaration.name) : undefined)
    const kind = API_KINDS.find(candidate => candidate.group === group)
    if (kind) return kind.slug
    const groups = API_KINDS.map(candidate => candidate.group).join(', ')
    throw new Error(
      group
        ? `${this.#source()}: ${entry}'s ${declaration.name} has @group ${group}, which is not one of ${groups}.`
        : `${this.#source()}: ${entry}'s ${declaration.name} has no @group tag, so it has no kind of API (${groups}).`,
    )
  }

  #source() {
    return this.version ?? `the ${this.line} line`
  }

  /**
   * Every documented symbol, by section: by entry point in source order, or by kind in the kinds' order,
   * each kind's symbols by category, those without one first, then by name.
   */
  sections(): ApiSection[] {
    const sections = new Map<string, ApiListing[]>()
    for (const { section, declaration, category } of this.#declarations.values()) {
      if (!sections.has(section)) sections.set(section, [])
      sections.get(section)!.push({
        name: declaration.name,
        kind: kindName(declaration.kind),
        href: this.href({ section, symbol: declaration.name }),
        deprecated: deprecation(declaration) !== undefined,
        category,
        summary: this.#summary(declaration),
      })
    }
    const listed = [...sections].map(([slug, symbols]) => ({ slug, title: this.#titles.get(slug)!, symbols }))
    if (this.scheme.by === 'entry') return listed
    const order = (slug: string) => API_KINDS.findIndex(kind => kind.slug === slug)
    const byName = (a: string, b: string) => a.localeCompare(b, 'en')
    for (const section of listed) {
      section.symbols.sort((a, b) => byName(a.category ?? '', b.category ?? '') || byName(a.name, b.name))
    }
    return listed.sort((a, b) => order(a.slug) - order(b.slug))
  }

  /** Every `{ section, symbol }` this API has a page for, as URL segments. */
  params(): { section: string; symbol: string }[] {
    return [...this.#declarations.keys()].map(key => {
      const [section, symbol] = key.split('/')
      return { section, symbol }
    })
  }

  /** Where a symbol is, by its name alone, which a by-kind API keeps unique; undefined when it has none. */
  find(name: string): Location | undefined {
    const filed = [...this.#declarations.values()].find(candidate => candidate.declaration.name === name)
    return filed && { section: filed.section, symbol: name }
  }

  /** Where the symbol an entry point exports under `name` is, in this API's arrangement. */
  locate(entry: string, name: string): Location | undefined {
    const segment = entrySegment(entry)
    const filed = [...this.#declarations.values()].find(
      candidate =>
        candidate.declaration.name === name && candidate.entries.some(each => entrySegment(each) === segment),
    )
    return filed && { section: filed.section, symbol: name }
  }

  href(location: Location): string {
    return docsHref(
      {
        kind: 'api',
        line: this.line,
        section: location.section,
        symbol: location.symbol,
        member: location.member,
        version: this.version,
      },
      this.versions,
    )
  }

  /** A symbol's page, or undefined when the section has no such symbol. */
  symbol(section: string, name: string): ApiSymbol | undefined {
    const found = this.#declarations.get(`${sectionSegment(section)}/${name}`)
    if (!found) return undefined
    const { entries, declaration } = found
    const key = `${entries[0]}:${declaration.name}`
    const signatures = (declaration.signatures ?? []).map(signature => this.#signature(signature, key))
    const members = (declaration.children ?? [])
      .filter(member => SAFE_NAME.test(member.name) && !member.flags?.isInherited && !member.flags?.isPrivate)
      .map(member => this.#member(declaration, member, `${key}.${member.name}`))
    return {
      name: declaration.name,
      kind: kindName(declaration.kind),
      entry: entries[0],
      imports: entries,
      section: found.section,
      category: found.category,
      code: this.#declarationCode(declaration),
      description: this.#text(declaration.comment) || signatures[0]?.description || '',
      signatures: declaration.signatures ? signatures : [],
      members,
      since: this.since[key]?.since,
      deprecated: deprecation(declaration),
      examples: examples(declaration.comment),
      seeAlso: this.#seeAlso(declaration.comment),
      group: group(declaration),
    }
  }

  /** The first paragraph of a declaration's doc comment, or its first signature's. */
  #summary(declaration: Declaration): string {
    const text = this.#text(declaration.comment) || this.#text(declaration.signatures?.[0]?.comment)
    return text.split(/\n\s*\n/)[0]
  }

  #member(parent: Declaration, member: Declaration, key: string): ApiMember {
    const accessors = [member.getSignature, member.setSignature].filter(
      (signature): signature is Signature => !!signature,
    )
    const signatures = [...(member.signatures ?? []), ...accessors].map(signature => this.#signature(signature, key))
    return {
      name: member.name,
      anchor: memberAnchor(member.name),
      kind: kindName(member.kind),
      code: this.#memberCode(parent, member),
      description: this.#text(member.comment) || signatures[0]?.description || '',
      signatures: member.signatures ? signatures : [],
      defaultValue: defaultValue(member),
      since: this.since[key]?.since,
      deprecated: deprecation(member),
      examples: examples(member.comment),
    }
  }

  #signature(signature: Signature, key: string): ApiSignature {
    const params: ApiParam[] = []
    for (const parameter of signature.parameters ?? []) {
      params.push(this.#param(parameter, `${key}(${parameter.name})`))
      // `@param options.seconds` documents a property of the parameter's type.
      const highlighted = parameter.type?.type === 'reference' ? parameter.type.highlightedProperties : undefined
      for (const [property, parts] of Object.entries(highlighted ?? {})) {
        params.push({
          name: `${parameter.name}.${property}`,
          type: [],
          optional: false,
          description: this.#parts(parts),
        })
      }
    }
    const returns = signature.comment?.blockTags?.find(tag => tag.tag === '@returns')
    const returnsType = signature.type && signature.kind !== 16384 ? this.type(signature.type) : undefined
    return {
      code: this.#signatureCode(signature),
      description: this.#text(signature.comment),
      params,
      returns:
        returnsType && !isVoid(signature.type)
          ? {
              type: returnsType,
              description: this.#parts(returns?.content ?? []),
              decorates: signature.type && this.#decorates(signature.type),
            }
          : undefined,
      throws: (signature.comment?.blockTags ?? [])
        .filter(tag => tag.tag === '@throws')
        .map(tag => this.#parts(tag.content)),
      examples: examples(signature.comment),
    }
  }

  #param(parameter: Parameter, key: string): ApiParam {
    return {
      name: parameter.flags?.isRest ? `...${parameter.name}` : parameter.name,
      type: parameter.type ? this.type(parameter.type) : [],
      optional: !!parameter.flags?.isOptional || parameter.defaultValue !== undefined,
      defaultValue: parameter.defaultValue,
      since: this.since[key]?.since,
      description: this.#text(parameter.comment),
    }
  }

  /** What a type decorates, when it is a decorator: TypeScript's decorator types, or a function of `target`. */
  #decorates(type: SomeType, depth = 0): DecoratorTarget | undefined {
    if (depth > 4) return undefined
    if (type.type === 'reference') {
      const alias = typeof type.target === 'number' ? this.#aliases.get(type.target) : undefined
      if (alias) return this.#decorates(alias, depth + 1)
      return BUILT_IN_DECORATORS[type.name]
    }
    if (type.type === 'intersection') {
      const targets = new Set(type.types.map(each => this.#decorates(each, depth + 1)))
      if (targets.size === 1) return [...targets][0]
      return targets.size === 2 && targets.has('class') && targets.has('method') ? 'class or method' : undefined
    }
    const params = type.type === 'reflection' ? type.declaration.signatures?.[0]?.parameters : undefined
    if (params?.[0]?.name !== 'target') return undefined
    if (params.length === 1) return 'class'
    if (params.length === 2) return 'property'
    const index = params[2].type
    return params.length === 3
      ? index?.type === 'intrinsic' && index.name === 'number'
        ? 'parameter'
        : 'method'
      : undefined
  }

  // Code for declarations, members and signatures

  #declarationCode(declaration: Declaration): Token[][] {
    const typeParams = this.#typeParams(declaration.typeParameters)
    const name = declaration.name
    switch (declaration.kind) {
      case 64:
        return (declaration.signatures ?? []).map(signature => this.#signatureCode(signature))
      case 128:
      case 256: {
        const keyword = declaration.kind === 128 ? 'class' : 'interface'
        const extended = this.#list(declaration.extendedTypes)
        const implemented = this.#list(declaration.implementedTypes)
        // An interface that can be called shows how, in its body; its members follow on the page.
        const calls = declaration.kind === 256 ? (declaration.signatures ?? []) : []
        return [
          [
            { text: `${declaration.flags?.isAbstract ? 'abstract ' : ''}${keyword} ${name}` },
            ...typeParams,
            ...(extended.length ? [{ text: ' extends ' }, ...extended] : []),
            ...(implemented.length ? [{ text: ' implements ' }, ...implemented] : []),
            ...(calls.length
              ? [
                  ...calls.flatMap((signature, index) => [
                    { text: index === 0 ? ' {\n  ' : '\n  ' },
                    ...this.#typeParams(signature.typeParameters),
                    ...this.#paramsCode(signature),
                    { text: ': ' },
                    ...this.#maybe(signature.type),
                  ]),
                  { text: '\n}' },
                ]
              : []),
          ],
        ]
      }
      case 2097152:
        return [[{ text: `type ${name}` }, ...typeParams, { text: ' = ' }, ...this.#maybe(declaration.type)]]
      case 32:
        return [[{ text: `const ${name}: ` }, ...this.#maybe(declaration.type)]]
      case 8:
        return [[{ text: `enum ${name}` }]]
      default:
        return [[{ text: name }]]
    }
  }

  #memberCode(parent: Declaration, member: Declaration): Token[][] {
    const modifiers = [
      member.flags?.isStatic ? 'static ' : '',
      member.flags?.isReadonly ? 'readonly ' : '',
      member.flags?.isAbstract ? 'abstract ' : '',
    ].join('')
    if (member.kind === 512) {
      return (member.signatures ?? []).map(signature => [
        { text: 'new ' },
        { text: parent.name },
        ...this.#paramsCode(signature),
      ])
    }
    if (member.signatures)
      return member.signatures.map(signature => [{ text: modifiers }, ...this.#signatureCode(signature)])
    if (member.kind === 16) {
      return [[{ text: member.name }, ...(member.type ? [{ text: ' = ' }, ...this.type(member.type)] : [])]]
    }
    if (member.getSignature || member.setSignature) {
      const lines: Token[][] = []
      if (member.getSignature)
        lines.push([{ text: `${modifiers}get ${member.name}(): ` }, ...this.#maybe(member.getSignature.type)])
      if (member.setSignature)
        lines.push([{ text: `${modifiers}set ${member.name}` }, ...this.#paramsCode(member.setSignature)])
      return lines
    }
    return [
      [{ text: `${modifiers}${member.name}${member.flags?.isOptional ? '?' : ''}: ` }, ...this.#maybe(member.type)],
    ]
  }

  #signatureCode(signature: Signature): Token[] {
    return [
      { text: signature.name },
      ...this.#typeParams(signature.typeParameters),
      ...this.#paramsCode(signature),
      { text: ': ' },
      ...this.#maybe(signature.type),
    ]
  }

  #paramsCode(signature: Signature): Token[] {
    const tokens: Token[] = [{ text: '(' }]
    ;(signature.parameters ?? []).forEach((parameter, index) => {
      if (index > 0) tokens.push({ text: ', ' })
      const optional = parameter.flags?.isOptional || parameter.defaultValue !== undefined
      tokens.push({ text: `${parameter.flags?.isRest ? '...' : ''}${parameter.name}${optional ? '?' : ''}: ` })
      tokens.push(...this.#maybe(parameter.type))
    })
    tokens.push({ text: ')' })
    return tokens
  }

  #typeParams(params: JSONOutput.TypeParameterReflection[] | undefined): Token[] {
    if (!params?.length) return []
    const tokens: Token[] = [{ text: '<' }]
    params.forEach((param, index) => {
      if (index > 0) tokens.push({ text: ', ' })
      tokens.push({ text: param.name })
      if (param.type) tokens.push({ text: ' extends ' }, ...this.type(param.type))
      if (param.default) tokens.push({ text: ' = ' }, ...this.type(param.default))
    })
    tokens.push({ text: '>' })
    return tokens
  }

  #list(types: SomeType[] | undefined): Token[] {
    return (types ?? []).flatMap((type, index) => [...(index > 0 ? [{ text: ', ' }] : []), ...this.type(type)])
  }

  #maybe(type: SomeType | undefined): Token[] {
    return type ? this.type(type) : [{ text: 'unknown' }]
  }

  /** A type as code, each documented symbol it names linked to its page. */
  type(type: SomeType, context: 'top' | 'operand' = 'top'): Token[] {
    const wrap = (tokens: Token[]) => (context === 'operand' ? [{ text: '(' }, ...tokens, { text: ')' }] : tokens)
    const join = (types: SomeType[], separator: string, inner: 'top' | 'operand') =>
      types.flatMap((each, index) => [...(index > 0 ? [{ text: separator }] : []), ...this.type(each, inner)])

    switch (type.type) {
      case 'intrinsic':
        return [{ text: type.name }]
      case 'literal':
        return [{ text: literal(type.value) }]
      case 'reference': {
        const location = typeof type.target === 'number' ? this.#byId.get(type.target) : undefined
        const args = type.typeArguments?.length
          ? [{ text: '<' }, ...join(type.typeArguments, ', ', 'top'), { text: '>' }]
          : []
        return [{ text: type.name, href: location ? this.href(location) : undefined }, ...args]
      }
      case 'array':
        return [...this.type(type.elementType, 'operand'), { text: '[]' }]
      case 'union':
        return wrap(join(type.types, ' | ', 'operand'))
      case 'intersection':
        return wrap(join(type.types, ' & ', 'operand'))
      case 'tuple':
        return [{ text: '[' }, ...join(type.elements ?? [], ', ', 'top'), { text: ']' }]
      case 'namedTupleMember':
        return [{ text: `${type.name}${type.isOptional ? '?' : ''}: ` }, ...this.type(type.element)]
      case 'optional':
        return [...this.type(type.elementType, 'operand'), { text: '?' }]
      case 'rest':
        return [{ text: '...' }, ...this.type(type.elementType, 'operand')]
      case 'typeOperator':
        return wrap([{ text: `${type.operator} ` }, ...this.type(type.target, 'operand')])
      case 'indexedAccess':
        return [...this.type(type.objectType, 'operand'), { text: '[' }, ...this.type(type.indexType), { text: ']' }]
      case 'conditional':
        return wrap([
          ...this.type(type.checkType, 'operand'),
          { text: ' extends ' },
          ...this.type(type.extendsType, 'operand'),
          { text: ' ? ' },
          ...this.type(type.trueType),
          { text: ' : ' },
          ...this.type(type.falseType),
        ])
      case 'mapped':
        return [
          { text: `{ ${type.readonlyModifier === '+' ? 'readonly ' : ''}[${type.parameter} in ` },
          ...this.type(type.parameterType),
          ...(type.nameType ? [{ text: ' as ' }, ...this.type(type.nameType)] : []),
          { text: `]${type.optionalModifier === '+' ? '?' : type.optionalModifier === '-' ? '-?' : ''}: ` },
          ...this.type(type.templateType),
          { text: ' }' },
        ]
      case 'templateLiteral':
        return [
          { text: `\`${type.head}` },
          ...type.tail.flatMap(([inner, text]) => [{ text: '${' }, ...this.type(inner), { text: `}${text}` }]),
          { text: '`' },
        ]
      case 'inferred':
        return [{ text: `infer ${type.name}` }]
      case 'predicate':
        return [
          { text: `${type.asserts ? 'asserts ' : ''}${type.name}` },
          ...(type.targetType ? [{ text: ' is ' }, ...this.type(type.targetType)] : []),
        ]
      case 'query':
        return [{ text: 'typeof ' }, ...this.type(type.queryType)]
      case 'reflection':
        return this.#reflection(type.declaration, context)
      case 'unknown':
        return [{ text: type.name }]
      default:
        return [{ text: 'unknown' }]
    }
  }

  #reflection(declaration: Declaration, context: 'top' | 'operand'): Token[] {
    const signature = declaration.signatures?.[0]
    if (signature) {
      const tokens: Token[] = [
        ...this.#typeParams(signature.typeParameters),
        ...this.#paramsCode(signature),
        { text: ' => ' },
        ...this.#maybe(signature.type),
      ]
      return context === 'operand' ? [{ text: '(' }, ...tokens, { text: ')' }] : tokens
    }
    const children = declaration.children ?? []
    if (children.length === 0) return [{ text: '{}' }]
    const tokens: Token[] = [{ text: '{ ' }]
    children.forEach((child, index) => {
      if (index > 0) tokens.push({ text: '; ' })
      tokens.push({
        text: `${child.flags?.isReadonly ? 'readonly ' : ''}${child.name}${child.flags?.isOptional ? '?' : ''}: `,
      })
      tokens.push(...(child.signatures?.[0] ? this.#reflection(child, 'top') : this.#maybe(child.type)))
    })
    tokens.push({ text: ' }' })
    return tokens
  }

  // Comments, as Markdown

  #text(comment: Comment | undefined): string {
    return comment ? this.#parts(comment.summary) : ''
  }

  #parts(parts: CommentPart[]): string {
    return parts
      .map(part => {
        if (part.kind !== 'inline-tag') return part.text
        const location = typeof part.target === 'number' ? this.#byId.get(part.target) : undefined
        const label = part.text.trim() || location?.member || location?.symbol || ''
        return location ? `[\`${label}\`](${this.href(location)})` : `\`${label}\``
      })
      .join('')
      .trim()
  }

  #seeAlso(comment: Comment | undefined): Token[] {
    return (comment?.blockTags ?? [])
      .filter(tag => tag.tag === '@see')
      .flatMap(tag =>
        tag.content
          .filter(part => part.kind === 'inline-tag')
          .map(part => {
            const location = typeof part.target === 'number' ? this.#byId.get(part.target) : undefined
            return { text: part.text.trim(), href: location ? this.href(location) : undefined }
          }),
      )
  }
}

const BUILT_IN_DECORATORS: Record<string, DecoratorTarget> = {
  ClassDecorator: 'class',
  MethodDecorator: 'method',
  PropertyDecorator: 'property',
  ParameterDecorator: 'parameter',
}

const literal = (value: unknown) =>
  typeof value === 'string'
    ? `'${value.replace(/'/g, "\\'")}'`
    : typeof value === 'object' && value && 'value' in value
      ? `${(value as { negative?: boolean }).negative ? '-' : ''}${(value as { value: string }).value}n`
      : String(value)

const isVoid = (type: SomeType | undefined) => type?.type === 'intrinsic' && type.name === 'void'

function tagText(comment: Comment | undefined, tag: string): string | undefined {
  const found = comment?.blockTags?.find(block => block.tag === tag)
  return found
    ? found.content
        .map(part => part.text)
        .join('')
        .trim()
    : undefined
}

/** A declaration's block tag, such as `@group`, from its own comment or, for a function, its signatures'. */
function blockTag(declaration: Declaration, tag: string): string | undefined {
  for (const comment of [declaration.comment, ...(declaration.signatures ?? []).map(signature => signature.comment)]) {
    const text = tagText(comment, tag)
    if (text) return text
  }
  return undefined
}

/** A declaration's `@group`, from its own comment or, for a function, its signatures'. */
const group = (declaration: Declaration) => blockTag(declaration, '@group')

function deprecation(declaration: Declaration): string | undefined {
  for (const comment of [declaration.comment, ...(declaration.signatures ?? []).map(signature => signature.comment)]) {
    const text = tagText(comment, '@deprecated')
    if (text !== undefined) return text || 'Deprecated.'
  }
  return undefined
}

function defaultValue(declaration: Declaration): string | undefined {
  const text = tagText(declaration.comment, '@defaultValue') ?? tagText(declaration.comment, '@default')
  return text?.replace(/^```\w*\n?|\n?```$/g, '').replace(/^`|`$/g, '') || undefined
}

function examples(comment: Comment | undefined): string[] {
  return (comment?.blockTags ?? [])
    .filter(tag => tag.tag === '@example')
    .map(tag =>
      tag.content
        .map(part => part.text)
        .join('')
        .trim(),
    )
}
