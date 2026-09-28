/**
 * What the playground's runtime is built from: a bundle per line whose guides the site writes, over
 * the meocord version that line's examples pin, with Node's modules replaced by what a browser Worker
 * has. `scripts/playground-build.ts` runs it.
 */

import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { Plugin } from 'esbuild'
import type { VersionsConfig } from './versions.js'

export type { PlaygroundLine, PlaygroundManifest } from '../../src/lib/playground-manifest.js'

/** The most a line's runtime may weigh gzipped, the budget the first Run downloads before the compiler. */
export const RUNTIME_GZIP_BUDGET = 400 * 1024

/** The modules a reader's code may import, which every runtime carries. */
export const READER_MODULES = [
  'discord.js',
  'meocord/common',
  'meocord/decorator',
  'meocord/enum',
  'meocord/interface',
  'meocord/testing',
  'reflect-metadata',
] as const

/**
 * The lines that get a runtime, and the version each builds from: those whose guides the site writes,
 * where the playground is embedded, at their examples' pin. A line whose examples don't pin an exact
 * version has nothing to build from, and is refused.
 */
export function playgroundLines(
  config: VersionsConfig,
  pinOf: (line: string) => string | undefined,
): { line: string; version: string }[] {
  return config.lines
    .filter(entry => entry.guides === 'authored')
    .map(({ line, versions }) => {
      const version = pinOf(line)
      if (!version || !versions.includes(version))
        throw new Error(
          `examples/${line} pins ${version ? `meocord ${version}` : 'no exact meocord version'}, which isn't a release of ${line}; the playground builds from that pin.`,
        )
      return { line, version }
    })
}

/**
 * The version of `name` a bundle built from `fromDir` resolves, as Node finds it: in the nearest
 * `node_modules` up the tree. Undefined when none has it.
 */
export function installedVersion(name: string, fromDir: string): string | undefined {
  for (let dir = path.resolve(fromDir); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', name, 'package.json')
    if (existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { version?: string }).version
    if (path.dirname(dir) === dir) return undefined
  }
}

/** Refuses to build a line's runtime from a meocord other than the one its examples pin. */
export function checkInstalled(line: string, pin: string, installed: string | undefined): void {
  if (installed !== pin)
    throw new Error(
      `examples/${line} pins meocord ${pin}, but ${installed ? `meocord ${installed} is` : 'no meocord is'} installed there; run bun install, then build the playground.`,
    )
}

/** A file name that carries the hash of its bytes, as the search indexes' do: `4.1.0-beta.7.3f9a1c02de.js`. */
export function contentName(prefix: string, bytes: Uint8Array | string, extension: string): string {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10)
  return `${prefix}.${hash}.${extension}`
}

/**
 * The frame the page embeds for a line: no content, only the script that starts the line's runtime in a
 * Worker, told where the runtime and the compiler are. Every path is the site's own.
 */
export function frameDocument(paths: { script: string; runtime: string; wasm: string }): string {
  for (const each of Object.values(paths))
    if (!/^\/playground\/[\w.-]+$/.test(each))
      throw new Error(`A frame loads only the playground's files, not ${each}.`)
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<meta charset="utf-8">',
    '<title>MeoCord playground</title>',
    `<script src="${paths.script}" data-runtime="${paths.runtime}" data-wasm="${paths.wasm}"></script>`,
    '</html>',
    '',
  ].join('\n')
}

/** The bundle's entry for a line: the async context first, then each reader module, handed to the Worker. */
export function runtimeEntry(runtimeDir: string): string {
  const imports = READER_MODULES.map((specifier, index) => `import * as m${index} from '${specifier}'`)
  const map = READER_MODULES.map((specifier, index) => `  '${specifier}': m${index},`)
  return [
    `import '${path.join(runtimeDir, 'node', 'async-hooks.ts')}'`,
    ...imports,
    `import { startWorker } from '${path.join(runtimeDir, 'worker.ts')}'`,
    'startWorker({',
    ...map,
    '})',
    '',
  ].join('\n')
}

/** Node's modules that have a browser package of their own. */
const POLYFILLS: Record<string, string> = {
  buffer: 'buffer/',
  events: 'events/',
  path: 'path-browserify',
  process: 'process/browser.js',
  string_decoder: 'string_decoder/',
  util: 'util/',
}

/** Node's modules the Worker provides itself, by the file under the runtime's `node/` directory. */
const SHIMS: Record<string, string> = {
  async_hooks: 'async-hooks.ts',
  crypto: 'crypto.ts',
  perf_hooks: 'perf-hooks.ts',
  timers: 'timers.ts',
  'timers/promises': 'timers-promises.ts',
  url: 'url.ts',
}

/**
 * Modules mocked dispatch never reaches: the network, the file system, processes and discord.js's
 * gateway. Each resolves to a stub any use of which works.
 */
const STUBBED = new Set([
  'assert',
  'bufferutil',
  'child_process',
  'console',
  'diagnostics_channel',
  'dns',
  'fs',
  'fs/promises',
  'http',
  'https',
  'module',
  'net',
  'os',
  'querystring',
  'stream',
  'tls',
  'undici',
  'utf-8-validate',
  'util/types',
  'vm',
  'worker_threads',
  'zlib',
  'zlib-sync',
  '@discordjs/ws',
])

/** The one expression a lowered async generator can't evaluate: the emitter only needs an object there. */
const ASYNC_GENERATOR_PROTOTYPE =
  /Object\.getPrototypeOf\(\s*Object\.getPrototypeOf\(\s*async function\*\s*\(\)\s*\{\s*\}\s*\)\.prototype\s*\)/g

/** Resolves Node's modules for a browser Worker: a polyfill, a shim of the runtime's, or the stub. */
export function nodeModulesPlugin(runtimeDir: string, packagesDir: string): Plugin {
  const node = (file: string) => path.join(runtimeDir, 'node', file)
  return {
    name: 'playground-node-modules',
    setup(build) {
      build.onLoad({ filter: /async_event_emitter[/\\]dist[/\\]index\.(mjs|cjs)$/ }, async args => {
        const { readFile } = await import('fs/promises')
        const source = (await readFile(args.path, 'utf8')).replace(ASYNC_GENERATOR_PROTOTYPE, 'Object.prototype')
        return { contents: source, loader: 'js' }
      })
      build.onResolve({ filter: /.*/ }, args => {
        const bare = args.path.replace(/^node:/, '')
        if (STUBBED.has(bare)) return { path: node('stub.cjs') }
        if (SHIMS[bare]) return { path: node(SHIMS[bare]) }
        const polyfill = POLYFILLS[bare]
        // The polyfill resolves itself from the docs' own packages, not from the importer's
        if (polyfill && args.path !== polyfill)
          return build.resolve(polyfill, { resolveDir: packagesDir, kind: args.kind }).then(resolved => resolved)
        return undefined
      })
    },
  }
}
