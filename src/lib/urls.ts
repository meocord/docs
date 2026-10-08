/**
 * Every URL the site links to, built in one place from the versions manifest. Stored content always
 * names a line (`/docs/4.0/…`); these functions map it to the URL emitted at render, which uses
 * `latest` while the line is current, so a status change in versions.json moves every link with no
 * other edit. `next` is a redirect only and is never emitted.
 */

/** A line's standing, as versions.json records it. */
export type LineStatus = 'prerelease' | 'current' | 'maintained' | 'archived'

/** The part of versions.json these URLs depend on. */
export interface VersionsManifest {
  lines: readonly { line: string; status: LineStatus }[]
}

/** A page or place on the site, by what it is rather than where it lives. */
export type DocsTarget =
  /** A line's first page, where the version switcher lands. */
  | { kind: 'line'; line: string }
  /** A guide page; `group` places a recipe or coming-from page of the Guide's appendix under its own path. */
  | { kind: 'guide'; line: string; slug: string; anchor?: string; group?: 'recipes' | 'coming-from' }
  /**
   * A symbol in a line's API; with `version`, in that exact version's API instead. `section` is the
   * entry point that exports it, or its kind where the line's API is arranged by kind.
   */
  | { kind: 'api'; line: string; section: string; symbol: string; member?: string; version?: string }
  /** A line's API index, or with `section` one kind's page of it. */
  | { kind: 'api-index'; line: string; section?: string }
  /** A line's changelog; with `version`, that version's own page. */
  | { kind: 'changelog'; line: string; version?: string }
  | { kind: 'migrating'; line: string; anchor?: string }
  /** The page shown for a page id a line does not have. */
  | { kind: 'missing'; line: string; id: string }
  /** A line's playground; `code` is a share link's fragment, which carries code and inputs to it. */
  | { kind: 'playground'; line: string; code?: string }

const LINE = /^\d+\.\d+$/
/** A share link's fragment, which carries a playground's code: `v1.<code>`. */
export const SHARED_CODE = /^v\d+\.[\w-]+$/
const VERSION = /^(\d+)\.(\d+)\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const ENTRY = /^(?:meocord\/)?([a-z][a-z0-9-]*)$/
const SYMBOL = /^[A-Za-z_$][\w$]*$/
// A member by its name, or by its anchor where the page moved it clear of another id: `content-member`
const MEMBER = /^[A-Za-z_$][\w$-]*$/

/** The minor line a version belongs to: `4.1.0-beta.0` belongs to `4.1`. */
export function lineOf(version: string): string {
  const match = VERSION.exec(version)
  if (!match) throw new Error(`"${version}" is not a version.`)
  return `${match[1]}.${match[2]}`
}

/**
 * The line an exact version belongs to, when a URL puts it under another line, as an old `latest` URL does once
 * another line is current: `/docs/latest/api/4.0.0/…` reaches 4.1. Undefined for the line's own version, a version of
 * a line versions.json does not list, and anything that is no version.
 */
export function versionElsewhere(line: string, version: string, versions: VersionsManifest): string | undefined {
  if (!VERSION.test(version)) return undefined
  const owner = lineOf(version)
  return owner !== line && versions.lines.some(entry => entry.line === owner) ? owner : undefined
}

/** The lines versions.json lists before `line`, newest first. */
export function olderLines(line: string, versions: VersionsManifest): string[] {
  const rank = (value: string) => value.split('.').map(Number) as [number, number]
  const before = (a: string, b: string) => {
    const [aMajor, aMinor] = rank(a)
    const [bMajor, bMinor] = rank(b)
    return aMajor < bMajor || (aMajor === bMajor && aMinor < bMinor)
  }
  return versions.lines
    .map(entry => entry.line)
    .filter(other => before(other, line))
    .sort((a, b) => (before(a, b) ? 1 : -1))
}

/**
 * The upgrade guide's section a reader of `line` starts from: upgrading from it to the next line versions.json lists,
 * such as `upgrading-from-41-to-42`. Undefined for the newest line.
 */
export function upgradeSection(line: string, versions: VersionsManifest): string | undefined {
  const next = versions.lines.find(entry => olderLines(entry.line, versions)[0] === line)?.line
  return next && `upgrading-from-${line.replace('.', '')}-to-${next.replace('.', '')}`
}

/** The path segment for a line: `latest` for the current line, otherwise the line itself. */
export function lineSegment(line: string, versions: VersionsManifest): string {
  const entry = versions.lines.find(candidate => candidate.line === line)
  if (!entry) throw new Error(`Line "${line}" is not in versions.json.`)
  return entry.status === 'current' ? 'latest' : line
}

/** The URL segment for an entry point: `meocord/core` and `core` both give `core`. */
export function entrySegment(entry: string): string {
  const match = ENTRY.exec(entry)
  if (!match) throw new Error(`"${entry}" is not a meocord entry point.`)
  return match[1]
}

/** The URL segment for an API section: an entry point's, as `entrySegment` gives it, or a kind's own slug. */
export const sectionSegment = entrySegment

/** The id a member's heading carries on its symbol's page, and so its anchor. */
export function memberAnchor(member: string): string {
  return member.toLowerCase()
}

/** The id of a changelog section's heading on its release's page: `Patch Changes` gives `patch-changes`. */
export function changelogSectionAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function check(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error(`"${value}" is not a valid ${what}.`)
  return value
}

