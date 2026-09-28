import { build } from 'esbuild'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  checkInstalled,
  contentName,
  frameDocument,
  installedVersion,
  nodeModulesPlugin,
  playgroundLines,
  READER_MODULES,
  runtimeEntry,
} from './playground'
import type { VersionsConfig } from './versions'

const config = (lines: VersionsConfig['lines']): VersionsConfig => ({
  package: 'meocord',
  since: '4.0.0-beta.0',
  provenance: { issuer: 'x', identities: [], integrityOnly: [] },
  lines,
})

describe('playgroundLines', () => {
  it('builds each line whose guides the site writes, at its examples pin', () => {
    const lines = config([
      { line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.6', '4.1.0-beta.7'] },
      { line: '4.0', status: 'current', guides: 'readme', versions: ['4.0.0'] },
    ])
    expect(playgroundLines(lines, line => (line === '4.1' ? '4.1.0-beta.7' : '4.0.0'))).toEqual([
      { line: '4.1', version: '4.1.0-beta.7' },
    ])
  })

  it("refuses a line whose examples pin no exact version, or one that isn't a release of the line", () => {
    const lines = config([{ line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.7'] }])
    expect(() => playgroundLines(lines, () => undefined)).toThrow(
      "examples/4.1 pins no exact meocord version, which isn't a release of 4.1; the playground builds from that pin.",
    )
    expect(() => playgroundLines(lines, () => '4.0.0')).toThrow('examples/4.1 pins meocord 4.0.0')
  })
})

describe('installedVersion', () => {
  it("reads the version Node would resolve from a directory: its own node_modules first, then its parents'", () => {
    const root = mkdtempSync(path.join(tmpdir(), 'playground-installed-'))
    const pkg = (dir: string, version: string) => {
      mkdirSync(path.join(root, dir, 'node_modules', 'meocord'), { recursive: true })
      writeFileSync(path.join(root, dir, 'node_modules', 'meocord', 'package.json'), JSON.stringify({ version }))
    }
    try {
      mkdirSync(path.join(root, 'examples', '4.0'), { recursive: true })
      pkg('.', '4.0.1')
      pkg('examples/4.1', '4.1.0-beta.7')
      expect(installedVersion('meocord', path.join(root, 'examples', '4.1'))).toBe('4.1.0-beta.7')
      expect(installedVersion('meocord', path.join(root, 'examples', '4.0'))).toBe('4.0.1')
      expect(installedVersion('discord.js', path.join(root, 'examples', '4.1'))).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('checkInstalled', () => {
  it('passes the pinned version, and refuses another or none, naming both', () => {
    expect(() => checkInstalled('4.1', '4.1.0-beta.7', '4.1.0-beta.7')).not.toThrow()
    expect(() => checkInstalled('4.1', '4.1.0-beta.7', '4.1.0-beta.6')).toThrow(
      'examples/4.1 pins meocord 4.1.0-beta.7, but meocord 4.1.0-beta.6 is installed there; run bun install, then build the playground.',
    )
    expect(() => checkInstalled('4.1', '4.1.0-beta.7', undefined)).toThrow(
      /pins meocord 4\.1\.0-beta\.7, but no meocord is/,
    )
  })
})

describe('contentName', () => {
  it('names a file by the hash of its bytes, so a change gives a new path', () => {
    const name = contentName('4.1.0-beta.7', 'bytes', 'js')
    expect(name).toMatch(/^4\.1\.0-beta\.7\.[0-9a-f]{10}\.js$/)
    expect(contentName('4.1.0-beta.7', 'bytes', 'js')).toBe(name)
    expect(contentName('4.1.0-beta.7', 'other', 'js')).not.toBe(name)
  })
})

describe('frameDocument', () => {
  const paths = {
    script: '/playground/frame.0123456789.js',
    runtime: '/playground/4.1.0-beta.7.abcdef0123.js',
    wasm: '/playground/swc.9876543210.wasm',
  }

  it("holds only the frame's script, told where the runtime and the compiler are", () => {
    const html = frameDocument(paths)
    expect(html).toContain(
      '<script src="/playground/frame.0123456789.js" data-runtime="/playground/4.1.0-beta.7.abcdef0123.js" data-wasm="/playground/swc.9876543210.wasm"></script>',
    )
    expect(html.match(/<script/g)).toHaveLength(1)
  })

  it("refuses a path outside the playground's files, or one an attribute can't hold", () => {
    expect(() => frameDocument({ ...paths, runtime: 'https://example.com/x.js' })).toThrow(/not https:\/\/example/)
    expect(() => frameDocument({ ...paths, wasm: '/playground/a"b.wasm' })).toThrow()
    expect(() => frameDocument({ ...paths, script: '/_next/static/x.js' })).toThrow()
  })
})

describe('runtimeEntry', () => {
  it('installs the async context before any module, then hands every reader module to the Worker', () => {
    const entry = runtimeEntry('/runtime')
    const lines = entry.split('\n')
    expect(lines[0]).toBe("import '/runtime/node/async-hooks.ts'")
    for (const specifier of READER_MODULES) expect(entry).toContain(`from '${specifier}'`)
    expect(entry).toContain("import { startWorker } from '/runtime/worker.ts'")
    expect(entry).toContain("  'meocord/testing': m5,")
  })
})

describe('nodeModulesPlugin', () => {
  const runtimeDir = path.resolve(import.meta.dirname, '../../src/playground/runtime')
  const bundle = async (contents: string) => {
    const result = await build({
      stdin: { contents, resolveDir: runtimeDir, loader: 'ts' },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      logLevel: 'silent',
      plugins: [nodeModulesPlugin(runtimeDir, path.resolve(import.meta.dirname, '../..'))],
    })
    return new TextDecoder().decode(result.outputFiles[0]!.contents)
  }

  it("stubs what dispatch never reaches, and gives the Worker's own modules and polyfills for the rest", async () => {
    const code = await bundle(`
      import { readFileSync } from 'node:fs'
      import { WebSocketManager } from '@discordjs/ws'
      import { randomUUID } from 'node:crypto'
      import { EventEmitter } from 'node:events'
      import { AsyncLocalStorage } from 'node:async_hooks'
      export { readFileSync, WebSocketManager, randomUUID, EventEmitter, AsyncLocalStorage }
    `)
    // Every Node import is resolved in the bundle, none left for a browser to fetch
    expect(code).not.toMatch(/from\s*["'](node:)?(fs|crypto|events|async_hooks|@discordjs\/ws)["']/)
    expect(code).toContain('Symbol.toPrimitive')
    expect(code).toContain('crypto.randomUUID')
    expect(code).toMatch(/AsyncLocalStorage = class|class AsyncLocalStorage/)
  })

  it('rewrites the async generator prototype the event emitter reads, which lowered code cannot evaluate', async () => {
    // Wherever the install put it: bun's isolated linker keeps each package in its own store directory
    const { globSync } = await import('fs')
    const root = path.resolve(import.meta.dirname, '../..')
    const [emitter] = globSync(
      'node_modules/.bun/@vladfrangu+async_event_emitter@*/node_modules/@vladfrangu/async_event_emitter/dist/index.mjs',
      { cwd: root },
    )
    expect(emitter).toBeDefined()
    const source = (await import('fs')).readFileSync(path.join(root, emitter!), 'utf8')
    expect(source).toMatch(/async function\*\s*\(\)\s*\{\s*\}\s*\)\.prototype/)
    const code = await bundle(`export * from '${path.join(root, emitter!)}'`)
    expect(code).not.toMatch(/async function\*\s*\(\)\s*\{\s*\}\s*\)\.prototype/)
  })
})
