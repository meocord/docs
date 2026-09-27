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

  it('finds the comments after a template with a substitution, and after a regex holding a quote', () => {
    const source = [
      'const greeting = `Hello, ${name}!`',
      '// after a template',
      "const quote = /'/",
      '// after a regex',
      'const note = `${a} // not a comment`',
    ].join('\n')
    expect(commentsOf(source).map(comment => comment.text)).toEqual(['// after a template', '// after a regex'])
  })
})
