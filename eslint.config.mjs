import prettier from 'eslint-plugin-prettier'
import unusedImports from 'eslint-plugin-unused-imports'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

const unused = {
  args: 'all',
  argsIgnorePattern: '^_',
  caughtErrors: 'all',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  ignoreRestSiblings: true,
}

export default defineConfig([
  nextPlugin.configs['core-web-vitals'],
  ...tseslint.configs.recommended,
  globalIgnores([
    '.next/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'scripts/__fixtures__/**',
  ]),
  {
    plugins: { prettier, unusedImports },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unused],
      'unusedImports/no-unused-imports': 'error',
      'unusedImports/no-unused-vars': ['error', unused],
    },
  },
  {
    // Examples are bot code, not Next code: their specs name the testing module `module`, as a
    // generated app's specs do
    files: ['examples/**'],
    rules: { '@next/next/no-assign-module-variable': 'off' },
  },
  {
    // meo-canvas is a native addon for the icons script and the OG route; a page must not load it.
    // src/lib/brand/page-imports.spec.ts checks the transitive case.
    files: ['src/app/**', 'src/components/**'],
    ignores: ['src/app/og/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'meo-canvas', message: 'Pages do not load meo-canvas; draw with @/lib/brand/mark-paths.' },
            { name: '@/lib/brand/mark', message: 'It loads meo-canvas; use @/lib/brand/mark-paths.' },
            { name: '@/lib/og/render', message: 'It loads meo-canvas; only the OG route draws cards.' },
          ],
        },
      ],
    },
  },
])
