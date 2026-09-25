import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { fetchProvenanceBundle, verifyProvenance, trustedRootFromJson } from './provenance.js'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8'))

// meocord@4.1.0-beta.0 as published: its registry integrity, attestation bundle, and Sigstore's trusted root
const INTEGRITY = 'sha512-fKr+3wXbBzTVTW41PNLb3C/gzFbWhSgIKmt5LCR2xedjjR8OvmyItOBAiZlb7/t9lZ/Jy2uAWo9Nejo1hdeKmQ=='
const SHA512 = Buffer.from(INTEGRITY.slice('sha512-'.length), 'base64').toString('hex')
const MEOCORD = 'https://github.com/meocord/meocord/.github/workflows/release.yml@refs/heads/main'
const L7AROMEO = 'https://github.com/l7aromeo/meocord/.github/workflows/release.yml@refs/heads/main'

const check = (overrides: Partial<Parameters<typeof verifyProvenance>[0]> = {}) =>
  verifyProvenance({
    bundle: fixture('provenance-4.1.0-beta.0.json'),
    trustedRoot: trustedRootFromJson(fixture('trusted-root.json')),
    issuer: 'https://token.actions.githubusercontent.com',
    identity: MEOCORD,
    name: 'meocord',
    version: '4.1.0-beta.0',
    sha512: SHA512,
    ...overrides,
  })

describe('verifyProvenance', () => {
  it('accepts the published tarball signed by the release workflow, and names its commit', () => {
    const provenance = check()

    expect(provenance.repository).toBe('https://github.com/meocord/meocord')
    expect(provenance.commit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('refuses a signature by any other identity', () => {
    expect(() => check({ identity: L7AROMEO })).toThrow(expect.objectContaining({ code: 'UNTRUSTED_SIGNER_ERROR' }))
  })

  it('refuses another issuer', () => {
    expect(() => check({ issuer: 'https://gitlab.com' })).toThrow(
      expect.objectContaining({ code: 'UNTRUSTED_SIGNER_ERROR' }),
    )
  })

  it('refuses a tarball whose digest differs from the one attested', () => {
    const tampered = SHA512.replace(/^./, c => (c === '0' ? '1' : '0'))

    expect(() => check({ sha512: tampered })).toThrow('attests a different tarball')
  })

  it('refuses the attestation for another version', () => {
    expect(() => check({ version: '4.1.0-beta.1' })).toThrow('not pkg:npm/meocord@4.1.0-beta.1')
  })

  it('refuses a bundle whose statement was altered after signing', () => {
    const bundle = fixture('provenance-4.1.0-beta.0.json')
    const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString())
    statement.subject[0].digest.sha512 = '0'.repeat(128)
    bundle.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64')

    expect(() => check({ bundle, sha512: '0'.repeat(128) })).toThrow()
  })
})

describe('fetchProvenanceBundle', () => {
  const answering =
    (status: number, body: unknown = {}) =>
    async () =>
      new Response(JSON.stringify(body), { status })

  it('returns the SLSA provenance bundle among the attestations', async () => {
    const attestations = [
      { predicateType: 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1', bundle: { publish: true } },
      { predicateType: 'https://slsa.dev/provenance/v1', bundle: { slsa: true } },
    ]

    await expect(fetchProvenanceBundle('meocord', '4.1.0-beta.0', answering(200, { attestations }))).resolves.toEqual({
      slsa: true,
    })
  })

  it('returns nothing for a version without attestations, and reports a failure', async () => {
    await expect(fetchProvenanceBundle('meocord', '3.0.0', answering(404))).resolves.toBeUndefined()
    await expect(fetchProvenanceBundle('meocord', '3.0.0', answering(500))).rejects.toThrow('answered 500')
  })
})
