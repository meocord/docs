import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCliManifest } from './cli'

/** An unpacked package, with a dist/cli.json of these fields when given. */
function unpacked(manifest?: Record<string, unknown>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-cli-'))
  if (manifest) {
    mkdirSync(path.join(dir, 'dist'))
    writeFileSync(path.join(dir, 'dist', 'cli.json'), JSON.stringify(manifest))
  }
  return dir
}

const manifest = { schemaVersion: 1, meocordVersion: '4.1.0-beta.7', name: 'meocord', commands: [] }

describe('readCliManifest', () => {
  it('reads the manifest a version ships, and none from a version before it did', () => {
    expect(readCliManifest(unpacked(manifest), '4.1.0-beta.7')).toMatchObject({ name: 'meocord', commands: [] })
    expect(readCliManifest(unpacked(), '4.1.0-beta.6')).toBeUndefined()
  })

  it('fails on a schema it does not know, and on a manifest written for another version', () => {
    expect(() => readCliManifest(unpacked({ ...manifest, schemaVersion: 2 }), '4.1.0-beta.7')).toThrow(
      "meocord@4.1.0-beta.7's dist/cli.json has schemaVersion 2; the docs read 1.",
    )
    expect(() => readCliManifest(unpacked(manifest), '4.1.0-beta.8')).toThrow(
      "meocord@4.1.0-beta.8's dist/cli.json was written for 4.1.0-beta.7.",
    )
  })
})
