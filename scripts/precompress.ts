/**
 * Writes quality-11 brotli and level-9 gzip copies of the build's immutable assets, then checks every
 * copy decompresses to its source. Runs at the end of `bun run build`; `--check` only checks.
 *
 *   bun scripts/precompress.ts [--check]
 */
import path from 'path'
import { precompress, verifyPrecompressed } from './lib/precompress.js'

// The chunks Next writes, the search bundles and palette indexes, and the playground's runtimes and
// compiler, all under content-hashed paths.
const ROOTS = ['.next/static', 'public/_pagefind', 'public/palette', 'public/playground'].map(dir =>
  path.join(process.cwd(), dir),
)

const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} KB`

if (!process.argv.includes('--check')) {
  const started = performance.now()
  const result = await precompress(ROOTS)
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(
    `Compressed copies of ${result.written} files, ${kb(result.sourceBytes)} to ${kb(result.brotliBytes)} brotli and ${kb(result.gzipBytes)} gzip, in ${seconds} s` +
      (result.skipped ? `; ${result.skipped} left without one, no smaller compressed.` : '.'),
  )
}

const problems = verifyPrecompressed(ROOTS)
if (problems.length > 0) {
  console.error(`${problems.length} compressed cop${problems.length === 1 ? 'y is' : 'ies are'} wrong:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('Every compressed copy decompresses to its source.')
