import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

/** Every process's parent, from /proc on Linux (the image has no `ps`) and from `ps` elsewhere. */
function parents() {
  /** @type {Map<number, number>} */
  const map = new Map()
  if (process.platform === 'linux') {
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue
      try {
        // The command name may hold spaces and parentheses, so read the fields after its last ')'.
        const stat = readFileSync(`/proc/${entry}/stat`, 'utf8')
        map.set(Number(entry), Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]))
      } catch {
        // The process exited while being read.
      }
    }
    return map
  }
  for (const line of execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number)
    if (pid) map.set(pid, ppid)
  }
  return map
}

/**
 * The processes below `pid`, deepest first so a parent never outlives the children it would
 * respawn. `next dev` forks workers that hold the port, and killing only its first process leaves
 * them running.
 * @param {number} pid
 * @returns {number[]}
 */
export function descendants(pid) {
  let map
  try {
    map = parents()
  } catch {
    return []
  }
  /** @type {number[]} */
  const found = []
  const visit = (/** @type {number} */ parent) => {
    for (const [child, ppid] of map) {
      if (ppid === parent) {
        visit(child)
        found.push(child)
      }
    }
  }
  visit(pid)
  return found
}

/**
 * Sends `signal` to `pid` and every process below it, ignoring those already gone.
 * @param {number} pid
 * @param {NodeJS.Signals} signal
 */
export function killTree(pid, signal) {
  for (const target of [...descendants(pid), pid]) {
    try {
      process.kill(target, signal)
    } catch {
      // Already exited.
    }
  }
}
