import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// meo-canvas is a native addon: only the icons script and the OG route may reach it. A page or
// component that reaches it, even through another module, loads the addon into every page render.
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const ALLOWED = [path.join(SRC, 'app', 'og')]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) return sources(file)
    return /\.(ts|mts)$/.test(name) && !/\.spec\.ts$/.test(name) ? [file] : []
  })
}

function resolve(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith('@/')
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(from), specifier)
      : undefined
  if (!base) return undefined
  return [base, `${base}.ts`, path.join(base, 'index.ts')].find(file => existsSync(file) && statSync(file).isFile())
}

/** The chain of imports from `file` to meo-canvas, or undefined when it never gets there. */
function pathToAddon(file: string, seen = new Set<string>()): string[] | undefined {
  if (seen.has(file)) return undefined
  seen.add(file)
  const text = readFileSync(file, 'utf8')
  for (const [, specifier] of text.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (specifier === 'meo-canvas') return [file]
    const next = resolve(file, specifier)
    const chain = next && pathToAddon(next, seen)
    if (chain) return [file, ...chain]
  }
  return undefined
}

describe('meo-canvas stays out of page rendering', () => {
  const entries = [...sources(path.join(SRC, 'app')), ...sources(path.join(SRC, 'components'))].filter(
    file => !ALLOWED.some(dir => file.startsWith(dir + path.sep)),
  )

  it.each(entries.map(file => [path.relative(ROOT, file), file]))('%s does not reach meo-canvas', (_name, file) => {
    const chain = pathToAddon(file)
    expect(chain?.map(step => path.relative(ROOT, step)).join(' → ')).toBeUndefined()
  })

  it('finds the addon where it is imported on purpose', () => {
    expect(pathToAddon(path.join(SRC, 'app', 'og', '[line]', '[file]', 'route.ts'))).toBeDefined()
  })
})
