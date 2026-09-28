/**
 * The CLI's reference, as the package describes it: `dist/cli.json`, written at build time from the
 * commander program the CLI runs, from 4.1.0-beta.7 on. The sync reads it from the verified tarball,
 * by path, and runs nothing from the package.
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'

/** The shape this reader knows; a manifest of another schema fails the sync rather than render wrong. */
export const CLI_SCHEMA_VERSION = 1

export interface CliArgument {
  name: string
  description: string | null
  required: boolean
  variadic: boolean
  default: unknown
  defaultDescription: string | null
  choices: string[] | null
}

export interface CliOption {
  /** As declared: `-g, --guild <id>`. */
  flags: string
  short: string | null
  long: string | null
  description: string | null
  /** The value it takes, or null for a flag that takes none. */
  value: { name: string; required: boolean; variadic: boolean } | null
  mandatory: boolean
  default: unknown
  defaultDescription: string | null
  choices: string[] | null
  env: string | null
  negate: boolean
}

export interface CliCommand {
  name: string
  /** Its words after `meocord`: `['generate', 'controller']`. */
  path: string[]
  aliases: string[]
  summary: string | null
  description: string | null
  usage: string | null
  arguments: CliArgument[]
  options: CliOption[]
  helpText: { before: string | null; after: string | null }
  commands: CliCommand[]
}

export interface CliManifest {
  schemaVersion: number
  meocordVersion: string
  name: string
  description: string | null
  usage: string | null
  options: CliOption[]
  commands: CliCommand[]
}

/**
 * The CLI manifest an unpacked package ships, or undefined for a version from before it did. It fails
 * on a schema it does not know, and on a manifest written for another version than the package's.
 */
export function readCliManifest(packageDir: string, version: string): CliManifest | undefined {
  const file = path.join(packageDir, 'dist', 'cli.json')
  if (!existsSync(file)) return undefined
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as CliManifest
  if (manifest.schemaVersion !== CLI_SCHEMA_VERSION) {
    throw new Error(
      `meocord@${version}'s dist/cli.json has schemaVersion ${String(manifest.schemaVersion)}; the docs read ${CLI_SCHEMA_VERSION}.`,
    )
  }
  if (manifest.meocordVersion !== version) {
    throw new Error(`meocord@${version}'s dist/cli.json was written for ${manifest.meocordVersion}.`)
  }
  return manifest
}
