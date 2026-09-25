import { describe, expect, it } from 'vitest'
import type { VersionsManifest } from '@/lib/urls'
import { versionOption, versionOptions } from '@/lib/version-options'

const BETA: VersionsManifest = {
  lines: [
    { line: '4.1', status: 'prerelease' },
    { line: '4.0', status: 'current' },
    { line: '3.9', status: 'maintained' },
    { line: '3.8', status: 'archived' },
  ],
}

describe('versionOptions', () => {
  it('lists every line, the current one as latest at its alias', () => {
    expect(versionOptions(BETA)).toEqual([
      { label: '4.1', href: '/docs/4.1', status: 'prerelease' },
      { label: '4.0', href: '/docs/latest', status: 'latest' },
      { label: '3.9', href: '/docs/3.9', status: 'maintained' },
      { label: '3.8', href: '/docs/3.8', status: 'archived' },
    ])
  })

  it('finds one line, and refuses a line the manifest does not list', () => {
    expect(versionOption('4.0', BETA)).toMatchObject({ href: '/docs/latest' })
    expect(() => versionOption('2.0', BETA)).toThrow('Line "2.0" is not in versions.json.')
  })
})
