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
