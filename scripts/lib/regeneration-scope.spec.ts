import { describe, expect, it } from 'vitest'
import { readsChanges, regenerates } from './regeneration-scope.js'

describe('regenerates', () => {
  it('always regenerates on main and in the merge queue, whatever changed', () => {
    expect(regenerates('push', [])).toBe(true)
    expect(regenerates('merge_group', ['content/4.3/defer.md'])).toBe(true)
  })

  it('regenerates for a pull request that changes the pipeline, its dependencies, the versions or the output', () => {
    for (const file of ['scripts/lib/api.ts', 'generated/api/4.0.1.json', 'package.json', 'bun.lock', 'versions.json'])
      expect(regenerates('pull_request', ['content/4.3/defer.md', file])).toBe(true)
  })

  it("skips a pull request that changes none of them, a workspace's own package.json included", () => {
    expect(regenerates('pull_request', ['content/4.3/defer.md', 'src/lib/urls.ts', 'examples/4.3/package.json'])).toBe(
      false,
    )
    expect(regenerates('pull_request', ['.github/workflows/ci.yml', 'scripts-notes.md'])).toBe(false)
  })
})

describe('readsChanges', () => {
  it('reads the changed files only for a pull request', () => {
    expect(readsChanges('pull_request')).toBe(true)
    expect(readsChanges('push')).toBe(false)
    expect(readsChanges('merge_group')).toBe(false)
  })
})
