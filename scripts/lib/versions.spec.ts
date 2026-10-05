import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { aliases } from './line-aliases'
import {
  addVersion,
  allVersions,
  findLine,
  identityFor,
  lineOf,
  newestIn,
  readVersions,
  validateVersions,
  writeVersions,
  type VersionsConfig,
} from './versions.js'

const L7 = 'https://github.com/l7aromeo/meocord/.github/workflows/release.yml@refs/heads/main'
const ORG = 'https://github.com/meocord/meocord/.github/workflows/release.yml@refs/heads/main'

const empty = (): VersionsConfig => ({
  package: 'meocord',
  since: '4.0.0-beta.0',
  provenance: {
    issuer: 'https://token.actions.githubusercontent.com',
    identities: [
      { range: '<4.1.0-beta.0', identity: L7 },
      { range: '>=4.1.0-beta.0', identity: ORG },
    ],
    integrityOnly: [],
  },
  lines: [],
})

const add = (config: VersionsConfig, ...versions: string[]) =>
  versions.reduce((next, version) => addVersion(next, version).config, config)

describe('lineOf', () => {
  it('names the minor line, prereleases included', () => {
    expect(lineOf('4.1.0-beta.0')).toBe('4.1')
    expect(lineOf('4.0.3')).toBe('4.0')
    expect(() => lineOf('four')).toThrow('not a semver version')
  })
})

describe('identityFor', () => {
  it('picks the one identity whose range holds the version, prereleases included', () => {
    expect(identityFor(empty(), '4.0.0-beta.3')).toBe(L7)
    expect(identityFor(empty(), '4.0.0')).toBe(L7)
    expect(identityFor(empty(), '4.1.0-beta.0')).toBe(ORG)
    expect(identityFor(empty(), '4.2.1')).toBe(ORG)
  })

  it('accepts integrity alone only for a version listed as such', () => {
    const config = empty()
    config.provenance.integrityOnly.push('3.2.2')

    expect(identityFor(config, '3.2.2')).toBe('integrity-only')
  })

  it('refuses a version no rule, or more than one, covers', () => {
    const config = empty()
    config.provenance.identities.push({ range: '>=4.0.0', identity: ORG })

    expect(() => identityFor(config, '4.0.1')).toThrow('matches 2 provenance identities')
    expect(() => identityFor({ ...empty(), provenance: { ...empty().provenance, identities: [] } }, '4.0.0')).toThrow(
      'matches 0',
    )
  })
})

describe("the site's versions.json", () => {
  it('signs every listed version by exactly one identity, and a 4.0 patch from the release/4.0 branch', () => {
    const config = readVersions(path.resolve(import.meta.dirname, '..', '..', 'versions.json'))

    for (const version of allVersions(config)) expect(() => identityFor(config, version), version).not.toThrow()
    expect(identityFor(config, '4.0.0')).toBe(L7)
    expect(identityFor(config, '4.0.1')).toBe(
      'https://github.com/meocord/meocord/.github/workflows/release.yml@refs/heads/release/4.0',
    )
    expect(identityFor(config, '4.0.9')).toBe(identityFor(config, '4.0.1'))
    expect(identityFor(config, '4.1.0-beta.0')).toBe(ORG)
  })
})

