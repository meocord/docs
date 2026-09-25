import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultSearchLines, readSearchManifest, type SearchManifest } from '@/lib/search-manifest'

const manifest: SearchManifest = {
  lines: [
    {
      line: '4.1',
      status: 'prerelease',
      search: '/_pagefind/4.1.0123456789/',
      palette: '/palette/4.1.a.json',
      documents: 3,
    },
    {
      line: '4.0',
      status: 'current',
      search: '/_pagefind/4.0.0123456789/',
      palette: '/palette/4.0.a.json',
      documents: 2,
    },
    {
      line: '3.9',
      status: 'archived',
      search: '/_pagefind/3.9.0123456789/',
      palette: '/palette/3.9.a.json',
      documents: 1,
    },
  ],
}

function rootWith(contents?: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'search-manifest-'))
  if (contents !== undefined) {
    mkdirSync(path.join(root, '.search'))
    writeFileSync(path.join(root, '.search', 'manifest.json'), contents)
  }
  return root
}

describe('readSearchManifest', () => {
  it('reads the manifest the search build wrote', () => {
    expect(readSearchManifest(rootWith(JSON.stringify(manifest)))).toEqual(manifest)
  })

  it('is empty when the indexes were not built, or the file is not a manifest', () => {
    expect(readSearchManifest(rootWith())).toEqual({ lines: [] })
    expect(readSearchManifest(rootWith('not json'))).toEqual({ lines: [] })
    expect(readSearchManifest(rootWith('{"lines": 3}'))).toEqual({ lines: [] })
  })
})

describe('defaultSearchLines', () => {
  it('searches every line but the archived ones by default', () => {
    expect(defaultSearchLines(manifest).map(line => line.line)).toEqual(['4.1', '4.0'])
  })
})
