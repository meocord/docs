import { readFileSync } from 'node:fs'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeShared, encodeShared, MAX_SHARED_LENGTH, tooLongToShare } from './share'

const counter = readFileSync(
  path.resolve(__dirname, '../../examples/4.1/src/controllers/button/counter.button.controller.ts'),
  'utf8',
)

describe('the share format', () => {
  it('carries code and inputs through a fragment and back, unicode included', async () => {
    const shared = { source: `${counter}\n// ✓ déjà vu 🐱`, dispatch: "button counter/41; message 'hi; there'" }
    const fragment = await encodeShared(shared)
    expect(fragment).toMatch(/^v1\.[\w-]+$/)
    expect(await decodeShared(fragment)).toEqual(shared)
    expect(await decodeShared(`#${fragment}`)).toEqual(shared)
  })

  it('fits a typical example well under the cap, and refuses to share past it, saying why', async () => {
    const fragment = await encodeShared({ source: counter, dispatch: 'button counter/41' })
    expect(fragment.length).toBeLessThan(MAX_SHARED_LENGTH / 2)
    expect(tooLongToShare(fragment)).toBeUndefined()
    // Code that doesn't compress, as long as a cap and a half
    const noise = Array.from({ length: 1_600 }, (_, index) => ((index * 7919) % 65_521).toString(36)).join(' ')
    const long = await encodeShared({ source: noise, dispatch: '/ping' })
    expect(tooLongToShare(long)).toMatch(
      /^This code is too long to share as a link \([\d,]+ characters encoded; a link carries up to 1,800, so it fits in a Discord message\)\. Copy the code instead, or shorten it\.$/,
    )
  })

  it('reads nothing from another format, damaged data, the wrong shape, or more than a run takes', async () => {
    const encode = (value: unknown) =>
      `v1.${deflateRawSync(Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))).toString('base64url')}`
    for (const fragment of [
      '',
      'v2.abc',
      'v1.',
      'v1.not base64!',
      'v1.AAAA',
      encode('not json'),
      encode([1, 2]),
      encode({ source: 1, dispatch: '/ping' }),
      encode({ source: 'x', dispatch: 2 }),
      encode({ source: 'x'.repeat(64_001), dispatch: '/ping' }),
    ])
      expect(await decodeShared(fragment), fragment.slice(0, 40)).toBeUndefined()
    // A small link that inflates to far more than a run takes stops early
    const bomb = `v1.${deflateRawSync(Buffer.from(`{"source":"${'a'.repeat(5_000_000)}","dispatch":""}`)).toString('base64url')}`
    expect(bomb.length).toBeLessThan(10_000)
    expect(await decodeShared(bomb)).toBeUndefined()
  })
})
