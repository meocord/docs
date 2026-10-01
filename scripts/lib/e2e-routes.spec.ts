import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { routeProblem } from './e2e-routes'

const E2E = path.resolve(import.meta.dirname, '..', '..', 'e2e')
const fromTest = "import { expect, test } from './test'\n"
const fromPlaywright = "import { expect, test } from '@playwright/test'\n"

describe('routeProblem', () => {
  it('passes a spec that routes with test from ./test, and one that routes nothing', () => {
    expect(routeProblem('a.spec.ts', `${fromTest}await page.route('**/*', route => route.continue())`)).toBeUndefined()
    expect(routeProblem('a.spec.ts', `${fromTest}await page.context().routeFromHAR('a.har')`)).toBeUndefined()
    expect(routeProblem('a.spec.ts', `${fromPlaywright}await page.goto('/')`)).toBeUndefined()
  })

  it('names a spec that routes with test from @playwright/test', () => {
    expect(routeProblem('a.spec.ts', `${fromPlaywright}await page.route('**/*', route => route.continue())`)).toMatch(
      /^a\.spec\.ts routes requests but doesn't take test from '\.\/test'/,
    )
    expect(routeProblem('a.spec.ts', `${fromPlaywright}await page.routeFromHAR('a.har')`)).toBeDefined()
  })

  it('refuses routeWebSocket, even with test from ./test', () => {
    for (const text of [
      `${fromTest}await page.routeWebSocket('/ws', ws => ws.close())`,
      `${fromPlaywright}await context.routeWebSocket(/ws/, () => {})`,
    ]) {
      expect(routeProblem('a.spec.ts', text)).toMatch(/^a\.spec\.ts calls routeWebSocket, whose routes no API removes/)
    }
  })
})

describe('e2e specs that route requests', () => {
  it('take test from e2e/test.ts, whose context drops its routes as the test ends', () => {
    const problems = readdirSync(E2E)
      .filter(file => file.endsWith('.spec.ts'))
      .flatMap(file => routeProblem(file, readFileSync(path.join(E2E, file), 'utf8')) ?? [])
    expect(problems).toEqual([])
  })
})
