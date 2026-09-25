/**
 * Links as content stores them: always naming the line, never `latest` or `next`, built and read
 * through the site's own URL module so the two cannot disagree. The site maps them to what it
 * emits with resolveStoredHref.
 */

import { docsHref, type DocsTarget } from '../../src/lib/urls.js'

/** The stored form of a link: docsHref for a line that is not current, so it names the line. */
export function storedHref(target: DocsTarget): string {
  return docsHref(target, { lines: [{ line: target.line, status: 'maintained' }] })
}

const STORED = /^\/docs\/([^/#?]+)(?:\/([^#?]*))?(?:#(.*))?$/

/**
 * What a stored link points at, or why it cannot be one: it must name a documented line, not an
 * alias, and be exactly the form storedHref writes for its target.
 */
export function parseStored(href: string, lines: readonly string[]): { target: DocsTarget } | { problem: string } {
  const match = STORED.exec(href)
  if (!match) return { problem: 'is not a docs link' }
  const [, line, path = '', anchor] = match
  if (line === 'latest' || line === 'next') {
    return { problem: `names ${line}; a stored link names its line, which keeps its meaning when statuses change` }
  }
  if (!lines.includes(line)) return { problem: 'names a version the site does not document' }

  const parts = path.split('/')
  let target: DocsTarget
  if (path === '' && anchor === undefined) {
    target = { kind: 'line', line }
  } else if (parts[0] === 'api') {
    const [, ...rest] = parts
    const version = /^\d+\.\d+\.\d+/.test(rest[0] ?? '') ? rest.shift() : undefined
    const [entry = '', symbol = '', ...extra] = rest
    if (extra.length > 0) return { problem: 'has more path than an API link takes' }
    target = { kind: 'api', line, entry, symbol, member: anchor, version }
  } else if (parts[0] === 'changelog' && parts.length === 1) {
    target = { kind: 'changelog', line, version: anchor?.startsWith('v') ? anchor.slice(1) : anchor }
  } else if (parts[0] === 'migrating' && parts.length === 1) {
    target = { kind: 'migrating', line, anchor }
  } else if (parts[0] === 'missing' && parts.length === 2) {
    target = { kind: 'missing', line, id: parts[1] }
  } else if (parts.length === 1 && parts[0] !== '') {
    target = { kind: 'guide', line, slug: parts[0], anchor }
  } else {
    return { problem: 'names no page' }
  }

  let expected: string
  try {
    expected = storedHref(target)
  } catch (error) {
    return { problem: `is not a valid link: ${error instanceof Error ? error.message : String(error)}` }
  }
  return expected === href ? { target } : { problem: `is not in its stored form, ${expected}` }
}
