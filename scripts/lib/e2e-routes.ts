/**
 * Which e2e specs route requests outside e2e/test.ts, whose context drops every route as a test ends, so a
 * handler still running can't fail the next test in the worker.
 */

/** Why a spec's routing can outlive its tests, or `undefined` when it can't. */
export function routeProblem(file: string, text: string): string | undefined {
  // Playwright 1.63 has no public way to drop a WebSocket route, so the fixture can't clear one at teardown
  if (/\.routeWebSocket\(/.test(text)) {
    return `${file} calls routeWebSocket, whose routes no API removes, so e2e/test.ts can't drop them as a test ends`
  }
  if (/\.route(FromHAR|WebSocket)?\(/.test(text) && !/import \{[^}]*\btest\b[^}]*\} from '\.\/test'/.test(text)) {
    return `${file} routes requests but doesn't take test from './test', so its routes outlive its tests`
  }
  return undefined
}
