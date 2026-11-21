import { describe, expect, it } from 'vitest'

// The site runs on Bun, so its tests do too: `bun run test` starts vitest with `bun --bun`, and its workers inherit
// Bun. Without `--bun`, vitest's `#!/usr/bin/env node` shebang puts the suite on Node whenever Node is on the PATH
describe('test runtime', () => {
  it("runs under Bun's runtime", () => {
    expect(process.versions.bun, 'the suite ran on Node: start vitest with `bun --bun vitest`').toBeDefined()
  })
})
