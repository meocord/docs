import { fileURLToPath } from 'node:url'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// As a generated app has it: SWC, since esbuild cannot emit the decorator metadata injection reads
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  resolve: { alias: { '@src': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { setupFiles: ['reflect-metadata'], clearMocks: true, include: ['src/**/*.spec.ts'] },
})
