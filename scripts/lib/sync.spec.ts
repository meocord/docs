import { spawnSync } from 'child_process'
import { createHash } from 'crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Packument } from './registry.js'
import type { VersionsConfig } from './versions.js'

// The whole sync, offline: a fixture package packed per version, served by a fake registry, and
// accepted on its integrity alone, into a scratch repository
const root = mkdtempSync(path.join(tmpdir(), 'meocord-docs-sync-'))
vi.stubEnv('MEOCORD_DOCS_ROOT', root)
const { sync, missingVersions, syncSummary } = await import('./sync.js')
const { forkContent, forkExamples } = await import('./layout.js')
const { unpack } = await import('./tarball.js')

const fixture = path.join(import.meta.dirname, '..', '__fixtures__', 'package')

function packVersion(version: string): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), 'meocord-docs-pack-'))
  cpSync(fixture, path.join(dir, 'package'), { recursive: true })
  const manifest = path.join(dir, 'package', 'package.json')
  writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('9.0.0-beta.0', version))
  const changelog = path.join(dir, 'package', 'CHANGELOG.md')
  writeFileSync(changelog, readFileSync(changelog, 'utf8').replace('## 9.0.0-beta.0', `## ${version}`))
  spawnSync('tar', ['-czf', path.join(dir, 'package.tgz'), '-C', dir, 'package'])
  const bytes = new Uint8Array(readFileSync(path.join(dir, 'package.tgz')))
  rmSync(dir, { recursive: true, force: true })
  return bytes
}

const tarballs: Record<string, Uint8Array> = {}
const registry = (versions: string[]): Packument => ({
  name: 'meocord',
  'dist-tags': {},
  versions: Object.fromEntries(
    versions.map(version => {
      tarballs[version] ??= packVersion(version)
      const integrity = `sha512-${createHash('sha512').update(tarballs[version]).digest('base64')}`
      return [version, { version, dist: { tarball: `https://registry.test/meocord-${version}.tgz`, integrity } }]
    }),
  ),
})
const fakeFetch = async (url: string) => {
  const version = /meocord-(.+)\.tgz$/.exec(url)?.[1]
  return version
    ? new Response(new Blob([tarballs[version] as Uint8Array<ArrayBuffer>]))
    : new Response('not found', { status: 404 })
}

const config: VersionsConfig = {
  package: 'meocord',
  since: '9.0.0-beta.0',
  provenance: {
    issuer: 'https://token.actions.githubusercontent.com',
    identities: [],
    integrityOnly: ['9.0.0-beta.0', '9.0.0', '8.9.0'],
  },
  lines: [],
}
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const logs: string[] = []
const deps = (versions: string[]) => ({
  packument: registry(versions),
  trustedRoot: () => Promise.reject(new Error('not needed')),
  fetch: fakeFetch,
  log: (line: string) => logs.push(line),
})

let first: Awaited<ReturnType<typeof sync>>

// A page authored ahead of the line's switch, which no sync may change
const DRAFT = '---\nid: overview\ntitle: Overview\n---\n\nWritten for the site.\n'

