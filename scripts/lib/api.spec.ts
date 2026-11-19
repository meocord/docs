import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateApi, linkPeers } from './api.js'

const dir = mkdtempSync(path.join(tmpdir(), 'meocord-docs-api-'))
cpSync(path.join(import.meta.dirname, '..', '__fixtures__', 'package'), dir, { recursive: true })
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const meta = { package: 'meocord', version: '9.0.0-beta.0', integrity: 'sha512-x' }

describe('generateApi', () => {
  it('gives the same document however many packages the process converted before', async () => {
    const first = await generateApi(dir, meta)
    const second = await generateApi(dir, meta)

    expect(second).toEqual(first)
    expect(first.project.id).toBe(0)
  }, 60_000)
})

describe('linkPeers', () => {
  let root: string
  let pkg: string
  let modules: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'meocord-docs-peers-'))
    pkg = path.join(root, 'package')
    modules = path.join(root, 'modules')
    mkdirSync(pkg)
    mkdirSync(modules)
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const manifest = (peerDependencies: Record<string, string>, peerDependenciesMeta?: Record<string, object>) =>
    writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ peerDependencies, peerDependenciesMeta }))
  const install = (name: string, version: string) => {
    mkdirSync(path.join(modules, name), { recursive: true })
    writeFileSync(path.join(modules, name, 'package.json'), JSON.stringify({ name, version }))
  }
  const linked = (name: string) => path.join(pkg, 'node_modules', name)
  const declare = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(pkg, file)), { recursive: true })
    writeFileSync(path.join(pkg, file), text)
  }

  it('skips an optional peer the repository lacks', () => {
    manifest({ globals: '*' }, { globals: { optional: true } })

    expect(() => linkPeers(pkg, modules)).not.toThrow()
    expect(existsSync(linked('globals'))).toBe(false)
  })

  it('fails on an optional peer the repository lacks that a declaration imports, naming it', () => {
    declare('meocord.eslint.d.ts', "import type { Linter } from 'eslint'\nexport declare const config: Linter.Config\n")
    manifest({ eslint: '*', globals: '*' }, { eslint: { optional: true }, globals: { optional: true } })

    expect(() => linkPeers(pkg, modules)).toThrow(
      "eslint *, an optional peer the package's declarations import, isn't installed here: add it to devDependencies.",
    )
  })

  it('reads a scoped package from a subpath re-export in a nested .d.cts', () => {
    declare(
      'dist/types/lint/index.d.cts',
      "export type { ParserOptions } from '@typescript-eslint/parser/dist/parser'\n",
    )
    manifest({ '@typescript-eslint/parser': '*' }, { '@typescript-eslint/parser': { optional: true } })

    expect(() => linkPeers(pkg, modules)).toThrow(
      "@typescript-eslint/parser *, an optional peer the package's declarations",
    )
  })

  it('skips an optional peer a declaration names only in a comment, or one under its own node_modules', () => {
    declare(
      'index.d.ts',
      "/**\n * @example\n * import globals from 'globals'\n */\nexport declare const ready: boolean\n",
    )
    declare('node_modules/other/index.d.ts', "import type { Linter } from 'eslint'\n")
    manifest({ eslint: '*', globals: '*' }, { eslint: { optional: true }, globals: { optional: true } })

    expect(() => linkPeers(pkg, modules)).not.toThrow()
  })

  it('links an optional peer the repository has, beside the required ones', () => {
    install('@typescript-eslint/parser', '8.1.0')
    install('discord.js', '14.27.0')
    manifest(
      { '@typescript-eslint/parser': '*', 'discord.js': '^14.27.0', globals: '*' },
      { '@typescript-eslint/parser': { optional: true }, globals: { optional: true } },
    )

    linkPeers(pkg, modules)

    expect(realpathSync(linked('@typescript-eslint/parser'))).toBe(
      realpathSync(path.join(modules, '@typescript-eslint/parser')),
    )
    expect(realpathSync(linked('discord.js'))).toBe(realpathSync(path.join(modules, 'discord.js')))
    expect(existsSync(linked('globals'))).toBe(false)
  })

  it('fails on an optional peer the repository holds outside its range', () => {
    install('eslint', '8.0.0')
    manifest({ eslint: '>=8.57.0' }, { eslint: { optional: true } })

    expect(() => linkPeers(pkg, modules)).toThrow(
      "eslint@8.0.0 is installed here, outside the package's peer range >=8.57.0.",
    )
  })

  it('fails on a required peer the repository lacks, naming it', () => {
    manifest({ 'discord.js': '^14.27.0', globals: '*' }, { globals: { optional: true } })

    expect(() => linkPeers(pkg, modules)).toThrow(
      "discord.js ^14.27.0, a peer of the package, isn't installed here: add it to devDependencies.",
    )
  })

  it('fails on a missing peer whose meta does not mark it optional', () => {
    manifest({ globals: '*' }, { globals: { optional: false } })

    expect(() => linkPeers(pkg, modules)).toThrow("globals *, a peer of the package, isn't installed here")
  })
})
