import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { playgroundFor, type PlaygroundManifest, readPlaygroundManifest } from '@/lib/playground-manifest'

const dirs: string[] = []
const root = (manifest?: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'playground-manifest-'))
  dirs.push(dir)
  if (manifest !== undefined) {
    mkdirSync(path.join(dir, '.playground'))
    writeFileSync(path.join(dir, '.playground', 'manifest.json'), manifest)
  }
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const manifest: PlaygroundManifest = {
  swc: '/playground/swc.0123456789.wasm',
  lines: [{ line: '4.1', version: '4.1.0-beta.7', runtime: '/playground/4.1.0-beta.7.abcdef0123.js', gzip: 362591 }],
}

describe('readPlaygroundManifest', () => {
  it('reads what the build recorded', () => {
    expect(readPlaygroundManifest(root(JSON.stringify(manifest)))).toEqual(manifest)
  })

  it('is undefined when the runtimes were not built, or the manifest is not one', () => {
    expect(readPlaygroundManifest(root())).toBeUndefined()
    expect(readPlaygroundManifest(root('{'))).toBeUndefined()
    expect(readPlaygroundManifest(root(JSON.stringify({ lines: [] })))).toBeUndefined()
  })
})

describe('playgroundFor', () => {
  it("gives a line's runtime with the compiler, and nothing for a line without one", () => {
    expect(playgroundFor(manifest, '4.1')).toEqual({
      runtime: '/playground/4.1.0-beta.7.abcdef0123.js',
      swc: '/playground/swc.0123456789.wasm',
      version: '4.1.0-beta.7',
    })
    expect(playgroundFor(manifest, '4.0')).toBeUndefined()
    expect(playgroundFor(undefined, '4.1')).toBeUndefined()
  })
})
