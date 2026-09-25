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
