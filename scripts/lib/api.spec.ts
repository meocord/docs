import { cpSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { generateApi } from './api.js'

const dir = mkdtempSync(path.join(tmpdir(), 'meocord-docs-api-'))
cpSync(path.join(import.meta.dirname, '..', '__fixtures__', 'package'), dir, { recursive: true })
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const meta = { package: 'meocord', version: '9.0.0-beta.0', integrity: 'sha512-x' }

describe('generateApi', () => {
  it('gives the same document however many packages the process converted before', async () => {
    const first = await generateApi(dir, meta)
    const second = await generateApi(dir, meta)

    expect(second).toEqual(first)
    expect(first.project.id).toBe(0)
  }, 60_000)
})
