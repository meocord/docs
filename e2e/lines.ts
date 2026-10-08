import { HOME_LINE } from '../src/config/home'
import { CURRENT_LINE, VERSIONS } from '../src/config/versions'
import { lineSegment } from '../src/lib/urls'

// Each line's docs root as versions.json gives it: `/docs/latest` for the current line
export const docs41 = `/docs/${lineSegment('4.1', VERSIONS)}`
export const docs40 = `/docs/${lineSegment('4.0', VERSIONS)}`
// The current line's docs root, and the one the home page shows
export const docsCurrent = `/docs/${lineSegment(CURRENT_LINE, VERSIONS)}`
export const docsHome = `/docs/${lineSegment(HOME_LINE, VERSIONS)}`

/** `path` as a pattern that matches it literally. */
export const literal = (path: string): string => path.replaceAll('.', '\\.')
