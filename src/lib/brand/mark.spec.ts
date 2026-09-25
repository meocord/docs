import { describe, expect, it } from 'vitest'
import { Root } from 'meo-canvas'
import { MARK_DARK, MARK_PATHS, markNode, markSvg } from '@/lib/brand/mark'

async function pixels16() {
  const canvas = await Root({ width: 16, height: 16, children: markNode(16) })
  try {
    return await canvas.toBuffer('raw')
  } finally {
    canvas.release()
  }
}

describe('the mark at 16px', () => {
  // Each point sits in the middle of a grid square, so it lands on one whole pixel.
  const at = (raw: Uint8Array, x: number, y: number) => [...raw.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 3)]
  const hex = (colour: string) => [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16))
  const near = (a: number[], b: number[]) => a.every((channel, i) => Math.abs(channel - b[i]) <= 8)

  it('keeps the ears, the window and the core apart', async () => {
    const raw = await pixels16()
    const tile = hex(MARK_DARK.tile)
    const accent = hex(MARK_DARK.accent)
    const ink = at(raw, 2, 6)

    expect(near(ink, tile)).toBe(false)
    expect(near(at(raw, 2, 2), ink)).toBe(true) // left ear
    expect(near(at(raw, 13, 2), ink)).toBe(true) // right ear
    expect(near(at(raw, 8, 2), tile)).toBe(true) // the crown between them
    expect(near(at(raw, 4, 9), tile)).toBe(true) // the window
    expect(near(at(raw, 7, 9), accent)).toBe(true) // the core
    expect(near(at(raw, 8, 13), ink)).toBe(true) // the chin
  })
})

describe('markSvg', () => {
  it('draws the same paths, and follows the colour scheme', () => {
    const svg = markSvg()
    expect(svg).toContain(`d="${MARK_PATHS.head}"`)
    expect(svg).toContain(`d="${MARK_PATHS.core}"`)
    expect(svg).toContain('fill-rule="evenodd"')
    expect(svg).toContain('@media (prefers-color-scheme:dark)')
  })
})
