/**
 * What a reader gets, checked after the build: every create command in the built pages, the search
 * index and the palette installs the line of the page it's on. It covers each way text reaches a page
 * (content, imported READMEs, components), where content:check reads only the sources.
 */

import { packageSpec, PACKAGE_SPEC } from './package-spec'
import { aliases, type VersionsConfig } from './versions'

/** Text as a reader gets it, and where: the page's URL, and the file it was read from. */
export interface BuiltText {
  file: string
  url: string
  text: string
  /** The lines of what a reader copies from it: its code blocks, or on an API page its examples. */
  code?: string[]
}

/** A create command, run through a package runner or not; the spec is its first group. */
const CREATE = /\b(?:(?:npx|bunx|pnpm dlx|yarn dlx)\s+)?(meocord(?:@[^\s<>"'`]+)?)\s+create\b/g

/** Changelogs and migration guides, which name the commands of releases before theirs. */
const EXEMPT = /^\/docs\/[^/]+\/(?:changelog|migrating)(?:\/|$)/

/**
 * The API reference, whose text is the package's own: its headings, usage lines and tables name the
 * binary. Only the copyable examples the site writes there, marked `data-example`, are checked.
 */
const API = /^\/docs\/([^/]+)\/api(?:\/([^/]+))?/

const pathOf = (url: string) => url.split(/[?#]/)[0]!

/**
 * The line a page documents: the one its URL names, through `latest` and `next`, or the home page's
 * for the home page. Undefined for a page outside any line.
 */
export function lineOfUrl(url: string, config: VersionsConfig, homeLine: string): string | undefined {
  const path = pathOf(url)
  if (path === '/') return homeLine
  const segment = /^\/docs\/([^/]+)/.exec(path)?.[1]
  if (!segment) return undefined
  const { latest, next } = aliases(config)
  const line = segment === 'latest' ? latest : segment === 'next' ? next : segment
  return config.lines.some(entry => entry.line === line) ? line : undefined
}

/**
 * What a page's create commands must install, and the spec that does: its line's newest version, or on an
 * exact version's API page that version.
 */
function expected(url: string, config: VersionsConfig, line: string): { target: string; spec: string } {
  const version = API.exec(pathOf(url))?.[2]
  if (version !== undefined && config.lines.some(entry => entry.versions.includes(version)))
    return { target: version, spec: `${config.package}@${version}` }
  return { target: line, spec: packageSpec(config, line) }
}

/**
 * A copied line that runs `meocord` itself, with one of its commands: a shell doesn't put a project's
 * `node_modules/.bin` on its path, so it runs only through a package runner or a package script.
 */
const BARE = /^(?:\$\s+)?meocord\s+(\S+)/

const decode = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/** An HTML page's text as a reader reads it: tags dropped, so a highlighted command reads whole. */
export function htmlText(html: string): string {
  return decode(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ''))
}

/** An API page's copyable examples, which carry their command in `data-example`. */
const examplesOf = (html: string) => [...html.matchAll(/\bdata-example="([^"]*)"/g)].map(match => decode(match[1]!))

/** What a built page gives a reader to run: its text, or on an API page only its copyable examples. */
export function pageText(url: string, html: string): string {
  return API.test(pathOf(url)) ? examplesOf(html).join('\n') : htmlText(html)
}

/** A code block of shell commands, as the site marks one; output and transcripts are text, or unmarked. */
const SHELL_BLOCK = /<pre\b[^>]*\bdata-language="(?:sh|shell|bash|zsh)"[^>]*>([\s\S]*?)<\/pre>/gi

/** The commands a reader copies from a built page: its shell blocks' lines, or on an API page its examples. */
export function pageCode(url: string, html: string): string[] {
  if (API.test(pathOf(url))) return examplesOf(html)
  return [...html.matchAll(SHELL_BLOCK)].flatMap(match => htmlText(match[1]!).split('\n'))
}

/** What the search index or the palette shows for a page: nothing for an API page, whose text is the package's. */
export function searchText(url: string, text: string): string {
  return API.test(pathOf(url)) ? '' : text
}

/**
 * Each create command whose package spec isn't the one that installs its page's line, each copyable
 * `meocord` command a shell can't run, naming one of `commands`, and each placeholder left in the output.
 * A create command on a page outside any line has no line to install, and counts too; changelogs and
 * migration guides are skipped.
 */
export function commandProblems(
  texts: BuiltText[],
  config: VersionsConfig,
  homeLine: string,
  commands: ReadonlySet<string>,
): string[] {
  const problems: string[] = []
  for (const { file, url, text, code = [] } of texts) {
    if (text.includes(PACKAGE_SPEC)) problems.push(`${file} (${url}): ${PACKAGE_SPEC} was left in the output`)
    if (EXEMPT.test(pathOf(url))) continue
    const line = lineOfUrl(url, config, homeLine)
    const wanted = line ? expected(url, config, line) : undefined
    for (const match of text.matchAll(CREATE)) {
      if (match[1] === wanted?.spec) continue
      const command = match[0].replace(/\s+/g, ' ')
      problems.push(
        wanted
          ? `${file} (${url}): "${command}" doesn't install ${wanted.target}; this page runs ${wanted.spec}`
          : `${file} (${url}): "${command}" is on a page of no line, so it installs no line in particular`,
      )
    }
    for (const copied of code) {
      const bare = BARE.exec(copied.trim())
      if (bare && commands.has(bare[1]!))
        problems.push(
          `${file} (${url}): "${copied.trim()}" doesn't run in a shell, which has no meocord on its path; ` +
            'write npx meocord, or run it from a package script',
        )
    }
  }
  return problems
}
