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

/** The spec a page's create commands must run: its exact version's on an exact version's API page. */
function expectedSpec(url: string, config: VersionsConfig, line: string): string {
  const version = API.exec(pathOf(url))?.[2]
  const exact = version !== undefined && config.lines.some(entry => entry.versions.includes(version))
  return exact ? `${config.package}@${version}` : packageSpec(config, line)
}

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

/** What a built page gives a reader to run: its text, or on an API page only its copyable examples. */
export function pageText(url: string, html: string): string {
  if (!API.test(pathOf(url))) return htmlText(html)
  return [...html.matchAll(/\bdata-example="([^"]*)"/g)].map(match => decode(match[1]!)).join('\n')
}

/** What the search index or the palette shows for a page: nothing for an API page, whose text is the package's. */
export function searchText(url: string, text: string): string {
  return API.test(pathOf(url)) ? '' : text
}

/**
 * Each create command whose package spec isn't the one that installs its page's line, and each
 * placeholder left in the output. A command on a page outside any line has no line to install, and
 * counts too; changelogs and migration guides are skipped.
 */
export function commandProblems(texts: BuiltText[], config: VersionsConfig, homeLine: string): string[] {
  const problems: string[] = []
  for (const { file, url, text } of texts) {
    if (text.includes(PACKAGE_SPEC)) problems.push(`${file} (${url}): ${PACKAGE_SPEC} was left in the output`)
    if (EXEMPT.test(pathOf(url))) continue
    const line = lineOfUrl(url, config, homeLine)
    const expected = line && expectedSpec(url, config, line)
    for (const match of text.matchAll(CREATE)) {
      if (match[1] === expected) continue
      const command = match[0].replace(/\s+/g, ' ')
      problems.push(
        expected
          ? `${file} (${url}): "${command}" doesn't install ${line}; its pages run ${expected}`
          : `${file} (${url}): "${command}" is on a page of no line, so it installs no line in particular`,
      )
    }
  }
  return problems
}
