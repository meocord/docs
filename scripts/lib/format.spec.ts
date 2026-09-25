import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { formatFiles } from './format.js'

const dir = mkdtempSync(path.join(tmpdir(), 'meocord-docs-format-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('formatFiles', () => {
  it('formats Markdown and JSON under the targets, and leaves other files alone', async () => {
    mkdirSync(path.join(dir, 'content'))
    writeFileSync(path.join(dir, 'content', 'page.md'), '*   one\n*   two\n')
    writeFileSync(path.join(dir, 'versions.json'), '{"lines":[ ]}')
    writeFileSync(path.join(dir, 'content', 'note.txt'), '*   untouched\n')

    await formatFiles([path.join(dir, 'content'), path.join(dir, 'versions.json'), path.join(dir, 'missing')])

    expect(readFileSync(path.join(dir, 'content', 'page.md'), 'utf8')).toBe('- one\n- two\n')
    expect(readFileSync(path.join(dir, 'versions.json'), 'utf8')).toBe('{ "lines": [] }\n')
    expect(readFileSync(path.join(dir, 'content', 'note.txt'), 'utf8')).toBe('*   untouched\n')
  })
})
