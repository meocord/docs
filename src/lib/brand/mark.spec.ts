import { describe, expect, it } from 'vitest'
import { Root } from 'meo-canvas'
import { markNode } from '@/lib/brand/mark'
import { earsPath, MARK_DARK, MARK_PATHS, markSvg, NOTCH_MIN_SIZE } from '@/lib/brand/mark-paths'

async function pixels(size: number) {
  const canvas = await Root({ width: size, height: size, children: markNode(size) })
  try {
    return await canvas.toBuffer('raw')
  } finally {
    canvas.release()
  }
}

const hex = (colour: string) => [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16))
const near = (a: number[], b: number[]) => a.every((channel, i) => Math.abs(channel - b[i]) <= 8)
const tile = hex(MARK_DARK.tile)
const accent = hex(MARK_DARK.accent)

describe('the mark at 16px', () => {
  // Each point sits in the middle of a grid square, so it lands on one whole pixel.
  const at = (raw: Uint8Array, x: number, y: number) => [...raw.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 3)]

  it('reads as two ears of different heights behind the cord, not one shape', async () => {
    const raw = await pixels(16)
    const ink = at(raw, 4, 6)

    expect(near(ink, tile)).toBe(false)
    expect(near(at(raw, 4, 4), ink)).toBe(true) // the near ear, standing tall
    expect(near(at(raw, 4, 3), tile)).toBe(false) // …up to its tip
    expect(near(at(raw, 12, 8), ink)).toBe(true) // the far ear, lower
    expect(near(at(raw, 12, 4), tile)).toBe(true) // …with nothing above it at the near ear's height
    expect(near(at(raw, 8, 3), tile)).toBe(true) // open sky between the ears
    expect(near(at(raw, 8, 6), tile)).toBe(true) // the dip of the crown
    expect(near(at(raw, 8, 9), ink)).toBe(true) // the head, below the dip
    expect(near(at(raw, 4, 8), ink)).toBe(true) // no inner ear at this size
    expect(near(at(raw, 8, 11), accent)).toBe(true) // the cord
    expect(near(at(raw, 8, 14), tile)).toBe(true) // nothing below the cord
  })
})

describe('the optical sizes', () => {
  it('cuts the inner ears out from NOTCH_MIN_SIZE up', async () => {
    const size = NOTCH_MIN_SIZE
    const raw = await pixels(size)
    // The middle of the near inner ear, at grid (4.7, 8.2).
    const x = Math.floor(4.7 * (size / 16))
    const y = Math.floor(8.2 * (size / 16))
    expect(near([...raw.subarray((y * size + x) * 4, (y * size + x) * 4 + 3)], tile)).toBe(true)
  })

  it('draws the plain crown below NOTCH_MIN_SIZE and the notched ears from it', () => {
    expect(earsPath(NOTCH_MIN_SIZE - 1)).toBe(MARK_PATHS.crown)
    expect(earsPath(NOTCH_MIN_SIZE)).toBe(MARK_PATHS.crown + MARK_PATHS.inner)
  })
})

describe('markSvg', () => {
  it('draws the tab-size crown and the cord, and follows the colour scheme', () => {
    const svg = markSvg()
    expect(svg).toContain(`d="${MARK_PATHS.crown}"`)
    expect(svg).toContain(`d="${MARK_PATHS.cord}"`)
    expect(svg).not.toContain(MARK_PATHS.inner)
    expect(svg).toContain('@media (prefers-color-scheme:dark)')
  })
})
