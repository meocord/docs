import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { JSONOutput } from 'typedoc'
import manifest from '../../../versions.json'
import { guideRendered } from '../../../scripts/lib/guide'
import { VERSIONS } from '@/config/versions'
import type { Layouts } from '@/lib/docs/api-layout'
import { API_KINDS, ApiModel, type ApiScheme, type ApiSection, type SinceData } from '@/lib/docs/api-model'
import { cliManifest, cliSection } from '@/lib/docs/cli-site'
import { GLANCE_TOPICS, glanceSection } from '@/lib/docs/glance'
import { docsHref, lineOf, olderLines, resolveStoredHref } from '@/lib/urls'

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

/** How a line's API is arranged: by kind where its Guide is rendered, otherwise by entry point. */
export function apiArrangement(line: string): ApiScheme['by'] {
  return guideRendered(line) ? 'kind' : 'entry'
}

/**
 * The kinds of symbols an older release had and the newest does not. Releases before the `@group` tags
 * take each symbol's kind from the newest release; these are the ones it cannot give.
 */
const REMOVED_KINDS: Record<string, string> = {
  AutocompleteMetadata: 'Types',
  CommandMetadata: 'Types',
  MetadataKey: 'Types',
  PIPED_BRAND: 'Types',
}

/** The `@group` of each symbol in a line's newest release, which a by-kind older release falls back on. */
function newestGroups(line: string): Map<string, string> {
  const groups = new Map<string, string>()
  for (const section of apiModel(line, undefined, 'kind')?.sections() ?? []) {
    const group = API_KINDS.find(kind => kind.slug === section.slug)!.group
    for (const symbol of section.symbols) groups.set(symbol.name, group)
  }
  return groups
}

const models = new Map<string, ApiModel | undefined>()

/**
 * The API a page shows: a line's, from its newest version, or with `version` that exact version's,
 * whose links stay on that version's pages. Undefined when the version has no generated API. It is
 * arranged as `apiArrangement` says for the line, unless `by` says otherwise.
 */
export function apiModel(line: string, version?: string, by = apiArrangement(line)): ApiModel | undefined {
  const source = version ?? lineVersions(line)[0]
  if (!source || lineOf(source) !== line || !lineVersions(line).includes(source)) return undefined
  const key = `${line}@${version ?? ''}@${by}`
  if (!models.has(key)) {
    const file = apiFile(source)
    const project = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as { project: JSONOutput.ProjectReflection }).project
      : undefined
    const scheme: ApiScheme =
      by === 'entry'
        ? { by }
        : { by, groupOf: version ? name => newestGroups(line).get(name) ?? REMOVED_KINDS[name] : undefined }
    models.set(key, project && new ApiModel(line, project, VERSIONS, sinceData(), version, scheme))
  }
  return models.get(key)
}

/**
 * An API's sections as its pages list them: the model's, and where it is arranged by kind, in the kinds'
 * order, the CLI's commands for a version whose package ships the CLI's manifest, and the line's cheat
 * sheets first, which an exact version's API doesn't have.
 */
export function apiSections(model: ApiModel): ApiSection[] {
  const sections = model.sections()
  if (model.scheme.by !== 'kind') return sections
  const manifest = cliManifest(model.version ?? lineVersions(model.line)[0])
  const order = (slug: string) => API_KINDS.findIndex(kind => kind.slug === slug)
  return [
    ...(model.version ? [] : [glanceSection(model.line)]),
    ...sections,
    ...(manifest ? [cliSection(model.line, manifest, model.version)] : []),
  ].sort((a, b) => order(a.slug) - order(b.slug))
}

/** Every `{ line, topic }` a cheat sheet is prerendered for, in the lines whose API is arranged by kind. */
export function glanceParams(): { line: string; topic: string }[] {
  return VERSIONS.lines
    .filter(({ line }) => apiArrangement(line) === 'kind')
    .flatMap(({ line }) => GLANCE_TOPICS.map(topic => ({ line, topic: topic.slug })))
}

/**
 * Where a line's API reference opens: its index where the API is arranged by kind; otherwise
 * `MeoCordFactory` in meocord/core, where every app starts, or the first entry point's first symbol
 * for a line without it. Undefined for a line without an API.
 */
export function apiLandingHref(line: string): string | undefined {
  const sections = apiModel(line)?.sections() ?? []
  if (sections.length === 0) return undefined
  if (apiArrangement(line) === 'kind') return docsHref({ kind: 'api-index', line }, VERSIONS)
  const factory = sections
    .find(section => section.title === 'meocord/core')
    ?.symbols.find(symbol => symbol.name === 'MeoCordFactory')
  return (factory ?? sections[0]?.symbols[0])?.href
}

