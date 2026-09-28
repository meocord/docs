/**
 * What the post-build check finds wrong with a page's playgrounds. A playground renders without its
 * frame when the build had no runtime for its line, which a dev server may do but a production build
 * must not: its Run would be missing. One that names a frame names a file the build wrote.
 */

import { existsSync } from 'fs'
import path from 'path'

const FRAME = /^\/playground\/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\.[0-9a-f]{10}\.html$/

/** The problems with the playgrounds in one built page's HTML; `publicDir` is where its frames are served from. */
export function playgroundProblems(file: string, html: string, publicDir: string): string[] {
  const problems: string[] = []
  // Each embed names its line's frame, and so does the playground page
  const embeds = playgroundCount(html)
  const unavailable = html.match(/\bdata-playground-unavailable=/g)?.length ?? 0
  const frames = [...html.matchAll(/\bdata-playground-src="([^"]*)"/g)].map(match => match[1])
  if (unavailable > 0)
    problems.push(
      `${file}: ${unavailable} playground(s) rendered without the line's runtime; run playground:build before next build`,
    )
  if (embeds !== unavailable + frames.length)
    problems.push(`${file}: ${embeds - unavailable - frames.length} playground(s) name no frame`)
  for (const frame of frames) {
    if (!FRAME.test(frame)) problems.push(`${file}: a playground names "${frame}", which is not a playground frame`)
    else if (!existsSync(path.join(publicDir, frame)))
      problems.push(`${file}: a playground names ${frame}, which the build did not write`)
  }
  return problems
}

/** How many playgrounds a built page has: its embeds, and the playground page's own. */
export function playgroundCount(html: string): number {
  return html.match(/\bdata-playground-(?:embed|page)=/g)?.length ?? 0
}