beforeAll(async () => {
  mkdirSync(path.join(root, 'content', '9.0'), { recursive: true })
  writeFileSync(path.join(root, 'content', '9.0', 'draft.md'), DRAFT)
  mkdirSync(path.join(root, 'examples', '9.0'), { recursive: true })
  writeFileSync(
    path.join(root, 'examples', '9.0', 'package.json'),
    '{"name":"examples","dependencies":{"meocord":"0.0.0"}}\n',
  )
  first = await sync(config, deps(['8.9.0', '9.0.0-beta.0']))
}, 60_000)

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('sync', () => {
  it('adds only the versions from `since` on, as a new line in prerelease', () => {
    expect(first.added).toEqual(['9.0.0-beta.0'])
    expect(first.config.lines).toEqual([
      { line: '9.0', status: 'prerelease', guides: 'readme', versions: ['9.0.0-beta.0'] },
    ])
  })

  it('writes the API document by entry point, with nothing naming the unpacked tarball', () => {
    const doc = JSON.parse(read('generated/api/9.0.0-beta.0.json'))

    expect(doc.meta).toMatchObject({ package: 'meocord', version: '9.0.0-beta.0' })
    expect(doc.project.children.map((module: { name: string }) => module.name)).toEqual([
      'meocord/core',
      'meocord/enum',
    ])
    expect(JSON.stringify(doc)).not.toMatch(/meocord-docs-|"sources"|packagePath/)
  })

  it('writes the changelog with links pointed at the imported guides', () => {
    const doc = JSON.parse(read('generated/changelog/9.0.0-beta.0.json'))

    expect(doc.sections[0].entries[0]).toMatchObject({ breaking: true })
    expect(doc.sections[1].entries[0].markdown).toContain('(/docs/9.0/getting-started#install)')
  })

  it('leaves authored guides alone', () => {
    expect(readdirSync(path.join(root, 'content', '9.0'))).toEqual(['draft.md'])
    expect(read('content/9.0/draft.md')).toBe(DRAFT)
  })

  it('imports the README as the line’s guides, and pins the examples', () => {
    expect(readdirSync(path.join(root, 'generated', 'readme', '9.0')).sort()).toEqual([
      'deployment.md',
      'getting-started.md',
      'overview.md',
    ])
    expect(read('generated/readme/9.0/deployment.md')).toContain('(/docs/9.0/getting-started#install)')
    expect(JSON.parse(read('examples/9.0/package.json')).dependencies.meocord).toBe('9.0.0-beta.0')
  })

  it('records since data, and says why no migration guide was imported', () => {
    expect(JSON.parse(read('generated/since.json'))['meocord/core:ShardContext.call(method)']).toEqual({
      since: '9.0.0-beta.0',
    })
    expect(existsSync(path.join(root, 'generated', 'migrating', '9.0.md'))).toBe(false)
    expect(logs).toContain('9.0: 9.0.0-beta.0 has no provenance, so its migration guide is not imported')
  })

  it('makes the line current at its stable release, and has nothing left to add after', async () => {
    const second = await sync(first.config, deps(['9.0.0-beta.0', '9.0.0']))

    expect(second.added).toEqual(['9.0.0'])
    expect(second.statusChanges).toEqual(['9.0: prerelease -> current'])
    expect(read('generated/readme/9.0/overview.md')).toContain('source: readme@9.0.0')
    expect(read('content/9.0/draft.md')).toBe(DRAFT)
    expect(missingVersions(second.config, registry(['9.0.0-beta.0', '9.0.0']))).toEqual([])
    expect(syncSummary(second)).toContain('Adds `9.0.0`')
  }, 60_000)

  it('refuses a version whose tarball does not match its integrity', async () => {
    const packument = registry(['9.0.0'])
    packument.versions['9.0.1'] = {
      version: '9.0.1',
      dist: {
        ...packument.versions['9.0.0'].dist,
        tarball: 'https://registry.test/meocord-9.0.0.tgz',
        integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
      },
    }

    await expect(sync(first.config, { ...deps([]), packument })).rejects.toThrow(
      'does not match its registry integrity',
    )
  })

  it('refuses a version with no attestation that versions.json does not accept on integrity alone', async () => {
    const strict = {
      ...first.config,
      provenance: {
        ...first.config.provenance,
        integrityOnly: [],
        identities: [
          { range: '*', identity: 'https://github.com/meocord/meocord/.github/workflows/release.yml@refs/heads/main' },
        ],
      },
    }
    const noAttestation = async (url: string) =>
      url.includes('/attestations/') ? new Response('', { status: 404 }) : fakeFetch(url)

    await expect(sync(strict, { ...deps(['9.0.0']), fetch: noAttestation })).rejects.toThrow(
      'has no provenance attestation',
    )
  })
})

describe('forking a line', () => {
  it('copies the authored guides, and the examples pinned to the new version without their installs', () => {
    mkdirSync(path.join(root, 'examples', '9.0', 'node_modules', 'meocord'), { recursive: true })
    forkContent('9.0', '9.1')
    forkExamples('9.0', '9.1', '9.1.0-beta.0')

    expect(readdirSync(path.join(root, 'content', '9.1'))).toEqual(['draft.md'])
    expect(() => forkContent('9.0', '9.1')).toThrow('content/9.1 already exists')
    expect(JSON.parse(read('examples/9.1/package.json'))).toEqual({
      name: 'examples-9-1',
      dependencies: { meocord: '9.1.0-beta.0' },
    })
    expect(existsSync(path.join(root, 'examples', '9.1', 'node_modules'))).toBe(false)
  })

  it('leaves examples alone for a line that has none', () => {
    forkExamples('8.0', '8.1', '8.1.0')

    expect(existsSync(path.join(root, 'examples', '8.1'))).toBe(false)
  })
})

describe('unpack', () => {
  it('refuses bytes that are not a gzipped tarball', () => {
    expect(() => unpack(new TextEncoder().encode('not a tarball'))).toThrow('Could not unpack the tarball')
  })
})
