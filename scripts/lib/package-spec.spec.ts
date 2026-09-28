import { describe, expect, it } from 'vitest'
import { distTagProblems, literalCreates, packageSpec, withPackageSpec } from './package-spec'
import type { Packument } from './registry'
import type { Line, VersionsConfig } from './versions'

const config = (...lines: Line[]): VersionsConfig => ({
  package: 'meocord',
  since: '4.0.0-beta.0',
  provenance: { issuer: '', identities: [], integrityOnly: [] },
  lines,
})
const lines = config(
  { line: '4.2', status: 'prerelease', guides: 'authored', versions: ['4.2.0-rc.0', '4.2.0-rc.1'] },
  { line: '4.1', status: 'current', guides: 'authored', versions: ['4.1.0-beta.7', '4.1.0'] },
  { line: '4.0', status: 'maintained', guides: 'readme', versions: ['4.0.0', '4.0.3'] },
  { line: '3.9', status: 'archived', guides: 'readme', versions: ['3.9.0-beta.1'] },
  { line: '5.0', status: 'prerelease', guides: 'authored', versions: [] },
)
const packument = (tags: Record<string, string>) => ({ name: 'meocord', 'dist-tags': tags, versions: {} }) as Packument

describe('the package spec a page runs', () => {
  it("installs each line's newest version: by name, by prerelease tag, or exactly", () => {
    expect(packageSpec(lines, '4.1')).toBe('meocord')
    expect(packageSpec(lines, '4.2')).toBe('meocord@rc')
    expect(packageSpec(lines, '4.0')).toBe('meocord@4.0.3')
    expect(packageSpec(lines, '3.9')).toBe('meocord@3.9.0-beta.1')
    expect(packageSpec(lines, '5.0')).toBe('meocord')
  })

  it('takes the place of every {{meocord}} in a page', () => {
    expect(withPackageSpec('`npx {{meocord}} create`, then `{{meocord}} create`', lines, '4.2')).toBe(
      '`npx meocord@rc create`, then `meocord@rc create`',
    )
    expect(withPackageSpec('`meocord generate`', lines, '4.2')).toBe('`meocord generate`')
  })

  it("refuses a registry whose tag would install another line's version, or has no such tag", () => {
    expect(distTagProblems(lines, packument({ latest: '4.1.0', rc: '4.2.0-rc.1' }))).toEqual([])
    expect(distTagProblems(lines, packument({ latest: '4.2.0', rc: '4.2.0-rc.1' }))).toEqual([
      `4.1's pages run meocord, but the registry's "latest" tag points at 4.2.0`,
    ])
    expect(distTagProblems(lines, packument({ latest: '4.1.0', beta: '4.2.0-beta.0' }))).toEqual([
      `4.2's pages run meocord@rc, but the registry has no "rc" tag`,
    ])
  })

  it('finds a create command written with the package itself, by line', () => {
    const page = [
      'Run `npx meocord create my-bot`, or `bunx meocord@beta create`,',
      'or `meocord@4.1.0',
      'create` wrapped. `npx {{meocord}} create` and `meocord generate` are fine.',
    ].join('\n')
    expect(literalCreates(page)).toEqual([
      { line: 1, command: 'meocord create' },
      { line: 1, command: 'meocord@beta create' },
      { line: 2, command: 'meocord@4.1.0 create' },
    ])
  })
})
