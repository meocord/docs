import { describe, expect, it } from 'vitest'
import { EAR_PIVOT, earFlickCss, FLICK_KEYFRAMES, flickAngles, FLICK_SECONDS } from '@/lib/brand/ear-flick'
import { MARK_EARS, MARK_PATHS } from '@/lib/brand/mark-paths'

describe('the ear flick', () => {
  // mark.json is meocord's tools/brand/mark.json, verbatim; the animated avatar plays the same frames
  it('plays mark.json’s frames, each at its time in the cycle, and ends still', () => {
    const css = earFlickCss() as Record<string, Record<string, { rotate?: string }>>
    const period = 14
    for (const [ear, index] of [
      ['far', 1],
      ['near', 2],
    ] as const) {
      const keyframes = css[`@keyframes ear-${ear}`]
      for (const frame of FLICK_KEYFRAMES) {
        const at = `${+((frame[0] / 1000 / period) * 100).toFixed(3)}%`
        expect(keyframes[at]).toEqual({ rotate: `${frame[index]}deg` })
      }
      expect(keyframes['100%']).toEqual({ rotate: '0deg' })
    }
    expect(FLICK_KEYFRAMES[0].slice(1)).toEqual([0, 0])
    expect(FLICK_KEYFRAMES.at(-1)!.slice(1)).toEqual([0, 0])
    expect(flickAngles(FLICK_SECONDS)).toEqual({ far: 0, near: 0 })
    expect(flickAngles(0.06)).toEqual({ far: FLICK_KEYFRAMES[2][1], near: FLICK_KEYFRAMES[2][2] })
  })

  it('splits the crown at the valley both ears turn about', () => {
    const valley = `${EAR_PIVOT[0]} ${EAR_PIVOT[1]}`
    expect(MARK_PATHS.crown).toContain(valley)
    expect(MARK_EARS.near.crown).toContain(valley)
    expect(MARK_EARS.far.crown.startsWith(`M${valley}`)).toBe(true)
    expect(MARK_EARS.near.inner + MARK_EARS.far.inner).toBe(MARK_PATHS.inner)
  })

  it('holds still for readers who ask for less motion, over every trigger', () => {
    const css = earFlickCss(['&:hover'])
    const keys = Object.keys(css)
    expect(keys.at(-1)).toBe('@media (prefers-reduced-motion: reduce)')
    expect(css['@media (prefers-reduced-motion: reduce)']).toEqual({ '& [data-ear]': { animation: 'none !important' } })
  })
})
