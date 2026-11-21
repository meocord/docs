import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { descendants, killTree, listedParents } from './process-tree.mjs'

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 20))
}

/** Room for several listings: on Windows each one starts PowerShell, which takes about a second. */
const TREE_TIMEOUT = 30_000

/** A process that idles long enough to be found and killed. */
const IDLE = 'setTimeout(() => {}, 30_000)'

describe('process tree', () => {
  it('finds a grandchild and kills the whole tree, deepest first', { timeout: TREE_TIMEOUT }, async () => {
    // The runtime starting another of itself, as `next dev` starts its workers. A shell's `sleep &` won't do:
    // under Git for Windows both are MSYS processes, which Windows doesn't record as parent and child.
    const starts = `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(IDLE)}], { stdio: 'ignore' }); ${IDLE}`
    const parent = spawn(process.execPath, ['-e', starts], { stdio: 'ignore' })
    await until(() => descendants(parent.pid!).length > 0)
    const below = descendants(parent.pid!)
    expect(below.length).toBeGreaterThan(0)

    killTree(parent.pid!, 'SIGKILL')
    await until(() => !below.some(alive))
    expect(below.filter(alive)).toEqual([])
  })

  it("leaves out a Windows row whose parent's ID now belongs to a newer process", () => {
    // Windows file times, one tick apart past 2^53: 300 was created a tick before 100 took the ID it names
    const listing = [
      '100 4 134000000000000001',
      '200 100 134000000000000002',
      '300 100 134000000000000000',
      '400 100 ',
      '500 100',
    ].join('\r\n')
    expect([...listedParents(listing)]).toEqual([
      [100, 4],
      [200, 100],
      [400, 100],
      [500, 100],
    ])
  })

  it('finds nothing below a process without children, and ignores one already gone', () => {
    expect(descendants(2 ** 22 + 12345)).toEqual([])
    expect(() => killTree(2 ** 22 + 12345, 'SIGKILL')).not.toThrow()
  })
})
