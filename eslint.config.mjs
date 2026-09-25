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
    // Search indexes built by `bun run search:build`
    'public/_pagefind/**',
    'public/palette/**',
    '.search/**',
    '.api-layout/**',
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
    // An element with an @meonode/ui component is built with it (Div, Row, Span, SvgPath, …): its
    // children-first form, its layout defaults and its name all read better than a tag string. The
    // pattern lists every tag @meonode/ui 3.0.0 exports a component for, so a tag without one (such as
    // `del`), or a tag chosen at run time, still goes through Node.
    files: ['src/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='Node'][arguments.0.type='Literal'][arguments.0.value=/^(a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|blockquote|body|br|button|canvas|caption|circle|cite|code|col|colgroup|data|datalist|dd|defs|details|dfn|dialog|div|dl|dt|ellipse|em|embed|fieldset|figcaption|figure|footer|form|g|head|header|hgroup|hr|html|i|iframe|img|input|kbd|label|legend|li|line|linearGradient|link|main|map|mark|menu|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|param|path|picture|polygon|polyline|pre|progress|q|radialGradient|rect|rp|rt|ruby|s|samp|script|search|section|select|small|source|span|stop|strong|style|sub|summary|sup|svg|symbol|table|tbody|td|template|text|textarea|tfoot|th|thead|time|title|tr|track|tspan|u|ul|use|var|video|wbr)$/]",
          message: 'Use the @meonode/ui component for this tag (Div, Row, Span, P, …) instead of Node(tag).',
        },
      ],
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
