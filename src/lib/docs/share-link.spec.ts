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
})
