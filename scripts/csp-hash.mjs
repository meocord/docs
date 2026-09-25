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
