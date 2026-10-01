import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const E2E = path.resolve(import.meta.dirname, '..', '..', 'e2e')

describe('e2e specs that route requests', () => {
  it('take test from e2e/test.ts, whose context drops its routes as the test ends', () => {
    const loose = readdirSync(E2E)
      .filter(file => file.endsWith('.spec.ts'))
      .filter(file => {
        const text = readFileSync(path.join(E2E, file), 'utf8')
        return /\.route(FromHAR)?\(/.test(text) && !/import \{[^}]*\btest\b[^}]*\} from '\.\/test'/.test(text)
      })
    expect(loose).toEqual([])
  })
})
