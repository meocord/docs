import { describe, expect, it } from 'vitest'
import { commentsOf } from './comments'

describe('commentsOf', () => {
  it("finds a file's line and block comments, and no `//` inside a string or template", () => {
    const source = [
      "const url = 'https://example.com/his' // a note",
      '/** A block comment */',
      'const text = `// not a comment ${url}`',
    ].join('\n')
    expect(commentsOf(source)).toEqual([
      { text: '// a note', offset: source.indexOf('// a note') },
      { text: '/** A block comment */', offset: source.indexOf('/**') },
    ])
  })
})
