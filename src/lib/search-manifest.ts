import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { LineStatus } from '@/lib/urls'

/** Where one line's search and palette indexes are served, both under content-hashed paths. */
export interface SearchLine {
  line: string
  status: LineStatus
  /** The Pagefind bundle's directory; its `pagefind.js` is imported from here. */
  search: string
  /** The palette's symbol and page index, a JSON array. */
  palette: string
  documents: number
}

export interface SearchManifest {
  lines: SearchLine[]
}

/**
 * The search indexes built for this build, as `bun run search:build` recorded them. Server code
 * only. Empty when the indexes were not built, as in a dev server started without them.
 *
 * @param root - The directory holding `.search/`; the working directory by default.
 * @returns Every line's index paths, archived lines included.
 */
export function readSearchManifest(root = process.cwd()): SearchManifest {
  try {
    const manifest = JSON.parse(readFileSync(path.join(root, '.search', 'manifest.json'), 'utf8')) as SearchManifest
    return Array.isArray(manifest.lines) ? manifest : { lines: [] }
  } catch {
    return { lines: [] }
  }
}

/** The lines searched by default: every line but the archived ones, which are searched on request. */
export function defaultSearchLines(manifest: SearchManifest): SearchLine[] {
  return manifest.lines.filter(line => line.status !== 'archived')
}
