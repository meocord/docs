import { describe, expect, it } from 'vitest'
import { sharedFragment } from '@/lib/docs/share-link'
import { decodeShared } from '@/playground/share'

describe('sharedFragment', () => {
  it('writes the fragment the browser reads', async () => {
    const shared = { source: "import { Command } from 'meocord/decorator'\n// ✓ 🐱", dispatch: "message 'hi; there'" }
    const fragment = sharedFragment(shared)
    expect(fragment).toMatch(/^v1\.[\w-]+$/)
    expect(await decodeShared(fragment)).toEqual(shared)
  })

  it('fails the build for code a link cannot carry, naming the example', () => {
    const noise = Array.from({ length: 1_600 }, (_, index) => ((index * 7919) % 65_521).toString(36)).join(' ')
    expect(() => sharedFragment({ source: noise, dispatch: '/ping' }, 'examples/4.1/src/big.ts')).toThrow(
      /^examples\/4\.1\/src\/big\.ts is too long for its "Open in playground" link: [\d]+ characters encoded, over the 1,800 a link carries\.$/,
    )
  })
})
