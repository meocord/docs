import { describe, expect, it } from 'vitest'
import { markdownAnchors } from './migrating.js'

describe('markdownAnchors', () => {
  it('gives GitHub’s anchors, numbering repeats and skipping code', () => {
    expect(
      markdownAnchors('# Upgrading from 4.0 to 4.1\n## Smaller changes\n```\n# not a heading\n```\n## Smaller changes'),
    ).toEqual(['upgrading-from-40-to-41', 'smaller-changes', 'smaller-changes-1'])
  })
})
