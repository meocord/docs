import { describe, expect, it } from 'vitest'
import { cpuSlowdownFor } from './cpu-slowdown'

describe('cpuSlowdownFor', () => {
  it("meets the calculator's anchors", () => {
    expect(cpuSlowdownFor(150)).toBe(1)
    expect(cpuSlowdownFor(800)).toBe(2)
    expect(cpuSlowdownFor(1300)).toBe(3)
    expect(cpuSlowdownFor(1533)).toBeCloseTo(4, 2)
    expect(cpuSlowdownFor(2000)).toBeCloseTo(6, 2)
  })

  it('grows steadily between and beyond them', () => {
    expect(cpuSlowdownFor(475)).toBeCloseTo(1.5, 5)
    expect(cpuSlowdownFor(1050)).toBeCloseTo(2.5, 5)
    expect(cpuSlowdownFor(4096)).toBeCloseTo(3 + 2796 / 233, 5)
  })

  it('refuses a host too slow to stand for the target phone, or no measurement', () => {
    expect(() => cpuSlowdownFor(149)).toThrow(/too slow/)
    expect(() => cpuSlowdownFor(Number.NaN)).toThrow(/too slow/)
  })
})
