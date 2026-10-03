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

Keep it on in every MeoCord project, and run `npm run lint` in CI. Replace it only to lint the project with a config you
maintain yourself; you then lose the import-cycle warning and the floating-promise check below unless you add them.

## Example

::example{file="config/eslint-config.ts" region="config"}

`typescriptConfig` is MeoCord's own entry in the default export: its parser, plugins and rules for TypeScript, applied
after typescript-eslint's recommended and stylistic sets. Spread it, and add your rules over its own.

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

## Promises nothing waits for

`meocord/eslint` turns on `@typescript-eslint/no-floating-promises`. A promise nothing awaits, such as
`respond(interaction).send()` or a database write left without `await`, rejects outside every handler MeoCord runs, so
its error reaches no [exception filter](guide:exception-filters) and can end the bot. An interceptor's `next.handle()`
left that way runs the code after it before the handler finishes, so that code never sees the handler's result or
error. For each one it reports, either:

- `await` it, or `return` it, where the code after it should wait, as an interceptor's `next.handle()` always should;
- or write `void` before it where it's meant to run on its own, and handle its failure with `.catch()`.

## Gotchas

- **A warning doesn't fail `lint`.** To hold cycles out of the main branch, run `npx eslint --max-warnings=0` in CI;
  passed through `npm run lint --`, the flag reaches `tsc`, which rejects it.
- **A file in no tsconfig** fails to lint with type information. List it in `tsconfig.eslint.json`.

## Next steps

- [Services](guide:services): what the bot injects, and how two services share what they both need.
- [Testing](guide:testing): run the specs beside the lint in CI.
- [The CLI](guide:cli): build and start the bot the lint has checked.
