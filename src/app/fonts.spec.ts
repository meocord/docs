import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// JetBrains Mono per 1000 units, and each stand-in's advance per 2048: from the font files.
const MONO = { advance: 600 / 1000, ascent: 1020 / 1000, descent: 300 / 1000 }
const ADVANCE: Record<string, number> = {
  'Mono Fallback Menlo': 1233 / 2048,
  'Mono Fallback DejaVu': 1233 / 2048,
  'Mono Fallback Liberation': 1229 / 2048,
  'Mono Fallback Consolas': 1126 / 2048,
}

const css = readFileSync('src/app/globals.css', 'utf8')
const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body]) => {
  const value = (name: string) => new RegExp(`${name}: ([^;]+);`).exec(body)?.[1].trim() ?? ''
  const percent = (name: string) => Number.parseFloat(value(name)) / 100
  return {
    family: value('font-family').replace(/'/g, ''),
    size: percent('size-adjust'),
    ascent: percent('ascent-override'),
    descent: percent('descent-override'),
    gap: percent('line-gap-override'),
  }
})

describe('the mono stand-ins', () => {
  it('declares one for each system monospace face, and the mono stack names them in order', () => {
    expect(faces.map(face => face.family)).toEqual(Object.keys(ADVANCE))
    const tokens = readFileSync('src/constants/themes/tokens.ts', 'utf8')
    expect(tokens).toContain(
      `var(--font-mono), ${Object.keys(ADVANCE)
        .map(name => `'${name}'`)
        .join(', ')}, ui-monospace`,
    )
  })

  it.each(faces)('gives $family the mono’s advance, ascent and descent', face => {
    // Code wraps at the same column, and a line stands as tall, before and after the mono arrives.
    expect(ADVANCE[face.family] * face.size).toBeCloseTo(MONO.advance, 4)
    expect(face.ascent * face.size).toBeCloseTo(MONO.ascent, 3)
    expect(face.descent * face.size).toBeCloseTo(MONO.descent, 3)
    expect(face.gap).toBe(0)
  })
})
