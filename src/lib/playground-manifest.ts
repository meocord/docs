import { readFileSync } from 'node:fs'
import path from 'node:path'

/** One line's playground runtime: the meocord version it carries, and where the bundle is served. */
export interface PlaygroundLine {
  line: string
  /** The line's examples' exact pin. */
  version: string
  /** A classic script under a path that carries the hash of its bytes. */
  runtime: string
  /** The sandboxed document the page embeds, which runs this runtime in a Worker. */
  frame: string
  /** Its gzipped size, what the first Run downloads before the compiler. */
  gzip: number
}

export interface PlaygroundManifest {
  /** swc's WebAssembly, which every line's runtime compiles with. */
  swc: string
  lines: PlaygroundLine[]
}

/**
 * The playground runtimes built for this build, as `bun run playground:build` recorded them. Server
 * code only. Undefined when they were not built, as in a dev server started without them.
 *
 * @param root - The directory holding `.playground/`; the working directory by default.
 */
export function readPlaygroundManifest(root = process.cwd()): PlaygroundManifest | undefined {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(root, '.playground', 'manifest.json'), 'utf8'),
    ) as PlaygroundManifest
    return typeof manifest.swc === 'string' && Array.isArray(manifest.lines) ? manifest : undefined
  } catch {
    return undefined
  }
}

/** A line's runtime and the compiler it runs with, or undefined for a line the playground doesn't cover. */
export function playgroundFor(
  manifest: PlaygroundManifest | undefined,
  line: string,
): { frame: string; runtime: string; swc: string; version: string } | undefined {
  const entry = manifest?.lines.find(each => each.line === line)
  return entry && manifest && { frame: entry.frame, runtime: entry.runtime, swc: manifest.swc, version: entry.version }
}
