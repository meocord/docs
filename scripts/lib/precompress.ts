/**
 * Compressed copies of the build's immutable assets, written beside each file as `<file>.br` and
 * `<file>.gz` at the highest quality, for a server to send in place of compressing on every request.
 * Pages are left out: the CSP proxy writes each page's hashes into its `<head>` as it serves it, so no
 * file holds the bytes a reader receives.
 */

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { promisify } from 'util'
import { brotliCompress, brotliDecompressSync, constants, gunzipSync, gzip } from 'zlib'

/**
 * The assets worth a compressed copy: text, and the playground's WebAssembly compiler. Fonts and
 * Pagefind's index files arrive compressed already.
 */
export const COMPRESSIBLE = /\.(?:js|mjs|css|json|wasm)$/

const brotli = promisify(brotliCompress)
const gzipped = promisify(gzip)

/** Each copy written, by its extension: how it is made from the source and read back. */
export const ENCODINGS = [
  {
    extension: 'br',
    compress: (source: Buffer) =>
      brotli(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.byteLength,
        },
      }),
    decompress: (copy: Buffer) => brotliDecompressSync(copy),
  },
  {
    extension: 'gz',
    compress: (source: Buffer) => gzipped(source, { level: constants.Z_BEST_COMPRESSION }),
    decompress: (copy: Buffer) => gunzipSync(copy),
  },
] as const

const COPY = /\.(?:br|gz)$/

/** Every compressible file under `roots`, and every copy beside one, as paths. */
function walk(roots: string[]): { sources: string[]; copies: string[] } {
  const sources: string[] = []
  const copies: string[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const file = path.join(entry.parentPath, entry.name)
      if (COPY.test(file)) copies.push(file)
      else if (COMPRESSIBLE.test(file)) sources.push(file)
    }
  }
  return { sources: sources.sort(), copies: copies.sort() }
}

export interface PrecompressResult {
  /** Files that got at least one copy. */
  written: number
  /** Files no copy of which would be smaller, so they keep none. */
  skipped: number
  /** Bytes of the files that got a copy, and of their copies in each encoding. */
  sourceBytes: number
  brotliBytes: number
  gzipBytes: number
}

/**
 * Writes a `.br` and a `.gz` beside each compressible file under `roots`, compressing in parallel,
 * and removes any copy that would be no smaller than its source or whose source is gone.
 */
export async function precompress(roots: string[]): Promise<PrecompressResult> {
  const { sources, copies } = walk(roots)
  const sourceSet = new Set(sources)
  for (const copy of copies) if (!sourceSet.has(copy.replace(COPY, ''))) rmSync(copy)

  const result: PrecompressResult = { written: 0, skipped: 0, sourceBytes: 0, brotliBytes: 0, gzipBytes: 0 }
  await Promise.all(
    sources.map(async file => {
      const source = readFileSync(file)
      let kept = 0
      for (const { extension, compress } of ENCODINGS) {
        const copy = await compress(source)
        if (copy.byteLength >= source.byteLength) {
          rmSync(`${file}.${extension}`, { force: true })
          continue
        }
        writeFileSync(`${file}.${extension}`, copy)
        kept += 1
        if (extension === 'br') result.brotliBytes += copy.byteLength
        else result.gzipBytes += copy.byteLength
      }
      if (kept === 0) {
        result.skipped += 1
        return
      }
      result.written += 1
      result.sourceBytes += source.byteLength
    }),
  )
  return result
}

/**
 * What is wrong with the copies under `roots`, one line each: a copy that does not decompress to its
 * source byte for byte, or a copy whose source is gone. Empty when every copy is sound.
 */
export function verifyPrecompressed(roots: string[]): string[] {
  const { sources, copies } = walk(roots)
  const sourceSet = new Set(sources)
  const problems: string[] = []
  for (const copy of copies) {
    const file = copy.replace(COPY, '')
    if (!sourceSet.has(file)) {
      problems.push(`${copy}: no source beside it`)
      continue
    }
    const { decompress } = ENCODINGS.find(each => copy.endsWith(`.${each.extension}`))!
    let decompressed: Buffer
    try {
      decompressed = decompress(readFileSync(copy))
    } catch (error) {
      problems.push(`${copy}: does not decompress (${(error as Error).message})`)
      continue
    }
    if (!decompressed.equals(readFileSync(file))) problems.push(`${copy}: does not decompress to ${file}`)
  }
  return problems
}
