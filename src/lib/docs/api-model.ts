import type { JSONOutput } from 'typedoc'
import type { VersionsManifest } from '@/lib/urls'
import { docsHref, entrySegment, memberAnchor } from '@/lib/urls'

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
  returns?: { type: Token[]; description: string }
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
  /** The declaration as code, one line per overload, as for a member. */
  code: Token[][]
  description: string
  signatures: ApiSignature[]
  members: ApiMember[]
  since?: string
  deprecated?: string
  examples: string[]
  seeAlso: Token[]
}

export interface SinceData {
  since: string
  removed?: string
}

interface Location {
  entry: string
  symbol: string
  member?: string
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
  readonly #declarations = new Map<string, { entry: string; declaration: Declaration }>()

  constructor(
    readonly line: string,
    project: JSONOutput.ProjectReflection,
    readonly versions: VersionsManifest,
    readonly since: Record<string, SinceData> = {},
    readonly version?: string,
  ) {
    for (const entryModule of project.children ?? []) {
      for (const declaration of entryModule.children ?? []) {
        if (!SAFE_NAME.test(declaration.name)) continue
        this.#declarations.set(`${entrySegment(entryModule.name)}/${declaration.name}`, {
          entry: entryModule.name,
          declaration,
        })
        this.#byId.set(declaration.id, { entry: entryModule.name, symbol: declaration.name })
        for (const member of declaration.children ?? []) {
          if (SAFE_NAME.test(member.name)) {
            this.#byId.set(member.id, { entry: entryModule.name, symbol: declaration.name, member: member.name })
          }
        }
      }
    }
  }

  /** Every documented symbol, by entry point, in source order. */
  entries(): { entry: string; symbols: { name: string; kind: string; href: string; deprecated: boolean }[] }[] {
    const groups = new Map<string, { name: string; kind: string; href: string; deprecated: boolean }[]>()
    for (const { entry, declaration } of this.#declarations.values()) {
      if (!groups.has(entry)) groups.set(entry, [])
      groups.get(entry)!.push({
        name: declaration.name,
        kind: kindName(declaration.kind),
        href: this.href({ entry, symbol: declaration.name }),
        deprecated: deprecation(declaration) !== undefined,
      })
    }
    return [...groups].map(([entry, symbols]) => ({ entry, symbols }))
  }

  /** Every `{ entry, symbol }` this API has a page for, as URL segments. */
  params(): { entry: string; symbol: string }[] {
    return [...this.#declarations.keys()].map(key => {
      const [entry, symbol] = key.split('/')
      return { entry, symbol }
    })
  }

  href(location: Location): string {
    return docsHref(
      {
        kind: 'api',
        line: this.line,
        entry: location.entry,
        symbol: location.symbol,
        member: location.member,
        version: this.version,
      },
      this.versions,
    )
  }

  /** A symbol's page, or undefined when the entry has no such symbol. */
  symbol(entry: string, name: string): ApiSymbol | undefined {
    const found = this.#declarations.get(`${entrySegment(entry)}/${name}`)
    if (!found) return undefined
    const { entry: entryPoint, declaration } = found
    const key = `${entryPoint}:${declaration.name}`
    const signatures = (declaration.signatures ?? []).map(signature => this.#signature(signature, key))
    const members = (declaration.children ?? [])
      .filter(member => SAFE_NAME.test(member.name) && !member.flags?.isInherited && !member.flags?.isPrivate)
      .map(member => this.#member(declaration, member, `${key}.${member.name}`))
    return {
      name: declaration.name,
      kind: kindName(declaration.kind),
      entry: entryPoint,
      code: this.#declarationCode(declaration),
      description: this.#text(declaration.comment) || signatures[0]?.description || '',
      signatures: declaration.signatures ? signatures : [],
      members,
      since: this.since[key]?.since,
      deprecated: deprecation(declaration),
      examples: examples(declaration.comment),
      seeAlso: this.#seeAlso(declaration.comment),
    }
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
          ? { type: returnsType, description: this.#parts(returns?.content ?? []) }
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
        return [
          [
            { text: `${declaration.flags?.isAbstract ? 'abstract ' : ''}${keyword} ${name}` },
            ...typeParams,
            ...(extended.length ? [{ text: ' extends ' }, ...extended] : []),
            ...(implemented.length ? [{ text: ' implements ' }, ...implemented] : []),
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
