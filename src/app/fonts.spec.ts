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

// Instrument Sans per 1000 units: its ascent and descent, and its average advance over Next's calcAverageWidth
// sample at each weight the site uses, as Chromium lays the variable face out.
const SANS = { ascent: 970 / 1000, descent: 250 / 1000 }
const SANS_AVERAGE: Record<number, number> = { 400: 471, 500: 478.1777, 600: 485.3571, 700: 492.5349 }
// Each stand-in's average advance per 2048 over the same sample, and the faces its weight names: from the font files.
// Arial, Helvetica, Liberation Sans and Arimo share their advances, regular and bold.
const ARIAL = { regular: 934.5116, bold: 1011.0465 }
const SANS_FACES: Record<string, Record<number, { average: number; names: string[] }>> = {
  'Sans Fallback Arial': {
    400: {
      average: ARIAL.regular,
      names: ['Arial', 'ArialMT', 'Helvetica', 'Liberation Sans', 'LiberationSans', 'Arimo', 'Arimo-Regular'],
    },
    500: {
      average: ARIAL.regular,
      names: ['Arial', 'ArialMT', 'Helvetica', 'Liberation Sans', 'LiberationSans', 'Arimo', 'Arimo-Regular'],
    },
    600: {
      average: ARIAL.bold,
      names: [
        'Arial Bold',
        'Arial-BoldMT',
        'Helvetica Bold',
        'Helvetica-Bold',
        'Liberation Sans Bold',
        'LiberationSans-Bold',
        'Arimo Bold',
        'Arimo-Bold',
      ],
    },
    700: {
      average: ARIAL.bold,
      names: [
        'Arial Bold',
        'Arial-BoldMT',
        'Helvetica Bold',
        'Helvetica-Bold',
        'Liberation Sans Bold',
        'LiberationSans-Bold',
        'Arimo Bold',
        'Arimo-Bold',
      ],
    },
  },
  'Sans Fallback Roboto': {
    400: { average: 938, names: ['Roboto', 'Roboto-Regular'] },
    500: { average: 946.6512, names: ['Roboto Medium', 'Roboto-Medium'] },
    600: { average: 952.3256, names: ['Roboto Bold', 'Roboto-Bold'] },
    700: { average: 952.3256, names: ['Roboto Bold', 'Roboto-Bold'] },
  },
  'Sans Fallback DejaVu': {
    400: { average: 1070.3023, names: ['DejaVu Sans', 'DejaVuSans'] },
    500: { average: 1070.3023, names: ['DejaVu Sans', 'DejaVuSans'] },
    600: { average: 1205.9535, names: ['DejaVu Sans Bold', 'DejaVuSans-Bold'] },
    700: { average: 1205.9535, names: ['DejaVu Sans Bold', 'DejaVuSans-Bold'] },
  },
}

// Family names a system resolves to a face of its own: CSS's generic families, and the aliases fontconfig's
// fonts.conf rewrites to one (mono, sans, sans serif, system ui). fontconfig compares those case-insensitively (and,
// for <alias> rules, ignoring blanks); blanks are dropped here too, which only rejects more names.
const GENERIC_FAMILIES = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'mono',
  'sans',
  'sans serif',
  'system ui',
].map(name => name.replace(/\s/g, ''))

const css = readFileSync('src/app/globals.css', 'utf8')
const tokens = readFileSync('src/constants/themes/tokens.ts', 'utf8')
const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body]) => {
  const value = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1].trim() ?? ''
  const percent = (name: string) => Number.parseFloat(value(name)) / 100
  return {
    family: value('font-family').replace(/'/g, ''),
    names: [...value('src').matchAll(/local\('([^']+)'\)/g)].map(([, name]) => name),
    weight: Number(value('font-weight')),
    size: percent('size-adjust'),
    ascent: percent('ascent-override'),
    descent: percent('descent-override'),
    gap: percent('line-gap-override'),
  }
})
const monoFaces = faces.filter(face => face.family.startsWith('Mono '))
const sansFaces = faces.filter(face => face.family.startsWith('Sans '))

describe('the web fonts', () => {
  it('take family names no system resolves to its own face', () => {
    // next/font names each family after its export. Were one a generic, Chromium on Linux would draw the
    // default face once the font fails, in place of the stand-ins after it.
    const families = [...readFileSync('src/app/fonts.ts', 'utf8').matchAll(/export const (\w+) = localFont\(/g)].map(
      ([, name]) => name,
    )
    expect(families).toHaveLength(2)
    for (const family of families) expect(GENERIC_FAMILIES, family).not.toContain(family.toLowerCase())
  })
})

describe('the mono stand-ins', () => {
  it('declares one for each system monospace face, and the mono stack names them in order', () => {
    expect(monoFaces.map(face => face.family)).toEqual(Object.keys(ADVANCE))
    expect(tokens).toContain(
      `var(--font-mono), ${Object.keys(ADVANCE)
        .map(name => `'${name}'`)
        .join(', ')}, ui-monospace`,
    )
  })

  it.each(monoFaces)('gives $family the mono’s advance, ascent and descent', face => {
    // Code wraps at the same column, and a line stands as tall, before and after the mono arrives.
    expect(ADVANCE[face.family] * face.size).toBeCloseTo(MONO.advance, 4)
    expect(face.ascent * face.size).toBeCloseTo(MONO.ascent, 3)
    expect(face.descent * face.size).toBeCloseTo(MONO.descent, 3)
    expect(face.gap).toBe(0)
  })
})

describe('the sans stand-ins', () => {
  const stack = `var(--font-sans), ${Object.keys(SANS_FACES)
    .map(name => `'${name}'`)
    .join(', ')}, system-ui, sans-serif`

  it('declares each stand-in at each weight the site uses, and both sans stacks name them in order', () => {
    expect(sansFaces.map(face => `${face.family} ${face.weight}`)).toEqual(
      Object.entries(SANS_FACES).flatMap(([family, weights]) =>
        Object.keys(weights).map(weight => `${family} ${weight}`),
      ),
    )
    expect(tokens).toContain(stack)
    expect(css.replace(/\s+/g, ' ')).toContain(`font-family: ${stack};`)
  })

  it.each(sansFaces)(
    'gives $family at $weight Instrument Sans’s advance, ascent and descent from that weight’s face',
    face => {
      const { average, names } = SANS_FACES[face.family][face.weight]
      // local() matches a face's full or PostScript name, so each weight names the face of that weight.
      expect(face.names).toEqual(names)
      // Text wraps at the same width, and a line stands as tall, before and after Instrument Sans arrives.
      expect((average / 2048) * face.size).toBeCloseTo(SANS_AVERAGE[face.weight] / 1000, 4)
      expect(face.ascent * face.size).toBeCloseTo(SANS.ascent, 3)
      expect(face.descent * face.size).toBeCloseTo(SANS.descent, 3)
      expect(face.gap).toBe(0)
    },
  )
})
