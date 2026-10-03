import { describe, expect, it } from 'vitest'
import { lineKey } from '@/lib/line-key'

describe('lineKey', () => {
  it('reads latest as the line it stands for, so one line keeps one key', () => {
    expect(lineKey('/docs/latest/guards', '4.1')).toBe('4.1')
    expect(lineKey('/docs/4.1/api/4.1.0/decorators/Defer', '4.1')).toBe('4.1')
    expect(lineKey('/docs/latest', '4.1')).toBe('4.1')
  })

  it('keeps another line its own, and leaves pages outside the docs', () => {
    expect(lineKey('/docs/4.0/guards', '4.1')).toBe('4.0')
    expect(lineKey('/', '4.1')).toBeUndefined()
    expect(lineKey('/playground', '4.1')).toBeUndefined()
  })
})
