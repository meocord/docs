import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { themeTokens } from '@/constants/themes/tokens'
import { CODE_PALETTES } from '@/lib/prose/highlight'

const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`No ${selector} block in globals.css`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
  const declarations = new Map<string, string>()
  for (const match of body.matchAll(/(--mc-[a-z0-9-]+):\s*([^;]+);/g)) declarations.set(match[1], match[2].trim())
  return declarations
}

const palettes = { dark: block(':root'), light: block(":root[data-theme='light']") }

function referenced(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') for (const match of value.matchAll(/var\((--mc-[a-z0-9-]+)\)/g)) into.add(match[1])
  else if (value && typeof value === 'object') for (const nested of Object.values(value)) referenced(nested, into)
  return into
}

type Rgba = [number, number, number, number]

function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as Rgba
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(colour)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])]
  throw new Error(`Unparsed colour ${colour}`)
}

const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba => [
  r * a + br * (1 - a),
  g * a + bg * (1 - a),
  b * a + bb * (1 - a),
  1,
]

function luminance([r, g, b]: Rgba): number {
  const channel = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(fg: Rgba, bg: Rgba): number {
  const [a, b] = [luminance(over(fg, bg)), luminance(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

describe('palettes', () => {
  it('declare the same variables in both modes', () => {
    expect([...palettes.light.keys()].sort()).toEqual([...palettes.dark.keys()].sort())
  })

  it('declare every variable a token names', () => {
    for (const name of referenced(themeTokens)) {
      expect(palettes.dark.has(name), name).toBe(true)
      expect(palettes.light.has(name), name).toBe(true)
    }
  })

  // Text at 4.5:1 or better, glyphs and rules at 3:1, on the sheet every page is read on.
  describe.each(['dark', 'light'] as const)('in %s mode', mode => {
    const colour = (name: string) => parse(palettes[mode].get(`--mc-${name}`)!)
    const sheet = colour('sheet')

    it.each([
      ['ink-primary', 7],
      ['ink-secondary', 4.5],
      ['ink-quiet', 3],
      ['accent', 4.5],
      ['tip', 4.5],
      ['warning', 4.5],
      ['danger', 4.5],
    ])('%s reaches %s:1 on the sheet', (name, minimum) => {
      expect(contrast(colour(name), sheet)).toBeGreaterThanOrEqual(minimum)
    })

    it.each(['tip', 'warning', 'danger'])('%s reaches 4.5:1 on its own tint', name => {
      expect(contrast(colour(name), over(colour(`${name}-tint`), sheet))).toBeGreaterThanOrEqual(4.5)
    })

    it("keeps the sidebar's tabs at 4.5:1: secondary text on the fill, over the phone sheet's solid sidebar", () => {
      const tabs = over(colour('fill'), colour('material-sidebar-solid'))
      expect(contrast(colour('ink-secondary'), tabs)).toBeGreaterThanOrEqual(4.5)
    })

    it('keeps text on the accent at 4.5:1', () => {
      expect(contrast(colour('accent-content'), colour('accent'))).toBeGreaterThanOrEqual(4.5)
    })

    // Every surface highlighted code is drawn on, in every state: a new one joins this list.
    const codeSurfaces = () => ({
      // A code frame, a signature and the home page's panel
      canvas: colour('canvas'),
      // A type in an API page's parameter table, in inline code's fill
      'a parameter type': over(colour('fill'), colour('sheet')),
      // The home panel's lit line, as the demo runs
      'the lit line': over(colour('accent-band'), colour('canvas')),
      // The home panel's line a stage stopped the call at
      'the stopped line': over(colour('danger-tint'), colour('canvas')),
    })

    it("draws code on the palette's canvas, the background the highlighter is given", () => {
      expect(parse(CODE_PALETTES[mode].background.toLowerCase())).toEqual(colour('canvas'))
    })

    it.each(Object.keys(CODE_PALETTES[mode]).filter(name => name !== 'background'))(
      'keeps %s code at 4.5:1 on every surface code is drawn on',
      name => {
        const token = parse((CODE_PALETTES[mode] as Record<string, string>)[name].toLowerCase())
        for (const [surface, background] of Object.entries(codeSurfaces()))
          expect(contrast(token, background), surface).toBeGreaterThanOrEqual(4.5)
      },
    )
  })
})

describe('theme paths', () => {
  // Every `theme.…` path a style names in a string, from each source file outside the specs
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) return sources(file)
      return /\.tsx?$/.test(entry.name) && !/\.(spec|test-d)\.tsx?$/.test(entry.name) ? [file] : []
    })
  const named = sources(path.join(process.cwd(), 'src')).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].flatMap(([, , text]) =>
      [...text.matchAll(/\btheme\.([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)/g)].map(([, at]) => ({ file, at })),
    ),
  )

  it('are found in the sources', () => {
    expect(named.length).toBeGreaterThan(50)
  })

  it('each name a token, so no style falls back to nothing', () => {
    const missing = named
      .filter(
        ({ at }) =>
          at.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], themeTokens) ===
          undefined,
      )
      .map(({ file, at }) => `${path.relative(process.cwd(), file)}: theme.${at}`)
    expect([...new Set(missing)]).toEqual([])
  })
})
