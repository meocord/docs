/**
 * The meocord.config.ts reference: every option `MeoCordConfig` declares, and the options of the
 * interfaces it nests, such as `sharding`, read from a version's API document with their type,
 * default, first version and JSDoc. The site shows it as a generated page of each authored line.
 */

import GithubSlugger from 'github-slugger'
import type { JSONOutput } from 'typedoc'
import type { SinceEntry } from './since'
import { lineOf } from './versions'

const ENTRY = 'meocord/interface'
const ROOT = 'MeoCordConfig'

/** The page's slug and id in every line. */
export const CONFIG_REFERENCE_SLUG = 'config-reference'

export interface ConfigOption {
  /** The option's path, as `appName` or `sharding.mode`. */
  name: string
  /** The declared type, as TypeScript prints it. */
  type: string
  required: boolean
  /** The `@defaultValue`, as Markdown. */
  default?: string
  /** The first documented version that declares the option. */
  since?: string
  /** The JSDoc summary, as Markdown. */
  summary: string
  /** The `@example` blocks, as Markdown. */
  examples: string[]
}

export interface ConfigGroup {
  /** The option the group nests under, or undefined for the top level. */
  option?: string
  /** The interface declaring the group's options. */
  interface: string
  summary: string
  options: ConfigOption[]
}

export interface ConfigDocument {
  version: string
  groups: ConfigGroup[]
}

type Declaration = JSONOutput.DeclarationReflection
type Part = JSONOutput.CommentDisplayPart

/** The names the document's comments link to: an option's anchor on the page, or a symbol's API page. */
type LinkTargets = Map<number, { option: string } | { symbol: string; entry: string }>

function typeText(type: JSONOutput.SomeType | undefined): string {
  if (!type) return 'unknown'
  switch (type.type) {
    case 'intrinsic':
      return type.name
    case 'literal':
      return typeof type.value === 'string' ? `'${type.value}'` : String(type.value)
    case 'union':
      return type.types.map(typeText).join(' | ')
    case 'intersection':
      return type.types.map(typeText).join(' & ')
    case 'array': {
      const element = typeText(type.elementType)
      return /[|& ]/.test(element) ? `(${element})[]` : `${element}[]`
    }
    case 'tuple':
      return `[${(type.elements ?? []).map(typeText).join(', ')}]`
    case 'reference':
      return type.typeArguments?.length ? `${type.name}<${type.typeArguments.map(typeText).join(', ')}>` : type.name
    case 'reflection': {
      const declaration = type.declaration
      const signature = declaration.signatures?.[0]
      if (signature) {
        const parameters = (signature.parameters ?? []).map(
          parameter => `${parameter.name}${parameter.flags.isOptional ? '?' : ''}: ${typeText(parameter.type)}`,
        )
        return `(${parameters.join(', ')}) => ${typeText(signature.type)}`
      }
      const members = (declaration.children ?? []).map(
        child => `${child.name}${child.flags.isOptional ? '?' : ''}: ${typeText(child.type)}`,
      )
      return `{ ${members.join('; ')} }`
    }
    default:
      return 'unknown'
  }
}

function markdown(parts: Part[] | undefined, links: LinkTargets, line: string): string {
  return (parts ?? [])
    .map(part => {
      if (part.kind !== 'inline-tag') return part.text
      const label = `\`${part.text}\``
      const target = typeof part.target === 'number' ? links.get(part.target) : undefined
      if (!target) return label
      if ('option' in target) return `[${label}](#${optionAnchor(target.option)})`
      return `[${label}](/docs/${line}/api/${target.entry.replace(/^meocord\//, '')}/${target.symbol})`
    })
    .join('')
    .trim()
}

/** The anchor of an option's heading on the page. */
export function optionAnchor(name: string): string {
  return new GithubSlugger().slug(name)
}

function blockTags(comment: JSONOutput.Comment | undefined, tag: string): Part[][] {
  return (comment?.blockTags ?? []).filter(block => block.tag === tag).map(block => block.content)
}

/**
 * The configuration reference of one version, from its API document; undefined when the version
 * declares no `MeoCordConfig`.
 *
 * @param version - The version the document describes.
 * @param project - The version's API document, as `generated/api/<version>.json` holds it.
 * @param since - since.json's entries, for the first version of each option.
 */
