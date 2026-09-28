/**
 * Builds the playground's runtime: for each line whose guides the site writes, one classic script a
 * Worker loads with `importScripts`, holding the meocord its examples pin, discord.js and the run
 * loop, in public/playground/ under a name that carries its hash; swc's WebAssembly beside it; and
 * .playground/manifest.json naming them for the site. Fails when a runtime is over its budget.
 */

import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { gzipSync } from 'zlib'
import { paths, ROOT } from './lib/layout.js'
import {
  checkInstalled,
  contentName,
  installedVersion,
  nodeModulesPlugin,
  type PlaygroundManifest,
  playgroundLines,
  RUNTIME_GZIP_BUDGET,
  runtimeEntry,
} from './lib/playground.js'
import { readVersions } from './lib/versions.js'

const RUNTIME_DIR = path.join(ROOT, 'src', 'playground', 'runtime')
const OUT = path.join(ROOT, 'public', 'playground')
const MANIFEST = path.join(ROOT, '.playground', 'manifest.json')

const pinOf = (line: string) => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'examples', line, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  const pin = pkg.dependencies?.meocord
  return pin && /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(pin) ? pin : undefined
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const wasm = readFileSync(path.join(ROOT, 'node_modules', '@swc', 'wasm-web', 'wasm_bg.wasm'))
const swcName = contentName('swc', wasm, 'wasm')
copyFileSync(path.join(ROOT, 'node_modules', '@swc', 'wasm-web', 'wasm_bg.wasm'), path.join(OUT, swcName))
const manifest: PlaygroundManifest = { swc: `/playground/${swcName}`, lines: [] }

for (const { line, version } of playgroundLines(readVersions(paths.versions), pinOf)) {
  // The bundle resolves meocord from the line's examples, so what is installed there is what ships
  checkInstalled(line, version, installedVersion('meocord', path.join(ROOT, 'examples', line)))
  const result = await build({
    stdin: {
      contents: runtimeEntry(RUNTIME_DIR),
      // The reader's modules resolve from the line's examples, at the version they pin
      resolveDir: path.join(ROOT, 'examples', line),
      sourcefile: `playground-${line}.ts`,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    minify: true,
    // The testing mocks recognize discord.js's classes by name
    keepNames: true,
    // Lowered, so the async context follows every await
    supported: { 'async-await': false },
    define: { 'process.env.NODE_ENV': '"development"', global: 'globalThis' },
    inject: [path.join(RUNTIME_DIR, 'node', 'globals.ts')],
    plugins: [nodeModulesPlugin(RUNTIME_DIR, ROOT)],
    logLevel: 'error',
    legalComments: 'none',
  })
  const bytes = result.outputFiles[0]!.contents
  const gzip = gzipSync(bytes, { level: 9 }).length
  if (gzip > RUNTIME_GZIP_BUDGET)
    throw new Error(
      `The ${line} playground runtime is ${(gzip / 1024).toFixed(0)} KB gzipped, over its ${RUNTIME_GZIP_BUDGET / 1024} KB budget.`,
    )
  const name = contentName(version, bytes, 'js')
  writeFileSync(path.join(OUT, name), bytes)
  manifest.lines.push({ line, version, runtime: `/playground/${name}`, gzip })
  console.log(
    `[playground] ${line}: meocord ${version} -> public/playground/${name} (${(gzip / 1024).toFixed(0)} KB gz)`,
  )
}

mkdirSync(path.dirname(MANIFEST), { recursive: true })
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[playground] manifest -> ${path.relative(ROOT, MANIFEST)}`)
