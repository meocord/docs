import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { brotliCompressSync, brotliDecompressSync } from 'zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { precompress, verifyPrecompressed } from './precompress.js'

let root: string
const file = (name: string) => path.join(root, name)
const write = (name: string, content: string | Buffer) => {
  mkdirSync(path.dirname(file(name)), { recursive: true })
  writeFileSync(file(name), content)
}
const chunk = 'export const words = ' + JSON.stringify('the quick brown fox '.repeat(200)) + '\n'

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'meocord-docs-precompress-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('precompress', () => {
  it('writes a smaller brotli copy beside each script, stylesheet and JSON file, nested too', async () => {
    write('chunks/a.js', chunk)
    write('chunks/deep/b.css', `.a{color:red}\n`.repeat(300))
    write('index.json', JSON.stringify({ entries: Array.from({ length: 200 }, (_, i) => `entry-${i}`) }))
    const result = await precompress([root])
    expect(result.written).toBe(3)
    for (const name of ['chunks/a.js', 'chunks/deep/b.css', 'index.json']) {
      expect(brotliDecompressSync(readFileSync(file(`${name}.br`)))).toEqual(readFileSync(file(name)))
    }
    expect(result.brotliBytes).toBeLessThan(result.sourceBytes)
  })

  it('leaves fonts, index files and anything else alone', async () => {
    write('media/font.woff2', chunk)
    write('fragment/en_1.pf_fragment', chunk)
    await precompress([root])
    expect(existsSync(file('media/font.woff2.br'))).toBe(false)
    expect(existsSync(file('fragment/en_1.pf_fragment.br'))).toBe(false)
  })

  it('gives a file no copy when compressing would not make it smaller, and removes an old one', async () => {
    write('tiny.js', 'x')
    write('tiny.js.br', 'stale')
    const result = await precompress([root])
    expect(result).toMatchObject({ written: 0, skipped: 1 })
    expect(existsSync(file('tiny.js.br'))).toBe(false)
  })

  it('removes a copy whose source is gone, and skips a root that does not exist', async () => {
    write('old.js.br', brotliCompressSync(chunk))
    await precompress([root, file('missing')])
    expect(existsSync(file('old.js.br'))).toBe(false)
  })
})

describe('verifyPrecompressed', () => {
  it('passes copies that decompress to their sources', async () => {
    write('a.js', chunk)
    await precompress([root])
    expect(verifyPrecompressed([root])).toEqual([])
  })

  it('names a copy of other bytes, one that does not decompress, and one with no source', () => {
    write('changed.js', chunk)
    write('changed.js.br', brotliCompressSync(`${chunk}// edited`))
    write('broken.js', chunk)
    write('broken.js.br', 'not brotli')
    write('orphan.js.br', brotliCompressSync(chunk))
    const problems = verifyPrecompressed([root])
    expect(problems).toHaveLength(3)
    expect(problems.find(p => p.includes('changed.js.br'))).toMatch(/does not decompress to/)
    expect(problems.find(p => p.includes('broken.js.br'))).toMatch(/does not decompress \(/)
    expect(problems.find(p => p.includes('orphan.js.br'))).toMatch(/no source beside it/)
  })
})
