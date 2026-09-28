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

/**
 * Pages whose text isn't the site's to set: changelogs and migration guides name past releases'
 * commands, and the API reference is the package's own.
 */
const EXEMPT = /^\/docs\/[^/]+\/(?:changelog|migrating|api)(?:\/|$)/

/**
 * The line a page documents: the one its URL names, through `latest` and `next`, or the home page's
 * for the home page. Undefined for a page outside any line, or one exempt from the check.
 */
export function lineOfUrl(url: string, config: VersionsConfig, homeLine: string): string | undefined {
  const path = url.split(/[?#]/)[0]!
  if (EXEMPT.test(path)) return undefined
  if (path === '/') return homeLine
  const segment = /^\/docs\/([^/]+)/.exec(path)?.[1]
  if (!segment) return undefined
  const { latest, next } = aliases(config)
  const line = segment === 'latest' ? latest : segment === 'next' ? next : segment
  return config.lines.some(entry => entry.line === line) ? line : undefined
}

/** An HTML page's text as a reader reads it: tags dropped, so a highlighted command reads whole. */
export function htmlText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

/**
 * Each create command whose package spec isn't the one that installs its page's line, and each
 * placeholder left in the output. A command on a page outside any line has no line to install, and
 * counts too; exempt pages are skipped.
 */
export function commandProblems(texts: BuiltText[], config: VersionsConfig, homeLine: string): string[] {
  const problems: string[] = []
  for (const { file, url, text } of texts) {
    if (text.includes(PACKAGE_SPEC)) problems.push(`${file} (${url}): ${PACKAGE_SPEC} was left in the output`)
    if (EXEMPT.test(url.split(/[?#]/)[0]!)) continue
    const line = lineOfUrl(url, config, homeLine)
    const expected = line && packageSpec(config, line)
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
