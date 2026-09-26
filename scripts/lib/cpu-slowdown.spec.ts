import { describe, expect, it } from 'vitest'
import { calculatorSlowdown, cpuSlowdownFor, MAX_CPU_SLOWDOWN } from './cpu-slowdown'

describe('calculatorSlowdown', () => {
  it("meets the calculator's anchors", () => {
    expect(calculatorSlowdown(150)).toBe(1)
    expect(calculatorSlowdown(800)).toBe(2)
    expect(calculatorSlowdown(1300)).toBe(3)
    expect(calculatorSlowdown(1533)).toBeCloseTo(4, 2)
    expect(calculatorSlowdown(2000)).toBeCloseTo(6, 2)
  })

  it('grows steadily between and beyond them', () => {
    expect(calculatorSlowdown(475)).toBeCloseTo(1.5, 5)
    expect(calculatorSlowdown(1050)).toBeCloseTo(2.5, 5)
    expect(calculatorSlowdown(4039)).toBeCloseTo(3 + 2739 / 233, 5)
  })

  it('refuses a host too slow to stand for the target phone, or no measurement', () => {
    expect(() => calculatorSlowdown(149)).toThrow(/too slow/)
    expect(() => calculatorSlowdown(Number.NaN)).toThrow(/too slow/)
  })
})

describe('cpuSlowdownFor', () => {
  it("is the calculator's slowdown up to its last anchor, and on until the cap", () => {
    for (const index of [150, 800, 1300, 1533, 2000, 2207])
      expect(cpuSlowdownFor(index)).toBe(calculatorSlowdown(index))
  })

  it('stops at 10x for the fastest hosts', () => {
    expect(MAX_CPU_SLOWDOWN).toBe(10)
    expect(cpuSlowdownFor(2997)).toBe(10)
    expect(cpuSlowdownFor(4039)).toBe(10)
  })
})
