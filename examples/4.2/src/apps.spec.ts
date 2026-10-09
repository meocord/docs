import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

const root = path.dirname(fileURLToPath(import.meta.url))

// Every file that declares a @MeoCord app, in path order, so a failure names the same file on every run
function appFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return appFiles(full)
      return entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.spec.ts') &&
        /^\s*@MeoCord\(/m.test(readFileSync(full, 'utf8'))
        ? [full]
        : []
    })
}

// Wired as the bot wires it, with no stand-in: compile() refuses a token nothing provides, and runs no factory
describe('every example app', () => {
  for (const file of appFiles(root)) {
    it(`${path.relative(root, file)} provides every token its classes inject`, async () => {
      // Each example app is its file's default export
      const App = ((await import(file)) as { default?: unknown }).default
      expect(typeof App, `${path.relative(root, file)} has no default export`).toBe('function')
      expect(() => MeoCordTestingModule.fromApp(App as new () => unknown).compile()).not.toThrow()
    })
  }
})
