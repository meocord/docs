/**
 * Lays a directory tree out somewhere else without copying its bytes: each file a hard link, each symbolic link
 * kept as written. `bun run serve` lays out the standalone build this way, as the Dockerfile lays out /app.
 */
import { constants, copyFileSync, linkSync, mkdirSync, readdirSync, readlinkSync, symlinkSync } from 'node:fs'
import path from 'node:path'

/** Makes a hard link at `to`; a spec passes its own to stand in for one across filesystems. */
export type Link = (from: string, to: string) => void

/**
 * A layout that places files and trees: by hard link, since the build's prerendered pages run to gigabytes, and by
 * copy once a hard link fails across filesystems (EXDEV). A target that already exists is an error, never replaced.
 */
export function createLayout(link: Link = linkSync) {
  let copying = false

  /** Places one file at `to`. */
  function place(from: string, to: string) {
    if (!copying) {
      try {
        return link(from, to)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
        copying = true
      }
    }
    copyFileSync(from, to, constants.COPYFILE_EXCL)
  }

  /** Mirrors the tree at `from` into `to`, links as written: made absolute, they would point back at `from`. */
  function mirror(from: string, to: string) {
    mkdirSync(to, { recursive: true })
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const [source, target] = [path.join(from, entry.name), path.join(to, entry.name)]
      if (entry.isSymbolicLink()) symlinkSync(readlinkSync(source), target)
      else if (entry.isDirectory()) mirror(source, target)
      else place(source, target)
    }
  }

  return { place, mirror }
}