describe('addVersion', () => {
  it('opens a line in prerelease and makes it current at its stable release', () => {
    const betas = addVersion(empty(), '4.0.0-beta.0')

    expect(betas.config.lines).toEqual([
      { line: '4.0', status: 'prerelease', guides: 'readme', versions: ['4.0.0-beta.0'] },
    ])
    expect(betas.forked).toEqual({ line: '4.0', from: undefined })

    const stable = addVersion(betas.config, '4.0.0')
    expect(stable.config.lines[0].status).toBe('current')
    expect(stable.statusChanges).toEqual(['4.0: prerelease -> current'])
  })

  it('forks a new line from the newest one, and archives the old current line on stable', () => {
    const config = add(empty(), '4.0.0', '4.1.0-beta.0')

    expect(aliases(config)).toEqual({ latest: '4.0', next: '4.1' })
    const released = addVersion(config, '4.1.0')
    expect(aliases(released.config)).toEqual({ latest: '4.1', next: undefined })
    expect(released.statusChanges).toEqual(['4.0: current -> archived', '4.1: prerelease -> current'])
    expect(addVersion(released.config, '4.2.0-beta.0').forked).toEqual({ line: '4.2', from: '4.1' })
  })

  it('archives a prerelease line a newer prerelease line supersedes', () => {
    const superseded = addVersion(add(empty(), '4.0.0', '4.1.0-beta.0'), '4.2.0-beta.0')

    expect(superseded.statusChanges).toEqual(['4.2: new, prerelease', '4.1: prerelease -> archived'])
    expect(aliases(superseded.config)).toEqual({ latest: '4.0', next: '4.2' })
  })

  it('keeps a line marked maintained by hand, archiving only the current line a release replaces', () => {
    const config = add(empty(), '4.0.0', '4.1.0')
    config.lines.find(line => line.line === '4.0')!.status = 'maintained'

    const released = addVersion(config, '4.2.0')
    expect(released.statusChanges).toEqual(['4.2: new, current', '4.1: current -> archived'])
    expect(released.config.lines.map(line => `${line.line}:${line.status}`)).toEqual([
      '4.2:current',
      '4.1:archived',
      '4.0:maintained',
    ])
  })

  it('archives a line marked maintained by hand once two newer lines are supported', () => {
    const config = add(empty(), '4.0.0', '4.1.0')
    for (const line of config.lines) if (line.line === '4.0') line.status = 'maintained'
    const kept = addVersion(config, '4.2.0')
    kept.config.lines.find(line => line.line === '4.1')!.status = 'maintained'

    expect(addVersion(kept.config, '4.2.1').statusChanges).toEqual(['4.0: maintained -> archived'])
  })

  it('keeps versions in order and ignores one already listed', () => {
    const config = add(empty(), '4.0.1', '4.0.0')

    expect(allVersions(config)).toEqual(['4.0.0', '4.0.1'])
    expect(newestIn(config.lines[0])).toBe('4.0.1')
    expect(addVersion(config, '4.0.0')).toEqual({ config, statusChanges: [] })
  })
})

describe('validateVersions', () => {
  it('lists every problem at once', () => {
    const config = empty()
    config.provenance.identities.push({ range: 'soon', identity: 'https://github.com/meocord/*' })
    config.lines.push({ line: '4.1', status: 'stable' as never, guides: 'readme', versions: ['4.0.0', '4.0.0'] })

    expect(() => validateVersions(config)).toThrow(
      /range "soon"[\s\S]*not an exact GitHub workflow identity[\s\S]*unknown status[\s\S]*4\.0\.0 is listed under line 4\.1[\s\S]*listed twice/,
    )
  })
})

describe('readVersions and writeVersions', () => {
  it('round-trips a valid config, and refuses to write an invalid one', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'versions-'))
    const file = path.join(dir, 'versions.json')
    const config = add(empty(), '4.0.0')
    writeVersions(file, config)

    expect(readVersions(file)).toEqual(config)
    expect(readFileSync(file, 'utf8').endsWith('}\n')).toBe(true)
    expect(findLine(config, '4.0')?.versions).toEqual(['4.0.0'])
    expect(() => writeVersions(file, { ...config, since: 'soon' })).toThrow('since "soon" is not a version')
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses two current lines, and an unknown guide source', () => {
    const config = add(empty(), '4.0.0')
    config.lines.push({ line: '4.1', status: 'current', guides: 'wiki' as never, versions: ['4.1.0'] })

    expect(() => validateVersions(config)).toThrow(/unknown guide source "wiki"[\s\S]*more than one line is current/)
  })
})
