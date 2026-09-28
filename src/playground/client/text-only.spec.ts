import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// A run's result comes from the reader's code; the page sets it as text, never as markup
const MARKUP =
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|srcdoc)\b|document\.write/

describe("the playground's page side", () => {
  it('builds every element itself and sets what a result carries as text', () => {
    const dir = path.join(__dirname)
    const files = readdirSync(dir).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    expect(files).toEqual(expect.arrayContaining(['describe.ts', 'result-view.ts', 'runner.ts']))
    for (const file of [
      ...files.map(each => path.join(dir, each)),
      path.join(dir, '../../components/prose/PlaygroundIsland.ts'),
    ])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(MARKUP)
  })
})
