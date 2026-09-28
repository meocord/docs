import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { CliCommand, CliManifest, CliOption } from '../../../scripts/lib/cli'
import { VERSIONS } from '@/config/versions'
import type { ApiListing, ApiSection } from '@/lib/docs/api-model'
import { docsHref, lineOf, memberAnchor } from '@/lib/urls'

/** The by-kind API section the CLI's commands are listed under. */
export const CLI_SECTION = 'cli'

const manifests = new Map<string, CliManifest | undefined>()

/** A version's CLI manifest, as the sync wrote it; undefined for a version from before the CLI shipped one. */
export function cliManifest(version: string | undefined): CliManifest | undefined {
  if (!version) return undefined
  if (!manifests.has(version)) {
    const file = path.join(process.cwd(), 'generated', 'cli', `${version}.json`)
    manifests.set(version, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CliManifest) : undefined)
  }
  return manifests.get(version)
}

/** A command's page, or with `sub` one of its subcommands on it; with `version`, in that version's API. */
export function cliHref(line: string, command: string, sub?: string, version?: string): string {
  if (version !== undefined && lineOf(version) !== line) throw new Error(`${version} is not a version of line ${line}.`)
  return docsHref({ kind: 'api', line, section: CLI_SECTION, symbol: command, member: sub, version }, VERSIONS)
}

/** A top-level command by its name, or undefined when the CLI has none. */
export function cliCommand(manifest: CliManifest, name: string): CliCommand | undefined {
  return manifest.commands.find(command => command.name === name)
}

/** What a command is for, in one line: its summary, or its description. */
export const commandSummary = (command: CliCommand) => command.summary ?? command.description ?? ''

/** The anchor a subcommand's section has on its parent's page: `controller`. */
export const subcommandAnchor = (command: CliCommand) => memberAnchor(command.name)

/** The CLI as a section of the by-kind API: each top-level command, in the order the CLI declares them. */
export function cliSection(line: string, manifest: CliManifest, version?: string): ApiSection {
  const symbols: ApiListing[] = manifest.commands.map(command => ({
    name: command.name,
    kind: 'command',
    href: cliHref(line, command.name, undefined, version),
    deprecated: false,
    summary: commandSummary(command),
  }))
  return { slug: CLI_SECTION, title: 'CLI', symbols }
}

/** An option as a reader types it: its long flag, or its short one. */
const flagOf = (option: CliOption) => option.long ?? option.short ?? option.flags

/**
 * A command a reader can copy, from the manifest alone: its words, each required argument by its
 * first choice or its name, and one real option with the value it needs. A command that only groups
 * others shows its first subcommand's.
 */
export function exampleInvocation(command: CliCommand): string {
  if (command.arguments.length === 0 && command.options.length === 0 && command.commands[0])
    return exampleInvocation(command.commands[0])
  const words = ['meocord', ...command.path]
  for (const argument of command.arguments.filter(each => each.required))
    words.push(argument.choices?.[0] ?? `<${argument.name}>`)
  const value = (option: CliOption) =>
    option.value ? [option.choices?.[0] ?? `<${option.value.name}>`] : ([] as string[])
  const mandatory = command.options.filter(option => option.mandatory)
  for (const option of mandatory) words.push(flagOf(option), ...value(option))
  const shown = command.options.find(option => !option.mandatory && !option.negate)
  if (shown) words.push(flagOf(shown), ...value(shown))
  return words.join(' ')
}

/** A command's usage line: `meocord build [options]`. */
export const usageOf = (command: CliCommand) => ['meocord', ...command.path, command.usage].filter(Boolean).join(' ')
