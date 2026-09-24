/** Unpacks a verified npm tarball into a directory of its own. */

import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

export interface Unpacked {
  /** The package root, where its package.json is. */
  dir: string
  remove(): void
}

export function unpack(bytes: Uint8Array): Unpacked {
  const root = mkdtempSync(path.join(tmpdir(), 'meocord-docs-'))
  const archive = path.join(root, 'package.tgz')
  writeFileSync(archive, bytes)
  // tar refuses absolute and parent paths by default, and --no-same-owner keeps file ownership ours
  const result = spawnSync('tar', ['-xzf', archive, '--no-same-owner', '-C', root], { encoding: 'utf8' })
  if (result.status !== 0) {
    rmSync(root, { recursive: true, force: true })
    throw new Error(`Could not unpack the tarball: ${result.stderr || result.error?.message}`)
  }
  return { dir: path.join(root, 'package'), remove: () => rmSync(root, { recursive: true, force: true }) }
}
