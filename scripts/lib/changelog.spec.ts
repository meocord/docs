import { describe, expect, it } from 'vitest'
import { parseChangelog, rewriteLibraryLinks, sliceChangelog } from './changelog.js'

const CHANGELOG = `# meocord

## 4.1.0-beta.0

### Minor Changes

- [#66](https://github.com/meocord/meocord/pull/66) Thanks! - Add registration options.

  - \`guilds\` registers to guilds.

  A builder that throws stops registration; see [the guide](https://github.com/meocord/meocord/blob/main/docs/MIGRATING.md#a-builder-that-throws).

### Patch Changes

- Fix a typo. See [Guards](https://github.com/l7aromeo/meocord#guards).

## 4.0.0

### Major Changes

- **Breaking:** Rsbuild replaces webpack.
`

describe('sliceChangelog', () => {
  it('takes one version section, up to the next', () => {
    const section = sliceChangelog(CHANGELOG, '4.1.0-beta.0')

    expect(section.startsWith('### Minor Changes')).toBe(true)
    expect(section).not.toContain('Rsbuild')
    expect(sliceChangelog(CHANGELOG, '4.0.0')).toContain('Rsbuild')
    expect(() => sliceChangelog(CHANGELOG, '4.0.1')).toThrow('no "## 4.0.1" section')
  })
})

describe('rewriteLibraryLinks', () => {
  it('points the migration guide and README at the line’s pages', () => {
    const text = rewriteLibraryLinks(sliceChangelog(CHANGELOG, '4.1.0-beta.0'), '4.1', { guards: 'guards' })

    expect(text).toContain('(/docs/4.1/migrating#a-builder-that-throws)')
    expect(text).toContain('(/docs/4.1/guards#guards)')
  })

  it('leaves a README anchor no page holds, and points the bare README at the line', () => {
    expect(rewriteLibraryLinks('[x](https://github.com/meocord/meocord#nowhere) [y](https://github.com/meocord/meocord)', '4.1')).toBe(
      '[x](https://github.com/meocord/meocord#nowhere) [y](/docs/4.1)',
    )
  })
})

describe('parseChangelog', () => {
  it('splits sections into entries, marking those to act on', () => {
    const doc = parseChangelog('4.1.0-beta.0', rewriteLibraryLinks(sliceChangelog(CHANGELOG, '4.1.0-beta.0'), '4.1'))

    expect(doc.sections.map(section => section.title)).toEqual(['Minor Changes', 'Patch Changes'])
    const [registration] = doc.sections[0].entries
    expect(registration.breaking).toBe(true)
    expect(registration.markdown).toContain('- `guilds` registers to guilds.')
    expect(doc.sections[1].entries[0]).toEqual({ markdown: 'Fix a typo. See [Guards](https://github.com/l7aromeo/meocord#guards).', breaking: false })
  })

  it('marks every major change as breaking', () => {
    const doc = parseChangelog('4.0.0', sliceChangelog(CHANGELOG, '4.0.0'))

    expect(doc.sections[0].entries[0].breaking).toBe(true)
  })
})
