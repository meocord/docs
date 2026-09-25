import { describe, expect, it } from 'vitest'
import { EAR_PIVOT, earFlickCss, flickAngles, FLICK_SECONDS } from '@/lib/brand/ear-flick'
import { MARK_EARS, MARK_PATHS } from '@/lib/brand/mark-paths'

describe('the ear flick', () => {
  it('matches the avatar’s frames, every 30 ms', () => {
    // far / near, as the brand tools' flickAngles samples them for the animated avatar
    const avatar = [
      [0, 0],
      [9.5, 0],
      [12.4, 0],
      [10, -1.1],
      [5, -3.2],
      [0, -3.3],
      [-3.2, -2.3],
      [-4.2, -0.8],
      [-3.4, 0.3],
      [-1.7, 0.9],
      [0, 1],
      [1.1, 0.6],
      [1.5, 0.2],
      [1.2, -0.1],
      [0.6, -0.3],
      [0, -0.3],
      [-0.4, -0.2],
      [-0.5, -0.1],
      [-0.4, 0],
      [-0.2, 0.1],
      [0, 0.1],
      [0.1, 0.1],
      [0.2, 0],
      [0.1, 0],
      [0.1, 0],
      [0, 0],
    ]
    const ours = avatar.map((_, index) => flickAngles((index * 30) / 1000)).map(({ far, near }) => [far, near])
    expect(ours).toEqual(avatar)
    expect(flickAngles(FLICK_SECONDS)).toEqual({ far: 0, near: 0 })
  })

  it('splits the crown at the valley both ears turn about', () => {
    const valley = `${EAR_PIVOT[0]} ${EAR_PIVOT[1]}`
    expect(MARK_PATHS.crown).toContain(valley)
    expect(MARK_EARS.near.crown).toContain(`${valley}L`)
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
