import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLayout, type Link } from './mirror'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A tree with a nested file and a relative link to it, and an empty place to mirror it into. */
function tree() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mirror-'))
  dirs.push(dir)
  const from = path.join(dir, 'from')
  mkdirSync(path.join(from, 'a'), { recursive: true })
  writeFileSync(path.join(from, 'a', 'f'), 'f')
  writeFileSync(path.join(from, 'g'), 'g')
  symlinkSync('a/f', path.join(from, 'rel'))
  return { from, to: path.join(dir, 'to') }
}

/** A link that fails as one across filesystems does, counting its calls. */
function acrossFilesystems() {
  const calls: string[] = []
  const link: Link = (_from, to) => {
    calls.push(to)
    throw Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' })
  }
  return { link, calls }
}

describe('createLayout', () => {
  it('keeps a relative link as written, so it resolves inside the layout', () => {
    const { from, to } = tree()
    createLayout().mirror(from, to)
    expect(lstatSync(path.join(to, 'rel')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(path.join(to, 'rel'))).toBe('a/f')
    expect(readFileSync(path.join(to, 'rel'), 'utf8')).toBe('f')
  })

  it('hard-links each file, nested ones included: the same inode, not a copy', () => {
    const { from, to } = tree()
    createLayout().mirror(from, to)
    for (const file of ['a/f', 'g']) {
      expect(statSync(path.join(to, file)).ino).toBe(statSync(path.join(from, file)).ino)
      expect(statSync(path.join(from, file)).nlink).toBe(2)
    }
  })

  it('copies across filesystems, trying a hard link only once', () => {
    const { from, to } = tree()
    const { link, calls } = acrossFilesystems()
    createLayout(link).mirror(from, to)
    expect(calls).toHaveLength(1)
    for (const file of ['a/f', 'g']) {
      expect(readFileSync(path.join(to, file), 'utf8')).toBe(readFileSync(path.join(from, file), 'utf8'))
      expect(statSync(path.join(to, file)).ino).not.toBe(statSync(path.join(from, file)).ino)
    }
  })

  it('places a single file the same way', () => {
    const { from, to } = tree()
    mkdirSync(to)
    createLayout().place(path.join(from, 'g'), path.join(to, 'g'))
    expect(statSync(path.join(to, 'g')).ino).toBe(statSync(path.join(from, 'g')).ino)
  })

  it('refuses a target that already exists, linking or copying, and leaves it as it was', () => {
    const { from, to } = tree()
    mkdirSync(to)
    writeFileSync(path.join(to, 'g'), 'kept')
    expect(() => createLayout().place(path.join(from, 'g'), path.join(to, 'g'))).toThrow(/EEXIST/)
    expect(() => createLayout(acrossFilesystems().link).place(path.join(from, 'g'), path.join(to, 'g'))).toThrow(
      /EEXIST/,
    )
    expect(readFileSync(path.join(to, 'g'), 'utf8')).toBe('kept')
  })

  it('passes on any other failure to link', () => {
    const { from, to } = tree()
    const link: Link = () => {
      throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' })
    }
    expect(() => createLayout(link).mirror(from, to)).toThrow(/EPERM/)
  })
})
