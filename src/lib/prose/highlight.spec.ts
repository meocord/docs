import { describe, expect, it, vi } from 'vitest'
import { CODE_PALETTES, highlight } from '@/lib/prose/highlight'
import { isKnownLanguage, LANGUAGES } from '@/lib/prose/languages'

const hex = (colour: string) => [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16))
const luminance = (colour: string) => {
  const [r, g, b] = hex(colour).map(c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// Every colour a token can take in one line of code, in the order they appear.
const colours = (html: string, mode: 'dark' | 'light') =>
  [...html.matchAll(new RegExp(`--code-${mode}:(#[0-9A-F]{6})`, 'g'))].map(match => match[1])

describe('the code palettes', () => {
  it.each(['dark', 'light'] as const)('reach 4.5:1 on the code canvas in %s mode', mode => {
    const { background, ...tokens } = CODE_PALETTES[mode]
    for (const [name, colour] of Object.entries(tokens))
      expect(contrast(colour, background), name).toBeGreaterThanOrEqual(4.5)
  })

  it('gives each kind of token its own colour', () => {
    const { background: _background, ...tokens } = CODE_PALETTES.dark
    expect(new Set(Object.values(tokens)).size).toBe(Object.keys(tokens).length)
  })
})

describe('highlight', () => {
  const { dark } = CODE_PALETTES

  it('colours a whole line however slowly it tokenizes, as in a busy build worker', () => {
    // Each reading of the clock a second later: past a time limit, the rest of the line would take one colour.
    let now = 0
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000))
    try {
      const tokens = colours(highlight("declare function Record<'<b>', string>(): void", 'ts')!, 'dark')
      for (const kind of ['keyword', 'func', 'punct', 'string', 'type', 'operator'] as const)
        expect(tokens, kind).toContain(dark[kind])
    } finally {
      clock.mockRestore()
    }
  })

  it('colours a decorator, a keyword, a string, a number, a regex and a comment each their own way', () => {
    const tokens = colours(highlight("@Command('go')\nconst n = 5 + /a+/.source.length // note", 'ts')!, 'dark')
    for (const kind of ['decorator', 'keyword', 'string', 'number', 'regex', 'comment', 'operator'] as const)
      expect(tokens, kind).toContain(dark[kind])
  })

  it('draws every language it lists', () => {
    for (const name of Object.keys(LANGUAGES)) expect(highlight('x', name), name).toBeDefined()
  })

  it('draws plain text and unknown names as nothing, and knows which are which', () => {
    expect(highlight('x', 'text')).toBeUndefined()
    expect(highlight('x', undefined)).toBeUndefined()
    expect(isKnownLanguage('text')).toBe(true)
    expect(isKnownLanguage(undefined)).toBe(true)
    expect(isKnownLanguage('TypeScript')).toBe(true)
    expect(isKnownLanguage('cobol')).toBe(false)
  })
})
