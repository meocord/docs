import { describe, expect, it } from 'vitest'
import { e2ePort } from './port'

describe('e2ePort', () => {
  it('takes E2E_PORT when set', () => {
    expect(e2ePort({ E2E_PORT: '5000' }, '/any')).toBe(5000)
  })

  it('rejects an E2E_PORT that is not a usable port', () => {
    for (const value of ['abc', '0', '65535', '4300.5']) {
      expect(() => e2ePort({ E2E_PORT: value }, '/any')).toThrow(`not '${value}'`)
    }
  })

  it('derives a stable, even port in 4300–4898 from the path', () => {
    const port = e2ePort({}, '/work/docs/a')
    expect(e2ePort({}, '/work/docs/a')).toBe(port)
    expect(port % 2).toBe(0)
    expect(port).toBeGreaterThanOrEqual(4300)
    expect(port + 1).toBeLessThanOrEqual(4899)
  })

  it('gives different checkouts different ports', () => {
    const ports = new Set(['a', 'b', 'c', 'd', 'e'].map(name => e2ePort({}, `/work/docs/${name}`)))
    expect(ports.size).toBe(5)
  })
})
