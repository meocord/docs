import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { descendants, killTree } from './process-tree.mjs'

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

describe('process tree', () => {
  it('finds a grandchild and kills the whole tree, deepest first', async () => {
    // A shell that starts a sleeping grandchild, as `next dev` starts its workers.
    const shell = spawn('sh', ['-c', 'sleep 30 & wait'], { stdio: 'ignore' })
    await until(() => descendants(shell.pid!).length > 0)
    const below = descendants(shell.pid!)
    expect(below.length).toBeGreaterThan(0)

    killTree(shell.pid!, 'SIGKILL')
    await until(() => !below.some(alive))
    expect(below.filter(alive)).toEqual([])
  })

  it('finds nothing below a process without children, and ignores one already gone', () => {
    expect(descendants(2 ** 22 + 12345)).toEqual([])
    expect(() => killTree(2 ** 22 + 12345, 'SIGKILL')).not.toThrow()
  })
})
