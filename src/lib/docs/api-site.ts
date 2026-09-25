import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { JSONOutput } from 'typedoc'
import manifest from '../../../versions.json'
import { VERSIONS } from '@/config/versions'
import { ApiModel, type SinceData } from '@/lib/docs/api-model'
import { lineOf } from '@/lib/urls'

const semverParts = (version: string) => {
  const [core, pre] = version.split('-', 2)
  return { numbers: core.split('.').map(Number), pre }
}

/** Orders versions newest first, a release ahead of its prereleases. */
export function newestFirst(versions: readonly string[]): string[] {
  return [...versions].sort((a, b) => {
    const [x, y] = [semverParts(a), semverParts(b)]
    for (let index = 0; index < 3; index += 1) {
      if (x.numbers[index] !== y.numbers[index]) return y.numbers[index] - x.numbers[index]
    }
    if (!x.pre || !y.pre) return (x.pre ? 1 : 0) - (y.pre ? 1 : 0)
    return y.pre.localeCompare(x.pre, 'en', { numeric: true })
  })
}

/** Every version versions.json documents for a line, newest first. */
export function lineVersions(line: string): string[] {
  return newestFirst(manifest.lines.find(entry => entry.line === line)?.versions ?? [])
}

const apiFile = (version: string) => path.join(process.cwd(), 'generated', 'api', `${version}.json`)

let since: Record<string, SinceData> | undefined
function sinceData(): Record<string, SinceData> {
  if (!since) {
    const file = path.join(process.cwd(), 'generated', 'since.json')
    since = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, SinceData>) : {}
  }
  return since
}

const models = new Map<string, ApiModel | undefined>()

/**
 * The API a page shows: a line's, from its newest version, or with `version` that exact version's,
 * whose links stay on that version's pages. Undefined when the version has no generated API.
 */
export function apiModel(line: string, version?: string): ApiModel | undefined {
  const source = version ?? lineVersions(line)[0]
  if (!source || lineOf(source) !== line || !lineVersions(line).includes(source)) return undefined
  const key = `${line}@${version ?? ''}`
  if (!models.has(key)) {
    const file = apiFile(source)
    const project = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as { project: JSONOutput.ProjectReflection }).project
      : undefined
    models.set(key, project && new ApiModel(line, project, VERSIONS, sinceData(), version))
  }
  return models.get(key)
}

/** Every `{ line, entry, symbol }` a line's API page is prerendered for. */
export function apiParams(): { line: string; entry: string; symbol: string }[] {
  return VERSIONS.lines.flatMap(({ line }) => (apiModel(line)?.params() ?? []).map(param => ({ line, ...param })))
}

/** Every `{ line, version, entry, symbol }` an exact version's API page is prerendered for. */
export function exactApiParams(): { line: string; version: string; entry: string; symbol: string }[] {
  return VERSIONS.lines.flatMap(({ line }) =>
    lineVersions(line).flatMap(version =>
      (apiModel(line, version)?.params() ?? []).map(param => ({ line, version, ...param })),
    ),
  )
}
