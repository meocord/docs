import { playgroundFor, readPlaygroundManifest } from '@/lib/playground-manifest'

// Read once when a build renders the pages: the built HTML names the frame, and the server never reads it again.
// A dev server reads it for every page, so a `playground:build` run after it started is picked up.
let manifest: ReturnType<typeof readPlaygroundManifest> | null = null

/** A line's playground frame, as `playground:build` wrote it, or undefined for a line with no runtime. */
export function playgroundFrame(line: string): string | undefined {
  if (manifest === null || process.env.NODE_ENV !== 'production') manifest = readPlaygroundManifest()
  return playgroundFor(manifest, line)?.frame
}
