import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * Every process's ID, its parent's, and when it was created (as a Windows file time, blank when the table has
 * none), one process a line, as Windows's process table lists them.
 */
const WINDOWS_PROCESSES =
  'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() })" }'

/**
 * @typedef {object} ProcessRow
 * @property {number} pid
 * @property {number} ppid
 * @property {bigint} [created] When the process was created, where the table says.
 */

/**
 * Each process's parent, from the rows of a process table. Windows keeps a parent's ID in its children's rows after
 * the parent exits, and may hand the ID to a newer process: a child created before the process now holding its
 * parent's ID is such a stale link, and is left out. Linux and macOS hand an orphan to init or launchd instead.
 * @param {ProcessRow[]} rows
 * @returns {Map<number, number>}
 */
function parentLinks(rows) {
  const createdAt = new Map(rows.map(row => [row.pid, row.created]))
  /** @type {Map<number, number>} */
  const map = new Map()
  for (const { pid, ppid, created } of rows) {
    const parentCreated = createdAt.get(ppid)
    // Linux's and macOS's rows carry no time, nor do Windows's System and Idle, so a link missing one is kept
    if (created !== undefined && parentCreated !== undefined && created < parentCreated) continue
    map.set(pid, ppid)
  }
  return map
}

/**
 * Each process's parent, from a listing of `ps -o pid=,ppid=` or of WINDOWS_PROCESSES: one process a line, its ID,
 * its parent's, and on Windows when it was created.
 * @param {string} listing
 * @returns {Map<number, number>}
 */
export function listedParents(listing) {
  /** @type {ProcessRow[]} */
  const rows = []
  for (const line of listing.split('\n')) {
    const [pid, ppid, created] = line.trim().split(/\s+/)
    // Windows file times pass 2^53, so they compare as bigints
    if (Number(pid))
      rows.push({
        pid: Number(pid),
        ppid: Number(ppid),
        created: /^\d+$/.test(created ?? '') ? BigInt(created) : undefined,
      })
  }
  return parentLinks(rows)
}

/**
 * Every process's parent: from /proc on Linux (the image has no `ps`), from the process table on Windows
 * (where `ps`, if there is one, is MSYS's, which lists its own IDs), and from `ps` elsewhere.
 */
function parents() {
  if (process.platform === 'linux') {
    /** @type {ProcessRow[]} */
    const rows = []
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue
      try {
        // The command name may hold spaces and parentheses, so read the fields after its last ')'.
        const stat = readFileSync(`/proc/${entry}/stat`, 'utf8')
        rows.push({ pid: Number(entry), ppid: Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]) })
      } catch {
        // The process exited while being read.
      }
    }
    return parentLinks(rows)
  }
  const listing =
    process.platform === 'win32'
      ? execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESSES], {
          encoding: 'utf8',
        })
      : execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
  return listedParents(listing)
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
  // Links that loop would recurse forever; Windows processes created in the same instant could still form one
  const seen = new Set([pid])
  const visit = (/** @type {number} */ parent) => {
    for (const [child, ppid] of map) {
      if (ppid === parent && !seen.has(child)) {
        seen.add(child)
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