// A stored link to an API page names its entry point: `/docs/4.1/api/core/MeoCordFactory#create`
const STORED_API = /^\/docs\/(\d+\.\d+)\/api\/(?:(\d+\.\d+\.\d+[^/]*)\/)?([a-z][a-z0-9-]*)\/([A-Za-z_$][\w$]*)(#.*)?$/

/**
 * The href a stored link renders with, as `resolveStoredHref` gives it, and a link to an API page by
 * its entry point, as content and generated data store it, sent to its page where the line's API is
 * arranged by kind.
 */
export function resolveSiteHref(href: string): string {
  const match = STORED_API.exec(href)
  const moved = match && movedApiHref(match[1], match[2], match[3], match[4])
  return moved ? `${moved}${match[5] ?? ''}` : resolveStoredHref(href, VERSIONS)
}

/**
 * Where an API page by its entry point, `[<version>/]<entry>/<symbol>`, lives in a line whose API is
 * arranged by kind; undefined where the line is arranged by entry point, or the symbol is filed under
 * the same segment.
 */
export function movedApiHref(line: string, version: string | undefined, entry: string, symbol: string) {
  if (apiArrangement(line) !== 'kind') return undefined
  const model = apiModel(line, version)
  const location = model?.locate(entry, symbol)
  return model && location && location.section !== entry ? model.href(location) : undefined
}

/**
 * Where a symbol this line's API lacks is documented, as an old `latest` URL reaches the line once it is current: the
 * newest older line's page for it, by the URL's section, as an entry point or a kind, or by its name alone. Undefined
 * when no older line has it.
 */
export function olderApiHref(line: string, section: string, symbol: string): string | undefined {
  for (const other of olderLines(line, VERSIONS)) {
    const model = apiModel(other)
    if (!model) continue
    const location = model.symbol(section, symbol)
      ? { section, symbol }
      : (model.locate(section, symbol) ?? model.find(symbol))
    if (location) return model.href(location)
  }
  return undefined
}

const layouts = new Map<string, Layouts>()

/**
 * The formatted code for the API `apiModel(line, version)` shows, as `bun run api:layout` wrote it.
 * A production build or server without it fails, so no page ships its code unformatted; a dev server
 * started without it shows each display on one line.
 */
export function apiLayouts(
  line: string,
  version?: string,
  production = process.env.NODE_ENV === 'production',
): Layouts {
  const source = version ?? lineVersions(line)[0]
  if (!source) return {}
  if (!layouts.has(source)) {
    const file = path.join(process.cwd(), '.api-layout', `${source}.json`)
    if (existsSync(file)) layouts.set(source, JSON.parse(readFileSync(file, 'utf8')) as Layouts)
    else if (production) throw new Error(`No formatted code for ${source} at ${file}: run \`bun run api:layout\`.`)
    else layouts.set(source, {})
  }
  return layouts.get(source)!
}

/** Every `{ line, section, symbol }` a line's API page is prerendered for. */
export function apiParams(): { line: string; section: string; symbol: string }[] {
  return VERSIONS.lines.flatMap(({ line }) => (apiModel(line)?.params() ?? []).map(param => ({ line, ...param })))
}

/** Every `{ line, section }` a kind's page is prerendered for, in the lines whose API is arranged by kind. */
export function apiKindParams(): { line: string; section: string }[] {
  return VERSIONS.lines
    .filter(({ line }) => apiArrangement(line) === 'kind')
    .flatMap(({ line }) => {
      const model = apiModel(line)
      return (model ? apiSections(model) : []).map(section => ({ line, section: section.slug }))
    })
}

/**
 * Every CLI command's page to prerender, in the lines whose API is arranged by kind: the line's, and each
 * exact version's that ships the CLI's manifest.
 */
export function cliParams(): { line: string; version?: string; command: string }[] {
  return VERSIONS.lines
    .filter(({ line }) => apiArrangement(line) === 'kind')
    .flatMap(({ line }) => [
      ...(cliManifest(lineVersions(line)[0])?.commands ?? []).map(command => ({ line, command: command.name })),
      ...lineVersions(line).flatMap(version =>
        (cliManifest(version)?.commands ?? []).map(command => ({ line, version, command: command.name })),
      ),
    ])
}

/** Every `{ line, version, section, symbol }` an exact version's API page is prerendered for. */
export function exactApiParams(): { line: string; version: string; section: string; symbol: string }[] {
  return VERSIONS.lines.flatMap(({ line }) =>
    lineVersions(line).flatMap(version =>
      (apiModel(line, version)?.params() ?? []).map(param => ({ line, version, ...param })),
    ),
  )
}
