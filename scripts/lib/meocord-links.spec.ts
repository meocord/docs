import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { docsLinks, linkProblem, textsUnder } from './meocord-links'

describe('docsLinks', () => {
  it('finds each meocord.dev docs path once, sorted, without trailing punctuation', () => {
    const texts = [
      '/** See {@link https://meocord.dev/docs/4.1/guards | Guards}. */',
      ' * [Cooldowns](https://meocord.dev/docs/4.1/cooldowns#stacking), and https://meocord.dev/docs/4.1/guards.',
      ' * Elsewhere: https://example.com/docs/4.1/guards and https://meocord.dev/blog',
    ]
    expect(docsLinks(texts)).toEqual(['/docs/4.1/cooldowns#stacking', '/docs/4.1/guards'])
  })
})

describe('textsUnder', () => {
  it('reads the files with the given endings, skipping node_modules', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'meocord-links-'))
    mkdirSync(path.join(root, 'core'))
    mkdirSync(path.join(root, 'node_modules'))
    writeFileSync(path.join(root, 'core', 'index.d.ts'), 'a')
    writeFileSync(path.join(root, 'index.d.cts'), 'b')
    writeFileSync(path.join(root, 'index.js'), 'c')
    writeFileSync(path.join(root, 'node_modules', 'x.d.ts'), 'd')
    expect(textsUnder(root, ['.d.ts', '.d.cts']).sort()).toEqual(['a', 'b'])
    expect(textsUnder(path.join(root, 'none'), ['.ts'])).toEqual([])
  })
})

describe('linkProblem', () => {
  it('passes a 200 page with the heading a link names, and says what is wrong otherwise', () => {
    expect(linkProblem('/docs/4.1/guards', 200, '<h1>Guards</h1>')).toBeUndefined()
    expect(linkProblem('/docs/4.1/guards#options', 200, '<h2 id="options">Options</h2>')).toBeUndefined()
    expect(linkProblem('/docs/4.1/guards#nope', 200, '<h2 id="options">')).toBe(
      '/docs/4.1/guards#nope: the page has no #nope',
    )
    expect(linkProblem('/docs/4.1/nope', 404, '')).toBe('/docs/4.1/nope: answered 404')
    // The page a line shows for a topic it lacks answers 200, but the link has missed.
    expect(
      linkProblem('/docs/4.0/components', 200, '<h1>', 'http://localhost/docs/4.0/missing/component-routing'),
    ).toBe('/docs/4.0/components: its line has no such page (it lands on /docs/4.0/missing/component-routing)')
  })
})
