import { createHash } from 'node:crypto'

/** The placeholder src/proxy.ts leaves in `script-src`, replaced with the hashes of what was sent. */
export const MARKER = "'__CSP_HASHES__'"

/** Inline `<script>` only: one with a `src` is covered by `'self'`. */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g

/**
 * The `'sha256-…'` sources for every distinct inline script in a document.
 * @param {string} html
 */
export function hashesFor(html) {
  const seen = new Set()
  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    seen.add(createHash('sha256').update(body, 'utf8').digest('base64'))
  }
  return [...seen].map(hash => `'sha256-${hash}'`).join(' ')
}

/**
 * The policy with the marker replaced by the document's hashes, or removed when there is no document.
 * @param {string} csp
 * @param {string} [html]
 * @returns {string}
 */
export function fillPolicy(csp, html) {
  if (html === undefined) return csp.replace(` ${MARKER}`, '').replace(`${MARKER} `, '').replace(MARKER, '')
  const hashes = hashesFor(html)
  return hashes ? csp.replace(MARKER, hashes) : fillPolicy(csp)
}

/**
 * The policy to send on a response this does not hash, or undefined to send none. A 304 or a HEAD
 * has no body to hash, and a 304's headers replace the cached response's: a policy without hashes
 * there would block the cached page's inline scripts. Sending none keeps the cached policy, which
 * matches the cached bytes, since the ETag is unchanged and this never alters a body.
 * @param {string | undefined} csp
 * @param {boolean} bodiless
 * @returns {string | undefined}
 */
export function passthroughPolicy(csp, bodiless) {
  if (!csp?.includes(MARKER)) return csp
  return bodiless ? undefined : fillPolicy(csp)
}

/** The `script-src` directive carrying the marker, as the policy writes it; not `script-src-elem` or `-attr`. */
const SCRIPT_DIRECTIVE = /(^|;\s*)(script-src(?![-\w])[^;]*)/

/** Where the policy's meta tag goes: after the charset declaration, so that stays in the first 1024 bytes. */
const HEAD_START = /<head(?:\s[^>]*)?>(?:\s*<meta\s+charset=["']?[\w-]+["']?\s*\/?>)?/i

/** @param {string} value */
const attribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/**
 * The document's policy split in two, so the header's size never depends on the page. The header
 * keeps every directive, with `script-src` allowing its own sources and inline scripts; a
 * `<meta http-equiv>` at the top of `<head>` carries `script-src` with the inline scripts' hashes.
 * A browser enforces both, so an inline script runs only when its hash is listed.
 *
 * Undefined when the document has no `<head>` to carry the meta, a script comes before the place
 * it would go, or the policy has no marked `script-src`: the caller then sends the whole policy in
 * the header, as fillPolicy fills it.
 * @param {string} csp
 * @param {string} html
 * @returns {{ header: string, html: string } | undefined}
 */
export function splitPolicy(csp, html) {
  const directive = SCRIPT_DIRECTIVE.exec(csp)?.[2]
  const start = HEAD_START.exec(html)
  if (!directive?.includes(MARKER) || !start) return undefined
  // A meta policy governs only what follows it: a script before it would run under the header alone.
  if (/<script\b|<link\b[^>]*\bmodulepreload\b/i.test(html.slice(0, start.index + start[0].length))) return undefined
  const sources = directive.replace(/\s*'__CSP_HASHES__'/, '').trim()
  const hashes = hashesFor(html)
  const header = csp.replace(directive, `${sources} 'unsafe-inline'`)
  const meta = `<meta http-equiv="Content-Security-Policy" content="${attribute(`${sources}${hashes ? ` ${hashes}` : ''}`)}">`
  return { header, html: html.replace(HEAD_START, start => start + meta) }
}
