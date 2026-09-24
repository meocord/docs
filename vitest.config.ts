import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', 'tests/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      include: [
        'src/lib/**',
        'src/config/**',
        'src/app/**/route.ts',
        'src/proxy.ts',
        'scripts/csp-hash.mjs',
        'scripts/ico.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
