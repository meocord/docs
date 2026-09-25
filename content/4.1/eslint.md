---
id: eslint
title: ESLint
section: Shipping
order: 61
---

`meocord/eslint` exports a base ESLint config. It lints your TypeScript, `meocord.config.ts` included, with
type information from `tsconfig.json`, `tsconfig.test.json` and `tsconfig.eslint.json`; a file ESLint reports
as not included in any of them needs listing in one.

A generated app's `eslint.config.ts` uses it, and its `lint` script runs ESLint and both typechecks. Extend
it with rules of your own through `typescriptConfig`, which the default export includes:

::example{file="config/eslint-config.ts" region="config"}

Plugins go in the same object, spread over `typescriptConfig.plugins`, as the generated config does for
`eslint-plugin-unused-imports`.

## Import cycles

Two classes that import each other cannot be injected: whichever file loads second records the other's
constructor type before that class exists. `meocord/eslint` warns about the cycle with
`import-x/no-cycle` as you write it, before the bot refuses to start over it. Type-only imports are
ignored, since they are gone at runtime.

The check follows imports through `@src` with `eslint-import-resolver-typescript`, which new projects
include. A project without it gets no cycle warning, and the rest of its lint is unchanged; add it to turn
the check on:

```bash
npm install --save-dev eslint-import-resolver-typescript
```

A warning does not fail `lint` unless it runs with `--max-warnings=0`, as a CI job may. See
[Services that need each other](/docs/4.1/services#services-that-need-each-other) for the fix.
