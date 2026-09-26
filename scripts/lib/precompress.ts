/**
 * Brotli copies of the build's immutable text assets, written beside each file as `<file>.br` at the
 * highest quality, for a server to send in place of compressing on every request. Pages are left out:
 * the CSP proxy writes each page's hashes into its `<head>` as it serves it, so no file holds the
 * bytes a reader receives.
 */

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { promisify } from 'util'
import { brotliCompress, brotliDecompressSync, constants } from 'zlib'

/** The text assets worth a brotli copy; fonts and Pagefind's index files arrive compressed already. */
export const COMPRESSIBLE = /\.(?:js|mjs|css|json)$/

const compress = promisify(brotliCompress)

/** Every compressible file under `roots`, and every `.br` beside one, as paths. */
function walk(roots: string[]): { sources: string[]; copies: string[] } {
  const sources: string[] = []
  const copies: string[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const file = path.join(entry.parentPath, entry.name)
      if (file.endsWith('.br')) copies.push(file)
      else if (COMPRESSIBLE.test(file)) sources.push(file)
    }
  }
  return { sources: sources.sort(), copies: copies.sort() }
}

export interface PrecompressResult {
  /** Files that got a `.br` copy. */
  written: number
  /** Files whose brotli copy would be no smaller, so they keep none. */
  skipped: number
  /** Bytes of the files that got a copy, and of their copies. */
  sourceBytes: number
  brotliBytes: number
}

/**
 * Writes a quality-11 `.br` beside each compressible file under `roots`, compressing in parallel, and
 * removes any `.br` that would be no smaller than its source or whose source is gone.
 */
export async function precompress(roots: string[]): Promise<PrecompressResult> {
  const { sources, copies } = walk(roots)
  const sourceSet = new Set(sources)
  for (const copy of copies) if (!sourceSet.has(copy.slice(0, -'.br'.length))) rmSync(copy)

  const result: PrecompressResult = { written: 0, skipped: 0, sourceBytes: 0, brotliBytes: 0 }
  await Promise.all(
    sources.map(async file => {
      const source = readFileSync(file)
      const brotli = await compress(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.byteLength,
        },
      })
      if (brotli.byteLength >= source.byteLength) {
        rmSync(`${file}.br`, { force: true })
        result.skipped += 1
        return
      }
      writeFileSync(`${file}.br`, brotli)
      result.written += 1
      result.sourceBytes += source.byteLength
      result.brotliBytes += brotli.byteLength
    }),
  )
  return result
}

/**
 * What is wrong with the `.br` copies under `roots`, one line each: a copy that does not decompress
 * to its source byte for byte, or a copy whose source is gone. Empty when every copy is sound.
 */
export function verifyPrecompressed(roots: string[]): string[] {
  const { sources, copies } = walk(roots)
  const sourceSet = new Set(sources)
  const problems: string[] = []
  for (const copy of copies) {
    const file = copy.slice(0, -'.br'.length)
    if (!sourceSet.has(file)) {
      problems.push(`${copy}: no source beside it`)
      continue
    }
    let decompressed: Buffer
    try {
      decompressed = brotliDecompressSync(readFileSync(copy))
    } catch (error) {
      problems.push(`${copy}: does not decompress (${(error as Error).message})`)
      continue
    }
    if (!decompressed.equals(readFileSync(file))) problems.push(`${copy}: does not decompress to ${file}`)
  }
  return problems
}
