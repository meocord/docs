import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = path.resolve(import.meta.dirname, 'regeneration-scope.ts')

/** A git repository with a base commit and, unless `changes` is empty, a commit on it changing those files. */
function repository(changes: string[]) {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-scope-'))
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  const commit = (files: string[], message: string) => {
    for (const file of files) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), `${message}\n`)
    }
    git('add', '--all')
    git(
      '-c',
      'user.name=docs',
      '-c',
      'user.email=docs@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-q',
      '-m',
      message,
    )
  }
  git('init', '-q')
  commit(['README.md'], 'base')
  if (changes.length > 0) commit(changes, 'change')
  const scope = (event: string) =>
    spawnSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: event },
    })
  return { scope }
}

describe('the regeneration scope', () => {
  it("regenerates for a pull request that changes the pipeline, from the merge commit's first parent", () => {
    const run = repository(['content/4.3/defer.md', 'scripts/lib/api.ts']).scope('pull_request')
    expect(run.status).toBe(0)
    expect(run.stdout).toBe('run=true\n')
    expect(run.stderr).toContain('scripts/lib/api.ts')
  })

  it('skips a pull request that changes only the guides', () => {
    const run = repository(['content/4.3/defer.md']).scope('pull_request')
    expect(run.status).toBe(0)
    expect(run.stdout).toBe('run=false\n')
  })

  it('regenerates on main without reading git', () => {
    const run = repository([]).scope('push')
    expect(run.status).toBe(0)
    expect(run.stdout).toBe('run=true\n')
  })

  it('fails, deciding nothing, when the pull request has no parent to compare with', () => {
    const run = repository([]).scope('pull_request')
    expect(run.status).toBe(1)
    expect(run.stdout).toBe('')
    expect(run.stderr).toContain("Could not list the pull request's changes")
  })
})
