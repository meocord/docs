/**
 * Whether CI regenerates every version and checks nothing changes: always on main and in the merge queue,
 * and on a pull request only when it changes what the documents are made from, or the documents themselves.
 */

/** What a pull request regenerates for: the pipeline, the dependencies it runs on, the version list and its output. */
export const REGENERATION_INPUTS = ['scripts/', 'generated/', 'package.json', 'bun.lock', 'versions.json']

const PULL_REQUEST = 'pull_request'

/** True unless `event` is a pull request whose changed files touch none of REGENERATION_INPUTS. */
export function regenerates(event: string, changed: readonly string[]): boolean {
  if (event !== PULL_REQUEST) return true
  return changed.some(file =>
    REGENERATION_INPUTS.some(input => (input.endsWith('/') ? file.startsWith(input) : file === input)),
  )
}

/** Whether `event` needs the files a pull request changes to decide; on any other event they are not read. */
export function readsChanges(event: string): boolean {
  return event === PULL_REQUEST
}
