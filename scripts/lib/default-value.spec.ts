import { describe, expect, it } from 'vitest'
import { codeSpan, defaultMarkdown } from './default-value'

describe('defaultMarkdown', () => {
  it('reads a tag TypeDoc fenced, one written with no code span, as the prose it was written as', () => {
    expect(defaultMarkdown('```ts\nevery type\n```')).toBe('every type')
    expect(defaultMarkdown('```ts\nthe configured scope,\nor the guilds it extends\n```')).toBe(
      'the configured scope,\nor the guilds it extends',
    )
  })

  it('leaves Markdown as it is written: a code span, prose around code spans, and every line of it', () => {
    for (const text of [
      '`false`',
      '`false`: calls are handled while the hooks run',
      "`'debug'` while `NODE_ENV` is `development`, and\n  `'log'` otherwise",
      'One connection, or whatever `clientOptions.shards` says.',
    ])
      expect(defaultMarkdown(text)).toBe(text)
  })
})

describe('codeSpan', () => {
  it('fences code with one more backtick than its longest run, padding a span that starts or ends with one', () => {
    expect(codeSpan("'x'")).toBe("`'x'`")
    expect(codeSpan('a `b` c')).toBe('``a `b` c``')
    expect(codeSpan('`tick`')).toBe('`` `tick` ``')
  })
})
