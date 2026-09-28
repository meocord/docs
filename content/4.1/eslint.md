---
id: eslint
title: ESLint
chapter: shipping
order: 6
summary: Lint the project with MeoCord's ESLint config, add rules of your own, and catch import cycles as you write.
learn:
  - Extend MeoCord's ESLint config with your own rules and plugins
  - Catch import cycles before the bot refuses to start over one
requires: [project-structure, services]
api: [configuration/typescriptConfig]
since: 4.0.0
covers: [4.0/configuration#eslint]
---

`meocord/eslint` exports a base ESLint config for a MeoCord project. It lints your TypeScript, `meocord.config.ts`
included, with type information from the project's tsconfig files. A new project's `eslint.config.ts` uses it, and its
`lint` script runs ESLint and both typechecks.

## When to use it

Keep it on in every MeoCord project, and run `npm run lint` in CI. Replace it only to lint the project with a config
you maintain yourself; you then lose the import-cycle warning below unless you add it.

## Example

::example{file="config/eslint-config.ts" region="config"}

`typescriptConfig` is the part of the default export that lints TypeScript. Spread it, and add your rules over its own.

## How it works

The config reads type information from `tsconfig.json`, `tsconfig.test.json` and `tsconfig.eslint.json`, whichever
includes the file. A file ESLint reports as not included in any of them needs listing in one: a script at the root, for
instance, goes in `tsconfig.eslint.json`.

Plugins go in the same object, spread over `typescriptConfig.plugins`, as a new project's config does for
`eslint-plugin-unused-imports`.

## Import cycles

Two classes that import each other can't be injected: whichever file loads second records the other's constructor type
before that class exists, and the bot refuses to start. `meocord/eslint` warns about the cycle with `import-x/no-cycle`
as you write it. Type-only imports are ignored, since they're gone at runtime.

The check follows imports through `@src` with `eslint-import-resolver-typescript`, which new projects include. A
project without it gets no cycle warning, and the rest of its lint is unchanged; add it to turn the check on:

```bash
npm install --save-dev eslint-import-resolver-typescript
```

[Services](guide:services#gotchas) covers the fix: move what both need into a third service.

## Gotchas

- **A warning doesn't fail `lint`** unless it runs with `--max-warnings=0`, as a CI job may. Run it that way to hold
  cycles out of the main branch.
- **A file in no tsconfig** fails to lint with type information. List it in `tsconfig.eslint.json`.

## Next steps

- [Services](guide:services): what the bot injects, and how two services share what they both need.
- [Testing](guide:testing): run the specs beside the lint in CI.
- [The CLI](guide:cli): build and start the bot the lint has checked.
