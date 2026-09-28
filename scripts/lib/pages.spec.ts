import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { listPages, loadPage, migratingGuide, pagesDir, resolveExample } from './pages.js'

const root = mkdtempSync(path.join(tmpdir(), 'meocord-docs-pages-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const write = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), text)
}

write(
  'versions.json',
  JSON.stringify({
    package: 'meocord',
    lines: [
      { line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.0'] },
      { line: '4.0', status: 'current', guides: 'readme', versions: ['4.0.0'] },
    ],
  }),
)
write(
  'generated/readme/4.0/guards.md',
  '---\nid: guards\ntitle: Guards\norder: 2\nsource: readme@4.0.0\n---\n\nImported.\n',
)
write(
  'generated/readme/4.0/overview.md',
  '---\nid: overview\ntitle: Overview\norder: 0\n---\n\nRun `npx {{meocord}} create`.\n',
)
write('content/4.0/draft.md', '---\nid: draft\ntitle: Draft\n---\n\nNot shown yet.\n')
write('content/4.1/guards.md', '---\nid: guards\ntitle: Guards\nchapter: pipeline\norder: 2\n---\n\nGuards.\n')
write(
  'examples/4.1/src/guards/owner.guard.ts',
  "import { Guard } from 'meocord/decorator'\n\n// #region guard\n@Guard()\nexport class OwnerGuard {\n  // #region check\n  check() {}\n  // #endregion check\n}\n// #endregion guard\n",
)

describe('pagesDir, listPages and loadPage', () => {
  it("reads a line's README pages, in sidebar order, and none for a line whose guides are authored", () => {
    expect(pagesDir('4.0', { root })).toBe(path.join(root, 'generated', 'readme', '4.0'))
    expect(listPages('4.0', { root }).map(page => page.slug)).toEqual(['overview', 'guards'])
    expect(listPages('4.1', { root })).toEqual([])
    expect(loadPage('4.1', 'guards', { root })).toBeUndefined()
  })

  it('loads a shown page, and nothing for a page the line does not show or a slug that is not one', () => {
    expect(loadPage('4.0', 'guards', { root })).toEqual({
      frontmatter: { id: 'guards', title: 'Guards', order: 2, source: 'readme@4.0.0' },
      body: '\nImported.\n',
    })
    expect(loadPage('4.0', 'draft', { root })).toBeUndefined()
    expect(loadPage('4.0', '../4.1/guards', { root })).toBeUndefined()
  })

  it("writes the line's package spec for {{meocord}}: the package for the current line, its tag for a prerelease", () => {
    expect(loadPage('4.0', 'overview', { root })?.body).toBe('\nRun `npx meocord create`.\n')
    write('content/migrating/4.1.md', '# Migrating\n\n`npx {{meocord}} create`\n')
    expect(migratingGuide('4.1', { root })).toBe('# Migrating\n\n`npx meocord@beta create`\n')
  })

  it('refuses a line versions.json does not list, and lists nothing for a line without pages', () => {
    expect(() => listPages('3.2', { root })).toThrow('Line "3.2" is not in versions.json.')
    write(
      'versions.json',
      JSON.stringify({ lines: [{ line: '4.2', status: 'prerelease', guides: 'authored', versions: [] }] }),
    )
    expect(listPages('4.2', { root })).toEqual([])
  })
})

describe('resolveExample', () => {
  it('gives a region dedented without nested markers, or the whole file', () => {
    expect(resolveExample('4.1', 'guards/owner.guard.ts', 'guard', { root })).toBe(
      '@Guard()\nexport class OwnerGuard {\n  check() {}\n}',
    )
    expect(resolveExample('4.1', 'guards/owner.guard.ts', 'check', { root })).toBe('check() {}')
    expect(resolveExample('4.1', 'guards/owner.guard.ts', undefined, { root })).toContain(
      "import { Guard } from 'meocord/decorator'",
    )
  })

  it('refuses a missing file or region, and a path outside the line’s examples', () => {
    expect(() => resolveExample('4.1', 'nope.ts', undefined, { root })).toThrow(
      'examples/4.1/src/nope.ts does not exist.',
    )
    expect(() => resolveExample('4.1', 'guards/owner.guard.ts', 'nope', { root })).toThrow('has no region "nope"')
    expect(() => resolveExample('4.1', '../../4.0/secret.ts', undefined, { root })).toThrow(
      'is outside examples/4.1/src',
    )
  })
})
