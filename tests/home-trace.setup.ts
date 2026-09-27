import { spawnSync } from 'node:child_process'

// The home page's specs read the recorded demo, which is derived rather than committed, so record it first.
export default function setup(): void {
  const result = spawnSync('bun', ['scripts/home-trace.ts'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`bun run home:trace failed:\n${result.stderr || result.stdout}`)
}
