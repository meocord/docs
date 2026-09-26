/**
 * Writes quality-11 brotli copies of the build's immutable text assets, then checks every copy
 * decompresses to its source. Runs at the end of `bun run build`; `--check` only checks.
 *
 *   bun scripts/precompress.ts [--check]
 */
import path from 'path'
import { precompress, verifyPrecompressed } from './lib/precompress.js'

// The chunks Next writes, and the search bundles and palette indexes, all under content-hashed paths.
const ROOTS = ['.next/static', 'public/_pagefind', 'public/palette'].map(dir => path.join(process.cwd(), dir))

const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} KB`

if (!process.argv.includes('--check')) {
  const started = performance.now()
  const result = await precompress(ROOTS)
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(
    `Brotli copies of ${result.written} files, ${kb(result.sourceBytes)} to ${kb(result.brotliBytes)}, in ${seconds} s` +
      (result.skipped ? `; ${result.skipped} left without one, no smaller compressed.` : '.'),
  )
}

const problems = verifyPrecompressed(ROOTS)
if (problems.length > 0) {
  console.error(`${problems.length} brotli cop${problems.length === 1 ? 'y is' : 'ies are'} wrong:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('Every brotli copy decompresses to its source.')
