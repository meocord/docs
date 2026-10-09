import { describe, expect, it } from 'vitest'
import { archivedTone, lineIndexed } from '@/config/versions'
import type { LineStatus } from '@/lib/urls'

const manifest = (status: LineStatus) => ({ lines: [{ line: '4.1', status }] })

describe('lineIndexed', () => {
  it.each([
    ['current', true],
    ['prerelease', false],
    ['maintained', false],
    ['archived', false],
  ] as const)('a %s line: %s', (status, indexed) => {
    expect(lineIndexed('4.1', manifest(status))).toBe(indexed)
  })

  it('a line the manifest does not list: false', () => {
    expect(lineIndexed('4.2', manifest('current'))).toBe(false)
  })
})

describe('archivedTone', () => {
  it('warns of a line whose releases carry security advisories in red, and of one a minor superseded in amber', () => {
    expect(archivedTone('4.0')).toBe('danger')
    expect(archivedTone('4.1')).toBe('warning')
  })
})
