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

/** What an example gives an argument or an option's value, by its name, so every example runs as written. */
const SAMPLE_VALUES: Readonly<Record<string, string>> = { 'app-name': 'my-bot', name: 'Greeting' }

const sampleFor = (name: string, choices: readonly string[] | null, command: CliCommand): string => {
  const sample = choices?.[0] ?? SAMPLE_VALUES[name]
  if (sample === undefined)
    throw new Error(
      `meocord ${command.path.join(' ')}'s example has no sample value for <${name}>: add one to SAMPLE_VALUES.`,
    )
  return sample
}

/**
 * A command a reader can copy and run, from the manifest alone: its words, each required argument by
 * its first choice or a sample value, its mandatory options, and, for a command that takes no
 * argument, one option. A command that only groups others shows its first subcommand's.
 */
export function exampleInvocation(command: CliCommand): string {
  if (command.arguments.length === 0 && command.options.length === 0 && command.commands[0])
    return exampleInvocation(command.commands[0])
  const words = ['meocord', ...command.path]
  const required = command.arguments.filter(each => each.required)
  for (const argument of required) words.push(sampleFor(argument.name, argument.choices, command))
  const value = (option: CliOption) =>
    option.value ? [sampleFor(option.value.name, option.choices, command)] : ([] as string[])
  for (const option of command.options.filter(each => each.mandatory)) words.push(flagOf(option), ...value(option))
  // An optional flag can depend on an argument's value, which the manifest doesn't record
  const shown = required.length === 0 ? command.options.find(each => !each.mandatory && !each.negate) : undefined
  if (shown) words.push(flagOf(shown), ...value(shown))
  return words.join(' ')
}

/** A command's usage line: `meocord build [options]`. */
export const usageOf = (command: CliCommand) => ['meocord', ...command.path, command.usage].filter(Boolean).join(' ')
