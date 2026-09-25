import { describe, expect, it } from 'vitest'
import { EAR_PIVOT, earFlickCss, flickAngles, FLICK_SECONDS } from '@/lib/brand/ear-flick'
import { MARK_EARS, MARK_PATHS } from '@/lib/brand/mark-paths'

describe('the ear flick', () => {
  it('matches the avatar’s frames, every 30 ms', () => {
    // far / near, as the brand tools' flickAngles samples them for the animated avatar
    const avatar = [
      [0, 0],
      [7.6, 0],
      [9.1, 0],
      [6.8, -1.3],
      [3.1, -3.5],
      [0, -3.5],
      [-1.7, -2.2],
      [-2, -0.8],
      [-1.5, 0.3],
      [-0.7, 0.8],
      [0, 0.8],
      [0.4, 0.5],
      [0.5, 0.2],
      [0.3, -0.1],
      [0.2, -0.2],
      [0, -0.2],
      [-0.1, -0.1],
      [-0.1, 0],
      [-0.1, 0],
      [0, 0],
      [0, 0],
    ]
    const ours = avatar.map((_, index) => flickAngles((index * 30) / 1000)).map(({ far, near }) => [far, near])
    expect(ours).toEqual(avatar)
    expect(flickAngles(FLICK_SECONDS)).toEqual({ far: 0, near: 0 })
  })

  it('splits the crown at the valley both ears turn about', () => {
    const valley = `${EAR_PIVOT[0]} ${EAR_PIVOT[1]}`
    expect(MARK_PATHS.crown).toContain(valley)
    expect(MARK_EARS.near.crown).toContain(`${valley}V`)
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
