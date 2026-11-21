import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// vitest is held at 5.1.0: 5.1.1's forks pool calls child.channel.unref(), which Bun's IPC channel lacks
// (oven-sh/bun#33593), and examples:check runs vitest under Bun's runtime, where 5.1.1 can't start its workers.
// A vitest release with vitest-dev/vitest#12039 (`child.channel?.unref?.()`) lifts it too, which this spec can't
// see: check vitest's changelog on each bump
const BUN = process.versions.bun ? process.execPath : 'bun'
const PROBE = `
  import { spawn } from 'node:child_process'
  const child = spawn(process.execPath, ['-e', '0'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
  console.log(typeof child.channel?.unref)
  child.kill()
`

describe('vitest pin', () => {
  it("holds while Bun's IPC channel has no unref", () => {
    const result = spawnSync(BUN, ['-e', PROBE], { encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(
      result.stdout.trim(),
      'Bun has channel.unref now: move vitest and @vitest/coverage-istanbul to their latest and delete this spec',
    ).toBe('undefined')
  })
})
