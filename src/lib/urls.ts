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
  | { kind: 'guide'; line: string; slug: string; anchor?: string }
  /** A symbol in a line's API; with `version`, in that exact version's API instead. */
  | { kind: 'api'; line: string; entry: string; symbol: string; member?: string; version?: string }
  /** A line's changelog; with `version`, that version's own page. */
  | { kind: 'changelog'; line: string; version?: string }
  | { kind: 'migrating'; line: string; anchor?: string }
  /** The page shown for a page id a line does not have. */
  | { kind: 'missing'; line: string; id: string }

const LINE = /^\d+\.\d+$/
const VERSION = /^(\d+)\.(\d+)\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const ENTRY = /^(?:meocord\/)?([a-z][a-z0-9-]*)$/
const SYMBOL = /^[A-Za-z_$][\w$]*$/

/** The minor line a version belongs to: `4.1.0-beta.0` belongs to `4.1`. */
export function lineOf(version: string): string {
  const match = VERSION.exec(version)
  if (!match) throw new Error(`"${version}" is not a version.`)
  return `${match[1]}.${match[2]}`
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
 * @returns A path such as `/docs/latest/guards` or `/docs/4.1/api/decorator/Defer#options`.
 * @throws When the line is unknown, a version is outside its line, or a name is not valid in a URL.
 *
 * @example
 * docsHref({ kind: 'api', line: '4.1', entry: 'meocord/decorator', symbol: 'Defer' }, versions)
 * // '/docs/4.1/api/decorator/Defer' while 4.1 is in prerelease, '/docs/latest/api/decorator/Defer' once current
 */
export function docsHref(target: DocsTarget, versions: VersionsManifest): string {
  check(target.line, LINE, 'line')
  const segment = lineSegment(target.line, versions)

  switch (target.kind) {
    case 'line':
      return `/docs/${segment}`

    case 'guide':
      return withAnchor(`/docs/${segment}/${check(target.slug, SLUG, 'page slug')}`, target.anchor)

    case 'api': {
      const path = [entrySegment(target.entry), check(target.symbol, SYMBOL, 'symbol name')].join('/')
      const anchor = target.member === undefined ? undefined : memberAnchor(check(target.member, SYMBOL, 'member name'))
      if (target.version === undefined) return withAnchor(`/docs/${segment}/api/${path}`, anchor)
      if (lineOf(target.version) !== target.line) {
        throw new Error(`${target.version} is not a version of line ${target.line}.`)
      }
      // Exact versions are addressed by their own line: `latest` names a line, not a version.
      return withAnchor(`/docs/${target.line}/api/${target.version}/${path}`, anchor)
    }

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
