import { describe, expect, it } from 'vitest'
import { importReadme, pageFile } from './readme.js'

const README = `# MeoCord

A framework. See [Guards](#guards) and the [changelog](./CHANGELOG.md).

## Table of Contents

- [Guards](#guards)

## Getting Started

### Install

Read the [migration guide](docs/MIGRATING.md#upgrading), the [license](./LICENSE) and [guard params](#passing-options).

\`\`\`md
## Not a section
\`\`\`

## Guards

### Passing options

Back to [installing](#install).
`

const imported = importReadme(README, { line: '4.0', commitUrl: 'https://github.com/meocord/meocord/blob/abc' })
const page = (slug: string) => imported.pages.find(entry => entry.slug === slug)!

describe('importReadme', () => {
  it('makes a page per section, the intro as the overview, and skips the table of contents', () => {
    expect(imported.pages.map(entry => [entry.slug, entry.title])).toEqual([
      ['overview', 'Overview'],
      ['getting-started', 'Getting Started'],
      ['guards', 'Guards'],
    ])
    expect(page('getting-started').body).toContain('## Not a section')
  })

  it('maps every heading to its page', () => {
    expect(imported.anchors).toEqual({
      'getting-started': 'getting-started',
      install: 'getting-started',
      guards: 'guards',
      'passing-options': 'guards',
    })
  })

  it('points links at the pages and files that hold them', () => {
    expect(page('overview').body).toContain('[Guards](/docs/4.0/guards#guards)')
    expect(page('overview').body).toContain('[changelog](/docs/4.0/changelog)')
    expect(page('getting-started').body).toContain('(/docs/4.0/migrating#upgrading)')
    expect(page('getting-started').body).toContain('(https://github.com/meocord/meocord/blob/abc/LICENSE)')
    expect(page('getting-started').body).toContain('(/docs/4.0/guards#passing-options)')
    expect(page('guards').body).toContain('[installing](/docs/4.0/getting-started#install)')
  })
})

describe('pageFile', () => {
  it('writes front matter a page is read back by', () => {
    expect(pageFile(page('guards'), 'readme@4.0.0')).toMatch(
      /^---\nid: guards\ntitle: "Guards"\norder: 3\nsource: readme@4\.0\.0\n---\n\n### Passing options/,
    )
  })
})
