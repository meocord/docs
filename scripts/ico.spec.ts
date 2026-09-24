import { describe, expect, it } from 'vitest'
import { packIco } from './ico'

describe('packIco', () => {
  it('writes a directory entry per image, pointing at its bytes', () => {
    const small = Buffer.from([1, 2, 3])
    const large = Buffer.from([4, 5])
    const ico = packIco([
      { size: 16, data: small },
      { size: 256, data: large },
    ])

    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico.readUInt8(6)).toBe(16)
    expect(ico.readUInt8(22)).toBe(0)
    const firstOffset = ico.readUInt32LE(6 + 12)
    const secondOffset = ico.readUInt32LE(22 + 12)
    expect(firstOffset).toBe(6 + 2 * 16)
    expect(ico.subarray(firstOffset, firstOffset + 3)).toEqual(small)
    expect(ico.subarray(secondOffset)).toEqual(large)
  })
})