const withAnchor = (path: string, anchor?: string) => (anchor ? `${path}#${encodeURIComponent(anchor)}` : path)

/**
 * The site-relative URL of a docs page or place.
 *
 * @param target - What to link to.
 * @param versions - The versions manifest, which decides whether a line is addressed as `latest`.
 * @returns A path such as `/docs/latest/guards` or `/docs/4.1/api/decorators/Defer#options`.
 * @throws When the line is unknown, a version is outside its line, or a name is not valid in a URL.
 *
 * @example
 * docsHref({ kind: 'api', line: '4.1', section: 'decorators', symbol: 'Defer' }, versions)
 * // '/docs/4.1/api/decorators/Defer' while 4.1 is in prerelease, '/docs/latest/api/decorators/Defer' once current
 */
export function docsHref(target: DocsTarget, versions: VersionsManifest): string {
  check(target.line, LINE, 'line')
  const segment = lineSegment(target.line, versions)

  switch (target.kind) {
    case 'line':
      return `/docs/${segment}`

    case 'guide':
      return withAnchor(
        `/docs/${segment}/${target.group ? `${target.group}/` : ''}${check(target.slug, SLUG, 'page slug')}`,
        target.anchor,
      )

    case 'api': {
      const path = [sectionSegment(target.section), check(target.symbol, SYMBOL, 'symbol name')].join('/')
      const anchor = target.member === undefined ? undefined : memberAnchor(check(target.member, MEMBER, 'member name'))
      if (target.version === undefined) return withAnchor(`/docs/${segment}/api/${path}`, anchor)
      if (lineOf(target.version) !== target.line) {
        throw new Error(`${target.version} is not a version of line ${target.line}.`)
      }
      // Exact versions are addressed by their own line: `latest` names a line, not a version.
      return withAnchor(`/docs/${target.line}/api/${target.version}/${path}`, anchor)
    }

    case 'api-index':
      return `/docs/${segment}/api${target.section === undefined ? '' : `/${sectionSegment(target.section)}`}`

    case 'changelog': {
      if (target.version !== undefined && lineOf(target.version) !== target.line) {
        throw new Error(`${target.version} is not a version of line ${target.line}.`)
      }
      return target.version === undefined
        ? `/docs/${segment}/changelog`
        : `/docs/${segment}/changelog/${target.version}`
    }

    case 'migrating':
      return withAnchor(`/docs/${segment}/migrating`, target.anchor)

    case 'missing':
      return `/docs/${target.line}/missing/${check(target.id, SLUG, 'page id')}`

    case 'playground':
      return `/docs/${segment}/playground${target.code === undefined ? '' : `#${check(target.code, SHARED_CODE, 'share code')}`}`
  }
}

const STORED = /^\/docs\/(\d+\.\d+)(?=[/?#]|$)(.*)$/s
// Paths that name a version or a line on purpose: an exact version's API, and a line's missing page.
const LINE_BOUND = /^\/(?:api\/\d+\.\d+\.\d+[^/]*\/|missing\/)/

/**
 * The emitted form of a line-explicit href stored in content or generated data: `/docs/<line>/…`
 * becomes `/docs/latest/…` while that line is current. Anything else is returned as it is: other
 * lines, exact-version API pages, missing pages, unknown lines and hrefs outside the docs.
 *
 * @param href - An href as stored, such as `/docs/4.1/guards#options`.
 * @param versions - The versions manifest.
 * @returns The href to render.
 *
 * @example
 * resolveStoredHref('/docs/4.1/guards', versions) // '/docs/latest/guards' once 4.1 is current
 */
export function resolveStoredHref(href: string, versions: VersionsManifest): string {
  const match = STORED.exec(href)
  if (!match) return href
  const [, line, rest] = match
  if (LINE_BOUND.test(rest)) return href
  const entry = versions.lines.find(candidate => candidate.line === line)
  return entry?.status === 'current' ? `/docs/latest${rest}` : href
}

const LATEST_PATH = /^\/docs\/latest(?=[/?#]|$)(.*)$/s
const EXACT_API = /^\/api\/([^/?#]+)\//
const MISSING = /^\/missing\//

/**
 * The one URL a docs path answers at. The current line's number URL is its `latest` URL, as `resolveStoredHref` emits
 * it; a page bound to its line by design, reached through `latest`, is at its line's number: an exact version's API
 * under its version's line, a missing page under the current line. Any other path is its own.
 *
 * @example
 * canonicalDocsPath('/docs/4.1/guards', versions) // '/docs/latest/guards' while 4.1 is current
 * canonicalDocsPath('/docs/latest/api/4.0.0/core/Logger', versions) // '/docs/4.0/api/4.0.0/core/Logger'
 */
export function canonicalDocsPath(pathname: string, versions: VersionsManifest): string {
  const latest = LATEST_PATH.exec(pathname)
  if (!latest) return resolveStoredHref(pathname, versions)
  const rest = latest[1]
  const version = EXACT_API.exec(rest)?.[1]
  if (version && VERSION.test(version) && versions.lines.some(entry => entry.line === lineOf(version))) {
    return `/docs/${lineOf(version)}${rest}`
  }
  const current = versions.lines.find(entry => entry.status === 'current')?.line
  return current && MISSING.test(rest) ? `/docs/${current}${rest}` : pathname
}
