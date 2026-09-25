import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'
import { checkIntegrity, downloadTarball, fetchPackument, type Packument } from './registry.js'

const bytes = new TextEncoder().encode('a tarball, as far as this test is concerned')
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`

const packument: Packument = {
  name: 'meocord',
  'dist-tags': { latest: '1.0.0' },
  versions: {
    '1.0.0': { version: '1.0.0', dist: { tarball: 'https://registry.example/meocord-1.0.0.tgz', integrity } },
  },
}

const serving =
  (body: Uint8Array | object, status = 200) =>
  async () =>
    new Response(body instanceof Uint8Array ? new Blob([body as Uint8Array<ArrayBuffer>]) : JSON.stringify(body), {
      status,
    })

describe('checkIntegrity', () => {
  it('returns the hex sha512 of bytes matching their integrity', () => {
    expect(checkIntegrity(bytes, integrity)).toBe(createHash('sha512').update(bytes).digest('hex'))
  })

  it('refuses a tarball with one byte flipped', () => {
    const tampered = bytes.slice()
    tampered[7] ^= 0xff

    expect(() => checkIntegrity(tampered, integrity)).toThrow('does not match its registry integrity')
  })

  it('refuses any integrity that is not a single sha512', () => {
    expect(() => checkIntegrity(bytes, `sha1-${createHash('sha1').update(bytes).digest('base64')}`)).toThrow(
      'only a single sha512',
    )
    expect(() => checkIntegrity(bytes, `${integrity} ${integrity}`)).toThrow('only a single sha512')
  })
})

describe('downloadTarball', () => {
  it('returns the bytes once they match the packument', async () => {
    const tarball = await downloadTarball(packument, '1.0.0', serving(bytes))

    expect(tarball.bytes).toEqual(bytes)
  })

  it('refuses a download altered in transit', async () => {
    const tampered = bytes.slice()
    tampered[0] ^= 0x01

    await expect(downloadTarball(packument, '1.0.0', serving(tampered))).rejects.toThrow('does not match')
  })

  it('refuses a version that is not published', async () => {
    await expect(downloadTarball(packument, '2.0.0', serving(bytes))).rejects.toThrow('meocord@2.0.0 is not published')
  })

  it('reports a failed download', async () => {
    await expect(downloadTarball(packument, '1.0.0', serving(bytes, 503))).rejects.toThrow('answered 503')
  })
})

describe('fetchPackument', () => {
  it('reads the packument, and reports a failure', async () => {
    await expect(fetchPackument('meocord', serving(packument))).resolves.toEqual(packument)
    await expect(fetchPackument('meocord', serving({}, 404))).rejects.toThrow('answered 404')
  })
})
