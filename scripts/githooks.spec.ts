import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')

/** A git repository with the pre-commit hook, the Prettier config and, unless left out, the installed Prettier. */
function repository({ installed = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-hook-'))
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  git('init', '-q')
  mkdirSync(path.join(dir, '.githooks'))
  for (const file of ['.githooks/pre-commit', '.prettierrc.json', '.prettierignore'])
    copyFileSync(path.join(ROOT, file), path.join(dir, file))
  if (installed) symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'))
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    writeFileSync(path.join(dir, file), text)
  }
  const stage = (file: string, text: string) => {
    write(file, text)
    git('add', file)
  }
  const hook = () => spawnSync('bash', ['.githooks/pre-commit'], { cwd: dir, encoding: 'utf8' })
  return { write, stage, hook }
}

const FORMATTED = 'const x = 1\n'
const UNFORMATTED = 'const  x = 1\n'

describe('the pre-commit hook', () => {
  it('refuses a file staged unformatted, even when the working tree has it formatted', () => {
    const repo = repository()
    repo.stage('a.ts', UNFORMATTED)
    repo.write('a.ts', FORMATTED)
    const run = repo.hook()
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Not formatted, or not parseable, as staged: a.ts')
    expect(run.stderr).toContain('run `bun run format`')
  })

  it('passes a file staged formatted, even when the working tree has it unformatted', () => {
    const repo = repository()
    repo.stage('a.ts', FORMATTED)
    repo.write('a.ts', UNFORMATTED)
    expect(repo.hook().status).toBe(0)
  })

  it('refuses a file staged with a syntax error, which Prettier cannot format', () => {
    const repo = repository()
    repo.stage('a.ts', 'const x = (\n')
    const run = repo.hook()
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Not formatted, or not parseable, as staged: a.ts')
  })

  it('leaves a file .prettierignore excludes, and one Prettier does not format', () => {
    const repo = repository()
    repo.stage('generated/x.json', '{ "a":1}')
    repo.stage('notes.unknownext', 'anything  at all')
    expect(repo.hook().status).toBe(0)
  })

  it('asks for bun install when Prettier is not installed', () => {
    const repo = repository({ installed: false })
    repo.stage('a.ts', FORMATTED)
    const run = repo.hook()
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('run `bun install`')
  })
})
