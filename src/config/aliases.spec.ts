import { describe, expect, it } from 'vitest'
import manifest from '../../versions.json'
import { aliases } from '../../scripts/lib/line-aliases'
import { DOC_ALIASES, docAliases } from '@/config/aliases'

describe('DOC_ALIASES', () => {
  it('is what versions.json says, as the build checks read it', () => {
    expect(DOC_ALIASES).toEqual(aliases(manifest))
  })

  it('moves latest to a line its stable release makes current, and has no next once nothing is in prerelease', () => {
    const released = {
      lines: [
        { line: '4.1', status: 'current' },
        { line: '4.0', status: 'maintained' },
      ],
    }
    expect(docAliases(released)).toEqual({ latest: '4.1' })
  })

  it('is refused without a current line, which /docs/latest needs', () => {
    expect(() => docAliases({ lines: [{ line: '4.1', status: 'prerelease' }] })).toThrow(/no current line/)
  })
})
