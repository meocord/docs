/**
 * The first-load JavaScript of each prerendered page: the scripts its HTML loads, gzipped as a
 * server sends them, against one budget per page.
 */

import { gzipSync } from 'zlib'

/** The budget for any one page, in bytes of gzipped JavaScript. */
export const BUDGET_BYTES = 220 * 1000

export interface PageBudget {
  page: string
  total: number
  chunks: { src: string; bytes: number }[]
}

/**
 * Every distinct same-origin script a page loads, in the order its HTML names them. A `nomodule`
 * script is left out: it is the polyfill bundle, which browsers with module support never fetch.
 */
export function pageScripts(html: string): string[] {
  const found = new Set<string>()
  for (const [tag, src] of html.matchAll(/<script\b[^>]*\bsrc="(\/_next\/[^"]+\.js)"[^>]*>/g)) {
    if (!/\bnomodule\b/i.test(tag)) found.add(src)
  }
  return [...found]
}

/** The gzipped size of a file's bytes, at the default level a server compresses with. */
export function gzipSize(bytes: Uint8Array): number {
  return gzipSync(bytes).byteLength
}

/** Each page's scripts and their total, given a page's HTML and a way to read a script's bytes. */
export function measure(pages: Record<string, string>, read: (src: string) => Uint8Array): PageBudget[] {
  const sizes = new Map<string, number>()
  const sizeOf = (src: string) => {
    if (!sizes.has(src)) sizes.set(src, gzipSize(read(src)))
    return sizes.get(src)!
  }
  return Object.entries(pages)
    .map(([page, html]) => {
      const chunks = pageScripts(html)
        .map(src => ({ src, bytes: sizeOf(src) }))
        .sort((a, b) => b.bytes - a.bytes || a.src.localeCompare(b.src))
      return { page, total: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0), chunks }
    })
    .sort((a, b) => b.total - a.total || a.page.localeCompare(b.page))
}

const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} KB`

/** The report: every page's total against the budget, then the heaviest page's chunks. */
export function report(results: PageBudget[], budget = BUDGET_BYTES): { text: string; over: PageBudget[] } {
  const over = results.filter(result => result.total > budget)
  const width = Math.max(4, ...results.map(result => result.page.length))
  const lines = [`First-load JS per page (gzip), budget ${kb(budget)}:`, '']
  for (const result of results) {
    const mark = result.total > budget ? 'OVER' : 'ok  '
    lines.push(
      `  ${mark}  ${result.page.padEnd(width)}  ${kb(result.total).padStart(9)}  (${result.chunks.length} script${result.chunks.length === 1 ? '' : 's'})`,
    )
  }
  for (const result of over.length > 0 ? over : results.slice(0, 1)) {
    lines.push('', `Chunks of ${result.page}:`)
    for (const chunk of result.chunks) lines.push(`  ${kb(chunk.bytes).padStart(9)}  ${chunk.src}`)
  }
  return { text: lines.join('\n'), over }
}