export function configReference(
  version: string,
  project: JSONOutput.ProjectReflection,
  since: Record<string, SinceEntry>,
): ConfigDocument | undefined {
  const line = lineOf(version)
  const entry = project.children?.find(child => child.name === ENTRY)
  const root = entry?.children?.find(child => child.name === ROOT)
  if (!entry || !root) return undefined

  const byId = new Map<number, Declaration>()
  const links: LinkTargets = new Map()
  for (const entryPoint of project.children ?? []) {
    for (const symbol of entryPoint.children ?? []) {
      byId.set(symbol.id, symbol)
      links.set(symbol.id, { symbol: symbol.name, entry: entryPoint.name })
    }
  }

  // The top level, then one group for each option whose type is an interface of the package
  const groups: { option?: string; declaration: Declaration }[] = [{ declaration: root }]
  for (const child of root.children ?? []) {
    const target = child.type?.type === 'reference' ? child.type.target : undefined
    const nested = typeof target === 'number' ? byId.get(target) : undefined
    if (nested?.children?.length) groups.push({ option: child.name, declaration: nested })
  }
  for (const { option, declaration } of groups)
    for (const child of declaration.children ?? [])
      links.set(child.id, { option: option ? `${option}.${child.name}` : child.name })

  return {
    version,
    groups: groups.map(({ option, declaration }) => ({
      option,
      interface: declaration.name,
      summary: markdown(declaration.comment?.summary, links, line),
      options: (declaration.children ?? []).map(child => {
        const name = option ? `${option}.${child.name}` : child.name
        const defaultValue = blockTags(child.comment, '@defaultValue')[0]
        return {
          name,
          type: typeText(child.type),
          required: !child.flags.isOptional,
          ...(defaultValue && { default: markdown(defaultValue, links, line) }),
          ...(since[`${ENTRY}:${declaration.name}.${child.name}`] && {
            since: since[`${ENTRY}:${declaration.name}.${child.name}`].since,
          }),
          summary: markdown(child.comment?.summary, links, line),
          examples: blockTags(child.comment, '@example').map(parts => markdown(parts, links, line)),
        }
      }),
    })),
  }
}

// A default written as a code block reads as prose in a table cell
const cell = (text: string) =>
  text
    .replace(/^```\w*\n([\s\S]*?)\n```$/, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\|/g, '\\|')

/**
 * The page the site shows for a line's configuration reference, as a Markdown file with front
 * matter: one section per option, with its type, default and first version, and the options an
 * option nests in sections below it.
 */
export function configReferencePage(line: string, doc: ConfigDocument): string {
  const out = [
    '---',
    `id: ${CONFIG_REFERENCE_SLUG}`,
    'title: meocord.config.ts reference',
    'section: Reference',
    'order: 90',
    `source: config@${doc.version}`,
    '---',
    '',
    `Every option \`meocord.config.ts\` takes, generated from the declarations of meocord ${doc.version}. ` +
      `The file default-exports a [\`MeoCordConfig\`](/docs/${line}/api/interface/MeoCordConfig).`,
  ]
  const section = (option: ConfigOption, depth: number) => {
    out.push('', `${'#'.repeat(depth)} ${option.name}`, '')
    out.push('| Type | Default | Since |', '| --- | --- | --- |')
    const defaultText = option.required ? 'Required' : option.default ? cell(option.default) : 'None'
    out.push(`| \`${cell(option.type)}\` | ${defaultText} | ${option.since ?? 'Unknown'} |`)
    if (option.summary) out.push('', option.summary)
    for (const example of option.examples) out.push('', example)
  }
  const [top, ...nested] = doc.groups
  for (const option of top.options) {
    section(option, 2)
    const group = nested.find(candidate => candidate.option === option.name)
    if (!group) continue
    out.push('', `\`${option.name}\` is a [\`${group.interface}\`](/docs/${line}/api/interface/${group.interface}).`)
    if (group.summary) out.push('', group.summary)
    for (const child of group.options) section(child, 3)
  }
  return `${out.join('\n')}\n`
}
